from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import investment_logic, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/account-values", tags=["account-values"])


def _live_balance(db: Session, category: models.Category) -> float:
    done = (
        db.query(models.Movement)
        .filter(
            models.Movement.status == models.MovementStatus.done,
            (models.Movement.origin == category.name) | (models.Movement.destination == category.name),
        )
        .all()
    )
    net = sum(m.amount if m.destination == category.name else -m.amount for m in done)
    return category.initial_balance + net


@router.get("/latest", response_model=schemas.AccountSnapshot | None)
def latest(db: Session = Depends(get_db)):
    accounts = db.query(models.Category).filter(models.Category.type.in_(models.ACCOUNT_TYPES)).all()
    portfolio_account = db.get(models.Setting, "investment_destination_account")
    portfolio_name = portfolio_account.value if portfolio_account else None

    def amount(c: models.Category) -> float:
        # la cuenta de la cartera vale lo que valen hoy sus fondos, no lo apuntado hasta la última revalorización mensual
        if c.name == portfolio_name:
            stats = [investment_logic.holding_stats_for(inv) for inv in db.query(models.Investment).all()]
            return investment_logic.portfolio_summary(stats)["valor_actual"]
        return _live_balance(db, c)

    items = [schemas.AccountValueItem(category=c.name, amount=amount(c)) for c in accounts]
    total_assets = sum(i.amount for i, c in zip(items, accounts) if c.include_in_total)
    return schemas.AccountSnapshot(date=date.today(), items=items, total_assets=total_assets)
