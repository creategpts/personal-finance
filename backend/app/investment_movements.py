"""Movimientos mensuales automáticos del Panel de inversión, entre las Cuentas de Ajustes:
  - "Inversión mm/aaaa": neto de aportaciones menos ventas del mes (origen -> destino).
  - "Revalorización mm/aaaa": cambio de valor de la cartera en el mes menos lo aportado,
    para que el saldo de la cuenta de destino siga el valor real.
Ambos van fechados el día 29 (o el último del mes), solo cuentan desde investment_movement_start
(el día en que se configuraron las cuentas; nunca se hace backfill) y se localizan por su concepto."""

import calendar
from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import investment_logic, models


def _settings(db: Session) -> dict[str, str]:
    return {s.key: s.value for s in db.query(models.Setting).all()}


def _started(db: Session, settings: dict[str, str]) -> date:
    started = settings.get("investment_movement_start")
    if not started:  # cuentas guardadas antes de existir la fecha de inicio: empieza hoy
        started = date.today().isoformat()
        db.add(models.Setting(key="investment_movement_start", value=started))
        db.flush()  # sin autoflush, la segunda sincronización del mismo cambio no la vería y la insertaría otra vez
    return date.fromisoformat(started)


def _upsert(db: Session, concept: str, year: int, month: int, plan) -> None:
    existing = db.query(models.Movement).filter_by(concept=concept, year=year, month=month).first()
    if plan is None:
        if existing:
            db.delete(existing)
        return
    origin, destination, amount = plan
    when = investment_logic.monthly_movement_date(year, month)
    movement = existing or models.Movement(concept=concept, status=models.MovementStatus.done)
    movement.amount, movement.origin, movement.destination = amount, origin, destination
    movement.date, movement.year, movement.month, movement.week = when, year, month, when.isocalendar()[1]
    if not existing:
        db.add(movement)


def _month_flows(db: Session, first: date, end: date) -> float:
    return sum(
        t.amount
        for t in db.query(models.InvestmentTransaction).filter(
            models.InvestmentTransaction.kind == "flow",
            models.InvestmentTransaction.date >= first,
            models.InvestmentTransaction.date <= end,
        )
    )


def _portfolio_value_on(db: Session, d: date, today: date) -> float:
    total = 0.0
    for inv in db.query(models.Investment).all():
        prices = {h.date: h.price for h in inv.price_history}
        prices.update({s.date: s.price for s in inv.snapshots})  # lecturas propias mandan sobre el histórico
        kind = "balance" if inv.type == "seguros" else "fund"
        total += investment_logic.holding_value_on(kind, inv.transactions, sorted(prices.items()), inv.current_price, d, today)
    return total


def sync_contribution(db: Session, year: int, month: int) -> None:
    settings = _settings(db)
    origin, destination = settings.get("investment_origin_account"), settings.get("investment_destination_account")
    if not origin or not destination:
        return
    first = max(date(year, month, 1), _started(db, settings))
    end = date(year, month, calendar.monthrange(year, month)[1])
    net = _month_flows(db, first, end)
    _upsert(db, f"Inversión {month:02d}/{year}", year, month, investment_logic.monthly_movement(net, origin, destination))


def sync_revalorization(db: Session, year: int, month: int) -> None:
    settings = _settings(db)
    account = settings.get("investment_destination_account")
    reval_cat, deval_cat = settings.get("investment_reval_category"), settings.get("investment_deval_category")
    if not account or not reval_cat or not deval_cat:
        return
    started = _started(db, settings)
    today = date.today()
    first = date(year, month, 1)
    end = min(date(year, month, calendar.monthrange(year, month)[1]), today)
    if end < started:  # mes futuro o anterior al inicio: nada que reflejar
        return
    opening = max(first, started) - timedelta(days=1)
    delta = _portfolio_value_on(db, end, today) - _portfolio_value_on(db, opening, today) - _month_flows(db, max(first, started), end)
    _upsert(db, f"Revalorización {month:02d}/{year}", year, month, investment_logic.revalorization_movement(delta, reval_cat, deval_cat, account))


def sync_month(db: Session, year: int, month: int) -> None:
    """Llamar tras db.flush(): las consultas no ven cambios sin volcar (la sesión no hace autoflush)."""
    sync_contribution(db, year, month)
    sync_revalorization(db, year, month)


def sync_current_month_revalorization(db: Session) -> None:
    today = date.today()
    sync_revalorization(db, today.year, today.month)
