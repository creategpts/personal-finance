from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
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
    items = [schemas.AccountValueItem(category=c.name, amount=_live_balance(db, c)) for c in accounts]
    total_assets = sum(i.amount for i, c in zip(items, accounts) if c.include_in_total)
    return schemas.AccountSnapshot(date=date.today(), items=items, total_assets=total_assets)
