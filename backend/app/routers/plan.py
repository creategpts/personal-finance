from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, plan_logic, schemas
from ..database import get_db

router = APIRouter(prefix="/api/plan", tags=["plan"])


@router.get("", response_model=schemas.PlanVersionOut | None)
def get_plan(db: Session = Depends(get_db)):
    return plan_logic.current(db)


@router.get("/versions", response_model=list[schemas.PlanVersionOut])
def list_versions(db: Session = Depends(get_db)):
    return db.query(models.PlanVersion).order_by(models.PlanVersion.id.desc()).all()


@router.post("", response_model=schemas.PlanVersionOut)
def save_plan(payload: schemas.PlanVersionIn, db: Session = Depends(get_db)):
    data = payload.data.model_dump()
    version = models.PlanVersion(reason=payload.reason, data=data)
    db.add(version)
    db.flush()
    plan_logic.sync(db, data, date.today())
    db.commit()
    db.refresh(version)
    return version


@router.get("/shots", response_model=list[schemas.DipShotOut])
def list_shots(phase_index: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.DipShot)
    if phase_index is not None:
        q = q.filter(models.DipShot.phase_index == phase_index)
    return q.order_by(models.DipShot.id.desc()).all()


@router.post("/shots", response_model=schemas.DipShotOut)
def fire_shot(payload: schemas.DipShotIn, db: Session = Depends(get_db)):
    shot = models.DipShot(**payload.model_dump())
    db.add(shot)
    db.commit()
    db.refresh(shot)
    return shot


@router.delete("/shots/{shot_id}", status_code=204)
def undo_shot(shot_id: int, db: Session = Depends(get_db)):
    shot = db.get(models.DipShot, shot_id)
    if not shot:
        raise HTTPException(404, "Disparo no encontrado")
    db.delete(shot)
    db.commit()
