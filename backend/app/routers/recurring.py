from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..recurring_logic import generate_due_recurring

router = APIRouter(prefix="/api/recurring", tags=["recurring"])


@router.get("", response_model=list[schemas.RecurringExpenseOut])
def list_recurring(db: Session = Depends(get_db)):
    generate_due_recurring(db)
    return db.query(models.RecurringExpense).order_by(models.RecurringExpense.next_due_date).all()


@router.post("", response_model=schemas.RecurringExpenseOut)
def create_recurring(payload: schemas.RecurringExpenseCreate, db: Session = Depends(get_db)):
    plan = models.RecurringExpense(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.put("/{plan_id}", response_model=schemas.RecurringExpenseOut)
def update_recurring(plan_id: int, payload: schemas.RecurringExpenseCreate, db: Session = Depends(get_db)):
    plan = db.get(models.RecurringExpense, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Recurring expense not found")
    for key, value in payload.model_dump().items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=204)
def delete_recurring(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.RecurringExpense, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Recurring expense not found")
    db.delete(plan)
    db.commit()
