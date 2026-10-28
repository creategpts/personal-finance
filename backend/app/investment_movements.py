"""Movimientos mensuales automáticos del Panel de inversión, entre las Cuentas de Ajustes:
  - "Inversión mm/aaaa": neto de aportaciones menos ventas del mes (origen -> destino).
  - "Revalorización mm/aaaa": lo que falta para que el saldo de la cuenta de destino (saldo inicial más
    todos sus movimientos) sea igual al "Valor actual" del panel de Inversión, con todas sus holdings.
Las aportaciones automáticas son solo de fondos de inversión: las de cripto, MMPP, seguros y roboadvisor
se registran a mano, y la revalorización absorbe lo que su valor aporte.
Las operaciones de tipo "opening" (posición inicial: cartera que ya tenías y que ya está contabilizada en la cuenta)
cuentan en capital invertido y plusvalía, pero no generan movimiento.
Ambos van fechados el día 29 (o el último del mes), desde la primera operación, y se localizan por su concepto."""

import calendar
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import investment_logic, models

FUND_TYPE = "fondo_inversion"


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


def _month_flows(db: Session, first: date, end: date) -> float:
    return sum(
        t.amount
        for t in db.query(models.InvestmentTransaction)
        .join(models.Investment)
        .filter(
            models.Investment.type == FUND_TYPE,
            models.InvestmentTransaction.kind == "flow",
            models.InvestmentTransaction.date >= first,
            models.InvestmentTransaction.date <= end,
        )
    )


def _portfolio_value_on(db: Session, d: date, today: date) -> float:
    """Valor de toda la cartera el día d: lo mismo que suma el "Valor actual" del panel."""
    total = 0.0
    for inv in db.query(models.Investment):
        prices = {h.date: h.price for h in inv.price_history}
        prices.update({s.date: s.price for s in inv.snapshots})  # lecturas propias mandan sobre el histórico
        kind = "balance" if inv.type == "seguros" else "fund"
        total += investment_logic.holding_value_on(kind, inv.transactions, sorted(prices.items()), inv.current_price, d, today)
    return total


def _balance_without(db: Session, account: str, month_end: date, concept: str) -> float:
    """Saldo de la cuenta como lo calcula la app (saldo inicial + movimientos hechos), salvo el movimiento `concept`."""
    category = db.query(models.Category).filter_by(name=account).first()
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
    return (category.initial_balance if category else 0.0) + sum(m.amount if m.destination == account else -m.amount for m in done)


def sync_contribution(db: Session, year: int, month: int) -> None:
    settings = _settings(db)
    origin, destination = settings.get("investment_origin_account"), settings.get("investment_destination_account")
    if not origin or not destination:
        return
    end = date(year, month, calendar.monthrange(year, month)[1])
    net = _month_flows(db, date(year, month, 1), end)
    _upsert(db, f"Inversión {month:02d}/{year}", year, month, investment_logic.monthly_movement(net, origin, destination))


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
    first_op = db.query(func.min(models.InvestmentTransaction.date)).scalar()
    if first_op is None or end < first_op:  # sin cartera todavía (o sin operaciones): nada que reflejar
        _upsert(db, concept, year, month, None)
        return
    delta = _portfolio_value_on(db, end, today) - _balance_without(db, account, month_end, concept)
    _upsert(db, concept, year, month, investment_logic.revalorization_movement(delta, reval_cat, deval_cat, account))


def _months_from(year: int, month: int, today: date):
    while (year, month) <= (today.year, today.month):
        yield year, month
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def sync_month(db: Session, year: int, month: int) -> None:
    """Llamar tras db.flush(): las consultas no ven cambios sin volcar (la sesión no hace autoflush).
    Cada revalorización depende de los movimientos anteriores, así que se rehacen también los meses siguientes."""
    sync_contribution(db, year, month)
    db.flush()
    for y, m in _months_from(year, month, date.today()):
        sync_revalorization(db, y, m)
        db.flush()


def sync_current_month_revalorization(db: Session) -> None:
    today = date.today()
    sync_revalorization(db, today.year, today.month)
