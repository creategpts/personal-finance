from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("", response_model=list[schemas.BudgetItem])
def get_budget(year: int, month: int, db: Session = Depends(get_db)):
    rows = db.query(models.Budget).filter_by(year=year, month=month).all()
    return [schemas.BudgetItem(category=r.category, amount=r.amount) for r in rows]


@router.put("", response_model=list[schemas.BudgetItem])
def set_budget(year: int, month: int, payload: schemas.BudgetSet, db: Session = Depends(get_db)):
    db.query(models.Budget).filter_by(year=year, month=month).delete()
    for item in payload.items:
        if item.amount:
            db.add(models.Budget(year=year, month=month, category=item.category, amount=item.amount))
    db.commit()
    rows = db.query(models.Budget).filter_by(year=year, month=month).all()
    return [schemas.BudgetItem(category=r.category, amount=r.amount) for r in rows]


@router.delete("", status_code=204)
def clear_budget(year: int, month: int, db: Session = Depends(get_db)):
    db.query(models.Budget).filter_by(year=year, month=month).delete()
    db.commit()
