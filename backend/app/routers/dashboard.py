from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..kpi_logic import category_name_sets, kpi_amount, matches_kpi
from ..recurring_logic import generate_due_recurring

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _category_names(db: Session, category_type: models.CategoryType) -> set[str]:
    rows = db.query(models.Category.name).filter(models.Category.type == category_type).all()
    return {r[0] for r in rows}


def _month_end(year: int, month: int) -> date:
    first_next = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    return first_next - timedelta(days=1)


@router.get("/net-worth", response_model=list[schemas.NetWorthPoint])
def net_worth(months: int = 12, db: Session = Depends(get_db)):
    """Month-end net worth (Done movements only), split by account type.

    Balance of an account at date D = initial_balance + net of Done movements up to D.
    Only accounts tagged include_in_total count, matching the current total.
    """
    months = max(1, min(months, 600))
    accounts = (
        db.query(models.Category)
        .filter(models.Category.type.in_(models.ACCOUNT_TYPES), models.Category.include_in_total.is_(True))
        .all()
    )
    done = db.query(models.Movement).filter(models.Movement.status == models.MovementStatus.done).all()

    today = date.today()
    period: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(months):
        period.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    period.reverse()

    # ponytail: naive O(months·accounts·movements) — fine at this data size; index by account if it grows.
    points = []
    for (yy, mm) in period:
        end = _month_end(yy, mm)
        by_type: dict[str, float] = {}
        total = 0.0
        for acc in accounts:
            bal = acc.initial_balance + sum(
                mv.amount if mv.destination == acc.name else -mv.amount
                for mv in done
                if mv.date <= end and (mv.origin == acc.name or mv.destination == acc.name)
            )
            by_type[acc.type] = by_type.get(acc.type, 0.0) + bal
            total += bal
        points.append(schemas.NetWorthPoint(month=f"{yy:04d}-{mm:02d}", total=total, by_type=by_type))
    return points


def _months_in_range(from_date: date, to_date: date) -> list[tuple[int, int]]:
    months = []
    year, month = from_date.year, from_date.month
    while (year, month) <= (to_date.year, to_date.month):
        months.append((year, month))
        month += 1
        if month == 13:
            month = 1
            year += 1
    return months


def _budget_rows_in_range(db: Session, from_date: date, to_date: date) -> list[models.Budget]:
    months = _months_in_range(from_date, to_date)
    years = {y for y, _ in months}
    rows = db.query(models.Budget).filter(models.Budget.year.in_(years)).all()
    return [r for r in rows if (r.year, r.month) in months]


@router.get("/summary", response_model=schemas.DashboardSummary)
def summary(from_date: date, to_date: date, db: Session = Depends(get_db)):
    generate_due_recurring(db)
    names = category_name_sets(db)

    done = (
        db.query(models.Movement)
        .filter(
            models.Movement.date >= from_date,
            models.Movement.date <= to_date,
            models.Movement.status == models.MovementStatus.done,
        )
        .all()
    )

    totals = {
        kpi: sum(kpi_amount(m, kpi, names) for m in done if matches_kpi(m, kpi, names))
        for kpi in ("income", "expense", "saving", "investment")
    }

    # Passive income = income from a category flagged es_pasivo; the rest is active.
    income_passive = sum(
        kpi_amount(m, "income", names)
        for m in done
        if matches_kpi(m, "income", names) and m.origin in names["income_passive"]
    )

    budget_rows = _budget_rows_in_range(db, from_date, to_date)
    total_budget = sum(r.amount for r in budget_rows) if budget_rows else None

    return schemas.DashboardSummary(
        total_income=totals["income"],
        total_income_passive=income_passive,
        total_expenses=totals["expense"],
        total_savings=totals["saving"],
        total_investments=totals["investment"],
        total_budget=total_budget,
    )


@router.get("/monthly-series", response_model=list[schemas.MonthlyKpiPoint])
def monthly_series(months: int = 12, db: Session = Depends(get_db)):
    """Per-calendar-month KPI totals (Done only) for the last N months — powers the
    home trend charts and tile deltas."""
    months = max(1, min(months, 120))
    names = category_name_sets(db)

    today = date.today()
    period: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(months):
        period.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    period.reverse()
    years = {yy for yy, _ in period}

    done = (
        db.query(models.Movement)
        .filter(models.Movement.status == models.MovementStatus.done, models.Movement.year.in_(years))
        .all()
    )
    budgets = db.query(models.Budget).filter(models.Budget.year.in_(years)).all()

    points = []
    for (yy, mm) in period:
        month_mv = [mv for mv in done if mv.year == yy and mv.month == mm]
        totals = {
            kpi: sum(kpi_amount(mv, kpi, names) for mv in month_mv if matches_kpi(mv, kpi, names))
            for kpi in ("income", "expense", "saving", "investment")
        }
        budget = sum(b.amount for b in budgets if b.year == yy and b.month == mm)
        points.append(
            schemas.MonthlyKpiPoint(
                month=f"{yy:04d}-{mm:02d}",
                income=totals["income"],
                expense=totals["expense"],
                saving=totals["saving"],
                investment=totals["investment"],
                budget=budget,
            )
        )
    return points


def _rollup_names(db: Session) -> dict[str, str]:
    """Category name -> its top-level name (itself if it has no parent). Subcategory
    spend/budget rolls up into the parent category everywhere this app reports by category."""
    rows = db.query(models.Category.id, models.Category.name, models.Category.parent_id).all()
    name_by_id = {r.id: r.name for r in rows}
    return {r.name: name_by_id.get(r.parent_id, r.name) for r in rows}


@router.get("/budget-vs-actual", response_model=list[schemas.BudgetVsActualItem])
def budget_vs_actual(from_date: date, to_date: date, db: Session = Depends(get_db)):
    expense_names = _category_names(db, models.CategoryType.expense)
    rollup = _rollup_names(db)

    done = (
        db.query(models.Movement)
        .filter(
            models.Movement.date >= from_date,
            models.Movement.date <= to_date,
            models.Movement.status == models.MovementStatus.done,
            models.Movement.destination.in_(expense_names),
        )
        .all()
    )

    by_category: dict[str, dict[str, float]] = {}
    for m in done:
        category = rollup.get(m.destination, m.destination)
        by_category.setdefault(category, {"planned": 0.0, "actual": 0.0})["actual"] += m.amount

    for r in _budget_rows_in_range(db, from_date, to_date):
        category = rollup.get(r.category, r.category)
        by_category.setdefault(category, {"planned": 0.0, "actual": 0.0})["planned"] += r.amount

    return sorted(
        (schemas.BudgetVsActualItem(category=category, planned=v["planned"], actual=v["actual"]) for category, v in by_category.items()),
        key=lambda item: item.planned + item.actual,
        reverse=True,
    )
