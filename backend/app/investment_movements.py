"""Movimiento mensual automático de revalorización del Panel de inversión:
"Revalorización mm/aaaa" lleva a la cuenta de destino (Ajustes) la plusvalía de toda la cartera: la diferencia
entre su "Valor actual" y su capital invertido, menos lo ya anotado como Revalorización/Devaluación en esa cuenta.
Las aportaciones NO se generan: son Movimientos que registra el usuario y el panel los ofrece para asignar a
fondos (account-check), así que la revalorización no depende de ellos.
Va fechado el día 29 (o el último del mes), desde la fecha de inicio de Ajustes, y se localiza por su concepto."""

import calendar
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import investment_logic, models
from .kpi_logic import category_name_sets, is_adjustment


def _settings(db: Session) -> dict[str, str]:
    return {s.key: s.value for s in db.query(models.Setting).all()}


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


def _portfolio_value_on(db: Session, d: date, today: date) -> float:
    """Valor de toda la cartera el día d: lo mismo que suma el "Valor actual" del panel."""
    total = 0.0
    for inv in db.query(models.Investment):
        prices = {h.date: h.price for h in inv.price_history}
        prices.update({s.date: s.price for s in inv.snapshots})  # lecturas propias mandan sobre el histórico
        kind = "balance" if inv.type == "seguros" else "fund"
        total += investment_logic.holding_value_on(kind, inv.transactions, sorted(prices.items()), inv.current_price, d, today)
    return total


def _portfolio_invested_on(db: Session, d: date) -> float:
    """Capital invertido de toda la cartera el día d (coste medio de lo que se tiene)."""
    total = 0.0
    for inv in db.query(models.Investment):
        kind = "balance" if inv.type == "seguros" else "fund"
        invertido, _ = investment_logic.value_at([(kind, inv.transactions, [])], d)
        total += invertido
    return total


def _adjustments_without(db: Session, account: str, month_end: date, concept: str) -> float:
    """Revalorizaciones/devaluaciones ya anotadas en la cuenta hasta month_end, salvo el movimiento `concept`."""
    names = category_name_sets(db)
    done = (
        db.query(models.Movement)
        .filter(
            models.Movement.status == models.MovementStatus.done,
            models.Movement.date <= month_end,
            models.Movement.concept != concept,
            (models.Movement.origin == account) | (models.Movement.destination == account),
        )
        .all()
    )
    return sum(m.amount for m in done if m.destination == account and is_adjustment(m.origin, names)) - sum(
        m.amount for m in done if m.origin == account and is_adjustment(m.destination, names)
    )


def sync_revalorization(db: Session, year: int, month: int) -> None:
    settings = _settings(db)
    account = settings.get("investment_destination_account")
    reval_cat, deval_cat = settings.get("investment_reval_category"), settings.get("investment_deval_category")
    if not account or not reval_cat or not deval_cat:
        return
    today = date.today()
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    end = min(month_end, today)
    concept = f"Revalorización {month:02d}/{year}"
    # se cuenta desde la fecha de inicio de Ajustes (la misma de la asignación pendiente); sin ella, desde la primera operación
    start = settings.get("investment_tracking_start")
    first = date.fromisoformat(start) if start else db.query(func.min(models.InvestmentTransaction.date)).scalar()
    if first is None or end < first:  # antes de empezar a contar: nada que reflejar
        _upsert(db, concept, year, month, None)
        return
    plusvalia = _portfolio_value_on(db, end, today) - _portfolio_invested_on(db, end)
    delta = plusvalia - _adjustments_without(db, account, month_end, concept)
    _upsert(db, concept, year, month, investment_logic.revalorization_movement(delta, reval_cat, deval_cat, account))


def _months_from(year: int, month: int, today: date):
    while (year, month) <= (today.year, today.month):
        yield year, month
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def sync_month(db: Session, year: int, month: int) -> None:
    """Llamar tras db.flush(): las consultas no ven cambios sin volcar (la sesión no hace autoflush).
    Cada revalorización depende de las anteriores, así que se rehacen también los meses siguientes."""
    for y, m in _months_from(year, month, date.today()):
        sync_revalorization(db, y, m)
        db.flush()


def sync_current_month_revalorization(db: Session) -> None:
    today = date.today()
    sync_revalorization(db, today.year, today.month)
