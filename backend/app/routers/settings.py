from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _all(db: Session) -> dict[str, str]:
    return {s.key: s.value for s in db.query(models.Setting).all()}


@router.get("")
def get_settings(db: Session = Depends(get_db)) -> dict[str, str]:
    return _all(db)


@router.put("")
def put_settings(payload: dict[str, str], db: Session = Depends(get_db)) -> dict[str, str]:
    for key, value in payload.items():
        setting = db.get(models.Setting, key)
        if setting:
            setting.value = value
        else:
            db.add(models.Setting(key=key, value=value))
    db.commit()
    return _all(db)
