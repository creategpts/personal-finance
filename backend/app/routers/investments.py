from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ft_price, investment_logic, models, schemas
from ..database import get_db
from ..kpi_logic import _is_valuation_adjustment, category_name_sets

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
        account=payload.account,
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
    db.delete(inv)  # cascade deletes its transactions
    db.commit()


@router.post("/{investment_id}/transactions", response_model=schemas.InvestmentOut)
def add_transaction(investment_id: int, payload: schemas.InvestmentTransactionCreate, db: Session = Depends(get_db)):
    inv = _get(db, investment_id)
    inv.transactions.append(
        models.InvestmentTransaction(
            date=payload.date, units=payload.units, amount=payload.amount, kind=payload.kind, note=payload.note
        )
    )
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
    tx.date = payload.date
    tx.units = payload.units
    tx.amount = payload.amount
    tx.kind = payload.kind
    tx.note = payload.note
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
    stats_list = [investment_logic.holding_stats_for(inv) for inv in investments]
    return schemas.PortfolioSummary(**investment_logic.portfolio_summary(stats_list))


@router.get("/composition", response_model=list[schemas.PortfolioCompositionItem])
def composition(db: Session = Depends(get_db)):
    investments = db.query(models.Investment).filter(models.Investment.active.is_(True)).all()
    pairs = [(inv, investment_logic.holding_stats_for(inv)) for inv in investments]
    return investment_logic.composition(pairs)


def _is_adjustment(name: str, names: dict[str, set[str]]) -> bool:
    """A valuation adjustment (Revalorización/Devaluación), or an origin/destination
    that isn't a recognized category or account at all — e.g. "New Asset", a
    one-off bootstrap entry from a category since renamed or deleted. Neither
    represents real capital that needs reconciling against a fund purchase."""
    if _is_valuation_adjustment(name, names):
        return True
    known = names["income_all"] | names["expense_all"] | names["saving"] | names["investment"] | names["gasto"]
    return name not in known


def _tracking_start(db: Session) -> date:
    """Fixed epoch, not a rolling window: everything before it is permanently
    ignored by account_check, whatever it is — "empezamos a contar desde
    ahora". Self-initializes to today on first call, then never moves."""
    setting = db.get(models.Setting, "investment_tracking_start")
    if setting:
        return date.fromisoformat(setting.value)
    today = date.today()
    db.add(models.Setting(key="investment_tracking_start", value=today.isoformat()))
    db.commit()
    return today


def _account_check_item(db: Session, account: str, names: dict[str, set[str]], cutoff: date) -> schemas.AccountCheckItem | None:
    done_movements = (
        db.query(models.Movement)
        .filter(
            models.Movement.status == models.MovementStatus.done,
            models.Movement.date >= cutoff,
            (models.Movement.destination == account) | (models.Movement.origin == account),
        )
        .all()
    )
    investment_ids = [inv.id for inv in db.query(models.Investment).filter(models.Investment.account == account)]
    transactions = (
        db.query(models.InvestmentTransaction)
        .filter(models.InvestmentTransaction.investment_id.in_(investment_ids), models.InvestmentTransaction.date >= cutoff)
        .all()
        if investment_ids
        else []
    )

    net_moved = sum(
        m.amount for m in done_movements if m.destination == account and not _is_adjustment(m.origin, names)
    ) - sum(
        m.amount for m in done_movements if m.origin == account and not _is_adjustment(m.destination, names)
    )
    contributed = sum(t.amount for t in transactions)
    if net_moved == 0 and contributed == 0:
        return None
    return schemas.AccountCheckItem(account=account, net_moved=net_moved, contributed=contributed, difference=net_moved - contributed)


@router.get("/account-check", response_model=list[schemas.AccountCheckItem])
def account_check(db: Session = Depends(get_db)):
    names = category_name_sets(db)
    cutoff = _tracking_start(db)
    inversion_accounts = [c.name for c in db.query(models.Category).filter(models.Category.type == "inversion").all()]
    items = (_account_check_item(db, account, names, cutoff) for account in inversion_accounts)
    return [item for item in items if item is not None]


@router.post("/account-check/{account}/assign", response_model=list[schemas.AccountCheckItem])
def assign_pending(account: str, payload: schemas.AssignPendingRequest, db: Session = Depends(get_db)):
    names = category_name_sets(db)
    cutoff = _tracking_start(db)
    item = _account_check_item(db, account, names, cutoff)
    if item is None or abs(item.difference) < 0.01:
        raise HTTPException(status_code=400, detail="Nada pendiente de asignar en esta cuenta")

    total_allocated = sum(a.amount for a in payload.allocations)
    if not investment_logic.allocation_matches(item.difference, total_allocated):
        raise HTTPException(status_code=422, detail="El reparto no cuadra con el importe pendiente")

    active_by_id = {
        inv.id: inv
        for inv in db.query(models.Investment).filter(models.Investment.account == account, models.Investment.active.is_(True))
    }
    for alloc in payload.allocations:
        inv = active_by_id.get(alloc.investment_id)
        if not inv:
            raise HTTPException(status_code=422, detail=f"La inversión {alloc.investment_id} no es una holding activa de {account}")
        is_lump_sum = inv.type == "seguros"
        units = 0.0 if is_lump_sum else (alloc.amount / alloc.price if alloc.price else 0.0)
        inv.transactions.append(models.InvestmentTransaction(date=payload.date, units=units, amount=alloc.amount, kind="flow"))

    db.commit()
    return account_check(db)


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
