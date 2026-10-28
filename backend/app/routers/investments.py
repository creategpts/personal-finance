from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ft_price, investment_logic, investment_movements, models, schemas
from ..database import get_db
from .account_values import _live_balance

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


def _clean_isin(isin: str | None) -> str | None:
    """Pegar un ISIN suele traer espacios o minúsculas, y FT no lo reconoce así."""
    return (isin or "").strip().upper() or None


def _serialize(inv: models.Investment) -> schemas.InvestmentOut:
    stats = investment_logic.holding_stats_for(inv)
    return schemas.InvestmentOut(
        id=inv.id,
        name=inv.name,
        type=inv.type,
        isin=inv.isin,
        account=inv.account,
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
        symbol, price = ft_price.lookup_isin(_clean_isin(isin) or "")
    except Exception as e:
        return schemas.PriceLookupResult(ok=False, error=str(e))
    return schemas.PriceLookupResult(ok=True, price=price, symbol=symbol)


@router.post("", response_model=schemas.InvestmentOut)
def create_investment(payload: schemas.InvestmentCreate, db: Session = Depends(get_db)):
    if payload.type not in models.INVESTMENT_TYPES:
        raise HTTPException(status_code=422, detail="Invalid investment type")
    isin = _clean_isin(payload.isin)
    inv = models.Investment(
        name=payload.name,
        type=payload.type,
        isin=isin,
        account=payload.account,
        target_weight=payload.target_weight,
        ft_symbol=payload.ft_symbol,
        active=payload.active,
    )
    # El precio inicial se pide aquí y no depende de que el formulario haya hecho la búsqueda
    # al salir del campo (pulsar Crear justo después de escribir el ISIN la dejaba a medias).
    if (payload.ft_symbol or isin) and payload.type not in ("seguros", "roboadvisor"):
        try:
            if payload.ft_symbol:
                symbol, price = payload.ft_symbol, ft_price.fetch_ft_price_eur(payload.ft_symbol)
            else:
                symbol, price = ft_price.lookup_isin(isin)
        except Exception:
            symbol = price = None  # sin precio de FT queda a 0 y se puede poner a mano o con "Actualizar"
        if price is not None:
            inv.ft_symbol = symbol  # guarda el símbolo real (puede no ser ISIN:EUR) para las siguientes actualizaciones
            inv.current_price = price
            inv.price_updated_at = datetime.utcnow()
            _record_snapshot(inv, price)
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
    inv.isin = _clean_isin(payload.isin)
    inv.account = payload.account
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
    months = {(t.date.year, t.date.month) for t in inv.transactions}
    db.delete(inv)  # cascade deletes its transactions
    db.flush()
    for year, month in months:
        investment_movements.sync_month(db, year, month)
    db.commit()


@router.post("/{investment_id}/transactions", response_model=schemas.InvestmentOut)
def add_transaction(investment_id: int, payload: schemas.InvestmentTransactionCreate, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    inv.transactions.append(
        models.InvestmentTransaction(
            date=payload.date, units=payload.units, amount=payload.amount, kind=payload.kind, note=payload.note
        )
    )
    db.flush()
    investment_movements.sync_month(db, payload.date.year, payload.date.month)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.put("/{investment_id}/transactions/{transaction_id}", response_model=schemas.InvestmentOut)
def update_transaction(
    investment_id: int, transaction_id: int, payload: schemas.InvestmentTransactionCreate, db: Session = Depends(get_db)
):
    inv = _get(db, investment_id)
    tx = db.get(models.InvestmentTransaction, transaction_id)
    if not tx or tx.investment_id != investment_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    months = {(tx.date.year, tx.date.month), (payload.date.year, payload.date.month)}
    tx.date = payload.date
    tx.units = payload.units
    tx.amount = payload.amount
    tx.kind = payload.kind
    tx.note = payload.note
    db.flush()
    for year, month in months:
        investment_movements.sync_month(db, year, month)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.delete("/{investment_id}/transactions/{transaction_id}", response_model=schemas.InvestmentOut)
def delete_transaction(investment_id: int, transaction_id: int, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    tx = db.get(models.InvestmentTransaction, transaction_id)
    if not tx or tx.investment_id != investment_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    year, month = tx.date.year, tx.date.month
    db.delete(tx)
    db.flush()
    investment_movements.sync_month(db, year, month)
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
        price = ft_price.fetch_ft_price_eur(symbol)
    except Exception as e:
        return schemas.PriceRefreshResult(investment_id=inv.id, ok=False, error=str(e))
    inv.current_price = price
    inv.price_updated_at = datetime.utcnow()
    _record_snapshot(inv, price)
    db.flush()
    investment_movements.sync_current_month_revalorization(db)
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
            price = ft_price.fetch_ft_price_eur(symbol)
        except Exception as e:
            results.append(schemas.PriceRefreshResult(investment_id=inv.id, ok=False, error=str(e)))
            continue
        inv.current_price = price
        inv.price_updated_at = datetime.utcnow()
        _record_snapshot(inv, price)
        results.append(schemas.PriceRefreshResult(investment_id=inv.id, ok=True, price=price))
    db.flush()
    investment_movements.sync_current_month_revalorization(db)
    db.commit()
    return results


# ponytail: 10 years is "enough" ATH for index funds; FT's ajax takes any range, so
# raise this if a fund's real high predates it.
HISTORY_YEARS = 10
SYNC_THROTTLE = timedelta(minutes=10)


@router.post("/{investment_id}/sync-market", response_model=schemas.MarketSyncResult)
def sync_market(investment_id: int, db: Session = Depends(get_db)):
    """Refresh today's price and top up the daily history. One call per holding (the
    client fires them in parallel) so a first 10-year backfill of several funds
    doesn't have to fit in a single serverless request."""
    inv = _get(db, investment_id)
    symbol = ft_price.symbol_for(inv.ft_symbol, inv.isin)
    if not symbol:
        return schemas.MarketSyncResult(investment_id=inv.id, ok=False, error="Sin ISIN ni símbolo FT")
    # Los fondos que no cotizan en EUR guardaban su histórico en su moneda: se rehace una vez, ya en euros.
    marker = f"ft_eur_history_{inv.id}"
    if ft_price.currency_of(symbol) != "EUR" and db.get(models.Setting, marker) is None:
        db.query(models.PriceHistory).filter_by(investment_id=inv.id).delete()
        db.query(models.PriceSnapshot).filter_by(investment_id=inv.id).delete()
        db.add(models.Setting(key=marker, value="1"))
        db.flush()
        inv.price_updated_at = None  # sin esto el límite de 10 min se saltaría la descarga
    last = db.query(models.PriceHistory.date).filter_by(investment_id=inv.id).order_by(models.PriceHistory.date.desc()).first()
    if last and inv.price_updated_at and datetime.utcnow() - inv.price_updated_at < SYNC_THROTTLE:
        return schemas.MarketSyncResult(investment_id=inv.id, ok=True, skipped=True)
    today = date.today()
    start = last[0] + timedelta(days=1) if last else today.replace(year=today.year - HISTORY_YEARS)
    try:
        price = ft_price.fetch_ft_price_eur(symbol)
        rows = ft_price.fetch_ft_history_eur(symbol, start, today) if start <= today else []
    except Exception as e:
        return schemas.MarketSyncResult(investment_id=inv.id, ok=False, error=str(e))
    inv.current_price = price
    inv.price_updated_at = datetime.utcnow()
    _record_snapshot(inv, price)
    known = {d for (d,) in db.query(models.PriceHistory.date).filter(models.PriceHistory.investment_id == inv.id, models.PriceHistory.date >= start)}
    db.add_all(models.PriceHistory(investment_id=inv.id, date=d, price=p) for d, p in rows if d not in known)
    db.flush()
    investment_movements.sync_current_month_revalorization(db)
    db.commit()
    return schemas.MarketSyncResult(investment_id=inv.id, ok=True)


@router.get("/market", response_model=schemas.MarketOverview)
def market(db: Session = Depends(get_db)):
    settings = {s.key: s.value for s in db.query(models.Setting).all()}
    account = settings.get("liquidity_account") or None
    try:
        emergency = float(settings.get("emergency_fund") or 0)
    except ValueError:
        emergency = 0.0
    cat = db.query(models.Category).filter_by(name=account).first() if account else None
    balance = _live_balance(db, cat) if cat else None
    liquidity = schemas.Liquidity(
        account=account,
        balance=balance,
        emergency_fund=emergency,
        available=max(balance - emergency, 0.0) if balance is not None else None,
    )

    funds = []
    cutoff = date.today() - timedelta(days=365)
    for inv in db.query(models.Investment).filter_by(active=True).order_by(models.Investment.name):
        if inv.type in ("seguros", "roboadvisor") or not ft_price.symbol_for(inv.ft_symbol, inv.isin):
            continue
        points = {h.date: h.price for h in inv.price_history}
        if not points:
            continue  # FT never returned history for it (bad ISIN, manual-priced): nothing to chart
        if inv.current_price > 0:
            points[date.today()] = inv.current_price
        stats = investment_logic.holding_stats_for(inv)
        funds.append(
            schemas.MarketFund(
                investment_id=inv.id,
                name=inv.name,
                current_price=inv.current_price,
                price_updated_at=inv.price_updated_at,
                units_held=stats["units_held"],
                avg_cost=stats["avg_cost"] if stats["units_held"] > 0 else None,
                high_52w=max((p for d, p in points.items() if d >= cutoff), default=None),
                all_time_high=max(points.values()),
                series=[schemas.MarketPricePoint(date=d, price=p) for d, p in sorted(points.items())],
            )
        )
    return schemas.MarketOverview(liquidity=liquidity, funds=funds)


@router.get("/summary", response_model=schemas.PortfolioSummary)
def summary(db: Session = Depends(get_db)):
    investments = db.query(models.Investment).all()
    stats_list = [investment_logic.holding_stats_for(inv) for inv in investments]
    return schemas.PortfolioSummary(**investment_logic.portfolio_summary(stats_list))


@router.get("/composition", response_model=list[schemas.PortfolioCompositionItem])
def composition(db: Session = Depends(get_db)):
    investments = db.query(models.Investment).filter(models.Investment.active.is_(True)).all()
    pairs = [(inv, investment_logic.holding_stats_for(inv)) for inv in investments]
    return investment_logic.composition(pairs)


@router.get("/history", response_model=list[schemas.PortfolioHistoryPoint])
def history(type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Investment)
    if type:
        query = query.filter(models.Investment.type == type)
    holdings = [
        ("balance" if inv.type == "seguros" else "fund", inv.transactions, inv.snapshots) for inv in query.all()
    ]
    return investment_logic.extend_to_today(investment_logic.portfolio_time_series(holdings), date.today())


@router.get("/{investment_id}/history", response_model=list[schemas.PortfolioHistoryPoint])
def investment_history(investment_id: int, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    kind = "balance" if inv.type == "seguros" else "fund"
    series = investment_logic.portfolio_time_series([(kind, inv.transactions, inv.snapshots)])
    return investment_logic.extend_to_today(series, date.today())
