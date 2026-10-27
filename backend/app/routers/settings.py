from datetime import date

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
    # El movimiento mensual de inversión cuenta desde el día en que se configuran las dos cuentas;
    # volver a guardarlas no mueve esa fecha.
    db.flush()
    current = _all(db)
    if (
        current.get("investment_origin_account")
        and current.get("investment_destination_account")
        and "investment_movement_start" not in current
    ):
        db.add(models.Setting(key="investment_movement_start", value=date.today().isoformat()))
    db.commit()
    return _all(db)
