from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..kpi_logic import KPI_NAMES, category_name_sets, matches_kpi
from ..recurring_logic import generate_due_recurring

router = APIRouter(prefix="/api/movements", tags=["movements"])


def _derived_fields(d):
    year, week, _ = d.isocalendar()
    return {"year": d.year, "month": d.month, "week": week}


@router.get("", response_model=list[schemas.MovementOut])
def list_movements(
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[models.MovementStatus] = None,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    kpi: Optional[str] = None,
    db: Session = Depends(get_db),
):
    generate_due_recurring(db)
    query = db.query(models.Movement)
    if year is not None:
        query = query.filter(models.Movement.year == year)
    if month is not None:
        query = query.filter(models.Movement.month == month)
    if kpi is not None:
        # KPI totals only ever count Done movements — filter to match.
        query = query.filter(models.Movement.status == models.MovementStatus.done)
    elif status is not None:
        query = query.filter(models.Movement.status == status)
    if origin is not None:
        query = query.filter(models.Movement.origin == origin)
    if destination is not None:
        query = query.filter(models.Movement.destination == destination)

    rows = query.order_by(models.Movement.date.desc()).all()

    if kpi is not None and kpi in KPI_NAMES:
        names = category_name_sets(db)
        rows = [m for m in rows if matches_kpi(m, kpi, names)]

    return rows


@router.post("", response_model=schemas.MovementOut)
def create_movement(payload: schemas.MovementCreate, db: Session = Depends(get_db)):
    movement = models.Movement(**payload.model_dump(), **_derived_fields(payload.date))
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


@router.put("/{movement_id}", response_model=schemas.MovementOut)
def update_movement(movement_id: int, payload: schemas.MovementCreate, db: Session = Depends(get_db)):
    movement = db.get(models.Movement, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    for key, value in payload.model_dump().items():
        setattr(movement, key, value)
    for key, value in _derived_fields(payload.date).items():
        setattr(movement, key, value)
    db.commit()
    db.refresh(movement)
    return movement


@router.delete("", status_code=204)
def delete_all_movements(db: Session = Depends(get_db)):
    """Wipe every movement — used by the CSV 'restore' (wipe + reimport)."""
    db.query(models.Movement).delete()
    db.commit()


@router.delete("/{movement_id}", status_code=204)
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    movement = db.get(models.Movement, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    db.delete(movement)
    db.commit()
