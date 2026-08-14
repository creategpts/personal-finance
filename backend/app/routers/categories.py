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


def _validate_parent(payload: schemas.CategoryCreate, db: Session, self_id: int | None):
    if payload.parent_id is None:
        return
    if payload.type != "expense":
        raise HTTPException(status_code=400, detail="Solo las categorías de gasto pueden tener subcategoría")
    if payload.parent_id == self_id:
        raise HTTPException(status_code=400, detail="Una categoría no puede ser su propia categoría principal")
    if self_id is not None:
        own_children = db.query(models.Category).filter(models.Category.parent_id == self_id).count()
        if own_children:
            raise HTTPException(status_code=400, detail="Tiene subcategorías: no puede convertirse en subcategoría de otra")
    parent = db.get(models.Category, payload.parent_id)
    if not parent or parent.type != "expense":
        raise HTTPException(status_code=400, detail="Categoría principal inválida")
    if parent.parent_id is not None:
        raise HTTPException(status_code=400, detail="Una subcategoría no puede tener a su vez subcategorías")


@router.get("", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.post("", response_model=schemas.CategoryOut)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    _validate_type(payload.type)
    _validate_parent(payload, db, self_id=None)
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
    _validate_parent(payload, db, self_id=category_id)
    if payload.type != "expense":
        children = db.query(models.Category).filter(models.Category.parent_id == category_id).count()
        if children:
            raise HTTPException(status_code=400, detail="Tiene subcategorías: no se puede cambiar el tipo")
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
    children = db.query(models.Category).filter(models.Category.parent_id == category_id).count()
    if children:
        raise HTTPException(status_code=400, detail=f"Tiene {children} subcategoría(s): bórralas primero")
    db.delete(category)
    db.commit()
