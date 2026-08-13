import calendar
from datetime import date

from sqlalchemy.orm import Session

from . import models

_MONTHS_BY_FREQUENCY = {
    models.RecurrenceFrequency.monthly: 1,
    models.RecurrenceFrequency.quarterly: 3,
    models.RecurrenceFrequency.yearly: 12,
}


def _advance(d: date, frequency: models.RecurrenceFrequency) -> date:
    months = _MONTHS_BY_FREQUENCY[frequency]
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def generate_due_recurring(db: Session) -> None:
    today = date.today()
    plans = (
        db.query(models.RecurringExpense)
        .filter(models.RecurringExpense.active == True)  # noqa: E712
        .filter(models.RecurringExpense.auto_generate == True)  # noqa: E712
        .all()
    )
    changed = False
    for plan in plans:
        while plan.next_due_date <= today:
            due = plan.next_due_date
            year, week, _ = due.isocalendar()
            db.add(
                models.Movement(
                    concept=plan.concept,
                    amount=plan.amount,
                    status=models.MovementStatus.plan,
                    date=due,
                    year=due.year,
                    month=due.month,
                    week=week,
                    origin=plan.origin,
                    destination=plan.destination,
                )
            )
            plan.next_due_date = _advance(due, plan.frequency)
            changed = True
    if changed:
        db.commit()
