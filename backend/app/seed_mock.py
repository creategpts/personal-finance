"""Wipes the DB and loads generic mock data for local dev / demos.

Run with: python -m app.seed_mock   (from backend/)

ponytail: hand-rolled fixtures, no faker dependency for ~60 rows of data.
"""

import datetime
import random

from . import models
from .database import Base, SessionLocal, engine
from .seed import DEFAULT_CATEGORIES, PASSIVE_INCOME

random.seed(42)  # deterministic mock data across runs

MOCK_ACCOUNTS = ("Efectivo", "Ahorro", "Inversión")

EXPENSE_PLAN = [
    ("Vivienda", 650.0, 700.0),
    ("Alimentación", 220.0, 320.0),
    ("Transporte", 40.0, 90.0),
    ("Ocio", 60.0, 180.0),
    ("Salud", 0.0, 60.0),
    ("Suscripciones", 25.0, 35.0),
    ("Otros gastos", 0.0, 80.0),
]

MONTHLY_SALARY = 2200.0
MONTHLY_MOVEMENTS_TO_SAVING = 300.0
MONTHLY_MOVEMENTS_TO_INVEST = 150.0


def _iso_week(d):
    return d.isocalendar()[1]


def wipe(db):
    for model in (
        models.GoalTarget,
        models.Goal,
        models.RecurringExpense,
        models.Budget,
        models.Movement,
        models.Category,
        models.Setting,
    ):
        db.query(model).delete()
    db.commit()


def seed_categories(db):
    for name, type_ in DEFAULT_CATEGORIES:
        db.add(models.Category(name=name, type=type_, es_pasivo=name in PASSIVE_INCOME))
    db.commit()


def seed_settings(db):
    for key, value in [
        ("app_name", "Life Track"),
        ("user_name", "Usuario Demo"),
        ("favicon", "\U0001f4b0"),
        ("kpi_net_flow", "1"),
    ]:
        db.add(models.Setting(key=key, value=value))
    db.commit()


def _add_movement(db, concept, amount, status, date, origin, destination):
    db.add(
        models.Movement(
            concept=concept,
            amount=amount,
            status=status,
            date=date,
            year=date.year,
            month=date.month,
            week=_iso_week(date),
            origin=origin,
            destination=destination,
        )
    )


def seed_movements(db, months=6):
    today = datetime.date.today()
    first_of_this_month = today.replace(day=1)

    for back in range(months, -1, -1):
        year = first_of_this_month.year
        month = first_of_this_month.month - back
        while month < 1:
            month += 12
            year -= 1
        is_current_month = back == 0
        status = models.MovementStatus.plan if is_current_month else models.MovementStatus.done

        _add_movement(db, "Nómina", MONTHLY_SALARY, status, datetime.date(year, month, 25), "Sueldo", "Efectivo")
        _add_movement(
            db, "Aporte ahorro mensual", MONTHLY_MOVEMENTS_TO_SAVING, status,
            datetime.date(year, month, 26), "Efectivo", "Ahorro",
        )
        _add_movement(
            db, "Aporte inversión mensual", MONTHLY_MOVEMENTS_TO_INVEST, status,
            datetime.date(year, month, 26), "Efectivo", "Inversión",
        )

        for category, lo, hi in EXPENSE_PLAN:
            amount = round(random.uniform(lo, hi), 2)
            if amount <= 0:
                continue
            day = random.randint(1, 28)
            _add_movement(db, f"Gasto {category.lower()}", amount, status, datetime.date(year, month, day), "Efectivo", category)

        if random.random() < 0.5:
            _add_movement(
                db, "Intereses cuenta ahorro", round(random.uniform(2, 8), 2), status,
                datetime.date(year, month, 28), "Intereses", "Ahorro",
            )

    db.commit()


def seed_budgets(db, months=6):
    today = datetime.date.today()
    first_of_this_month = today.replace(day=1)
    for back in range(months, -1, -1):
        year = first_of_this_month.year
        month = first_of_this_month.month - back
        while month < 1:
            month += 12
            year -= 1
        for category, lo, hi in EXPENSE_PLAN:
            db.add(models.Budget(year=year, month=month, category=category, amount=round((lo + hi) / 2, 2)))
    db.commit()


def seed_recurring(db):
    today = datetime.date.today()
    next_month = (today.replace(day=1) + datetime.timedelta(days=32)).replace(day=1)
    db.add(
        models.RecurringExpense(
            concept="Alquiler",
            amount=680.0,
            origin="Efectivo",
            destination="Vivienda",
            frequency=models.RecurrenceFrequency.monthly,
            next_due_date=next_month,
            active=True,
            auto_generate=True,
        )
    )
    db.add(
        models.RecurringExpense(
            concept="Suscripción streaming",
            amount=14.99,
            origin="Efectivo",
            destination="Suscripciones",
            frequency=models.RecurrenceFrequency.monthly,
            next_due_date=next_month,
            active=True,
            auto_generate=True,
        )
    )
    db.commit()


def seed_goals(db):
    today = datetime.date.today()
    start = today.replace(day=1) - datetime.timedelta(days=150)
    goal = models.Goal(
        name="Fondo de emergencia",
        account="Ahorro",
        type="fixed",
        active=True,
        start_year=start.year,
        start_month=start.month,
    )
    goal.targets.append(
        models.GoalTarget(eff_year=start.year, eff_month=start.month, amount=MONTHLY_MOVEMENTS_TO_SAVING)
    )
    db.add(goal)
    db.commit()


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        wipe(db)
        seed_categories(db)
        seed_settings(db)
        seed_movements(db)
        seed_budgets(db)
        seed_recurring(db)
        seed_goals(db)
        print("Mock data loaded.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
