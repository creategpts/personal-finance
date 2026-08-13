from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _validate_type(type_: str):
    valid = set(models.FLOW_TYPES) | set(models.ACCOUNT_TYPES)
    if type_ not in valid:
        raise HTTPException(status_code=400, detail=f"Tipo inválido: {type_}")


@router.get("", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.post("", response_model=schemas.CategoryOut)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    _validate_type(payload.type)
    category = models.Category(**payload.model_dump())
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=schemas.CategoryOut)
def update_category(category_id: int, payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    category = db.get(models.Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    _validate_type(payload.type)
    old_name = category.name
    for key, value in payload.model_dump().items():
        setattr(category, key, value)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")

    # Movement/Budget reference a category by name, not id — a rename must
    # cascade to them or every existing entry silently orphans.
    if payload.name != old_name:
        db.query(models.Movement).filter(models.Movement.origin == old_name).update(
            {"origin": payload.name}
        )
        db.query(models.Movement).filter(models.Movement.destination == old_name).update(
            {"destination": payload.name}
        )
        db.query(models.Budget).filter(models.Budget.category == old_name).update(
            {"category": payload.name}
        )

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(models.Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
