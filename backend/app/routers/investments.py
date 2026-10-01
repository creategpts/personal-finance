from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ft_price, investment_logic, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/investments", tags=["investments"])


def _get(db: Session, investment_id: int) -> models.Investment:
    inv = db.get(models.Investment, investment_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    return inv


def _record_snapshot(inv: models.Investment, price: float) -> None:
    today = date.today()
    existing = next((s for s in inv.snapshots if s.date == today), None)
    if existing:
        existing.price = price
    else:
        inv.snapshots.append(models.PriceSnapshot(date=today, price=price))


def _serialize(inv: models.Investment) -> schemas.InvestmentOut:
    stats = investment_logic.holding_stats(inv.current_price, inv.transactions)
    return schemas.InvestmentOut(
        id=inv.id,
        name=inv.name,
        type=inv.type,
        isin=inv.isin,
        target_weight=inv.target_weight,
        ft_symbol=inv.ft_symbol,
        active=inv.active,
        current_price=inv.current_price,
        price_updated_at=inv.price_updated_at,
        transactions=inv.transactions,
        stats=schemas.InvestmentStats(**stats),
    )


@router.get("", response_model=list[schemas.InvestmentOut])
def list_investments(db: Session = Depends(get_db)):
    investments = db.query(models.Investment).order_by(models.Investment.name).all()
    return [_serialize(inv) for inv in investments]


@router.get("/price-lookup", response_model=schemas.PriceLookupResult)
def price_lookup(isin: str):
    try:
        price = ft_price.fetch_ft_price(f"{isin}:EUR")
    except Exception as e:
        return schemas.PriceLookupResult(ok=False, error=str(e))
    return schemas.PriceLookupResult(ok=True, price=price)


@router.post("", response_model=schemas.InvestmentOut)
def create_investment(payload: schemas.InvestmentCreate, db: Session = Depends(get_db)):
    if payload.type not in models.INVESTMENT_TYPES:
        raise HTTPException(status_code=422, detail="Invalid investment type")
    inv = models.Investment(
        name=payload.name,
        type=payload.type,
        isin=payload.isin,
        target_weight=payload.target_weight,
        ft_symbol=payload.ft_symbol,
        active=payload.active,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.put("/{investment_id}", response_model=schemas.InvestmentOut)
def update_investment(investment_id: int, payload: schemas.InvestmentUpdate, db: Session = Depends(get_db)):
    if payload.type not in models.INVESTMENT_TYPES:
        raise HTTPException(status_code=422, detail="Invalid investment type")
    inv = _get(db, investment_id)
    inv.name = payload.name
    inv.type = payload.type
    inv.isin = payload.isin
    inv.target_weight = payload.target_weight
    inv.ft_symbol = payload.ft_symbol
    inv.active = payload.active
    if payload.current_price is not None:
        inv.current_price = payload.current_price
        inv.price_updated_at = datetime.utcnow()
        _record_snapshot(inv, payload.current_price)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.delete("/{investment_id}", status_code=204)
def delete_investment(investment_id: int, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    db.delete(inv)  # cascade deletes its transactions
    db.commit()


@router.post("/{investment_id}/transactions", response_model=schemas.InvestmentOut)
def add_transaction(investment_id: int, payload: schemas.InvestmentTransactionCreate, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    inv.transactions.append(
        models.InvestmentTransaction(date=payload.date, units=payload.units, amount=payload.amount, note=payload.note)
    )
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.delete("/{investment_id}/transactions/{transaction_id}", response_model=schemas.InvestmentOut)
def delete_transaction(investment_id: int, transaction_id: int, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    tx = db.get(models.InvestmentTransaction, transaction_id)
    if not tx or tx.investment_id != investment_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.post("/{investment_id}/refresh-price", response_model=schemas.PriceRefreshResult)
def refresh_price(investment_id: int, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    symbol = ft_price.symbol_for(inv.ft_symbol, inv.isin)
    if not symbol:
        raise HTTPException(status_code=422, detail="Este holding no tiene ISIN ni símbolo FT configurado")
    try:
        price = ft_price.fetch_ft_price(symbol)
    except Exception as e:
        return schemas.PriceRefreshResult(investment_id=inv.id, ok=False, error=str(e))
    inv.current_price = price
    inv.price_updated_at = datetime.utcnow()
    _record_snapshot(inv, price)
    db.commit()
    return schemas.PriceRefreshResult(investment_id=inv.id, ok=True, price=price)


@router.post("/refresh-prices", response_model=list[schemas.PriceRefreshResult])
def refresh_all_prices(db: Session = Depends(get_db)):
    results = []
    for inv in db.query(models.Investment).all():
        symbol = ft_price.symbol_for(inv.ft_symbol, inv.isin)
        if not symbol:
            continue
        try:
            price = ft_price.fetch_ft_price(symbol)
        except Exception as e:
            results.append(schemas.PriceRefreshResult(investment_id=inv.id, ok=False, error=str(e)))
            continue
        inv.current_price = price
        inv.price_updated_at = datetime.utcnow()
        _record_snapshot(inv, price)
        results.append(schemas.PriceRefreshResult(investment_id=inv.id, ok=True, price=price))
    db.commit()
    return results


@router.get("/summary", response_model=schemas.PortfolioSummary)
def summary(db: Session = Depends(get_db)):
    investments = db.query(models.Investment).all()
    stats_list = [investment_logic.holding_stats(inv.current_price, inv.transactions) for inv in investments]
    return schemas.PortfolioSummary(**investment_logic.portfolio_summary(stats_list))


@router.get("/composition", response_model=list[schemas.PortfolioCompositionItem])
def composition(db: Session = Depends(get_db)):
    investments = db.query(models.Investment).filter(models.Investment.active.is_(True)).all()
    pairs = [(inv, investment_logic.holding_stats(inv.current_price, inv.transactions)) for inv in investments]
    return investment_logic.composition(pairs)


@router.get("/history", response_model=list[schemas.PortfolioHistoryPoint])
def history(type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Investment)
    if type:
        query = query.filter(models.Investment.type == type)
    holdings = [(inv.transactions, inv.snapshots) for inv in query.all()]
    return investment_logic.portfolio_time_series(holdings)
