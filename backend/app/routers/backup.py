import json
import os
import time
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Date, DateTime
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/backup", tags=["backup"])

# Default: sibling of the project folder (.../projects/finance -> .../projects/backup).
# Override with the LIFETRACK_BACKUP_DIR env var.
DEFAULT_BACKUP_DIR = Path(__file__).resolve().parents[3].parent / "backup"
BACKUP_DIR = Path(os.environ.get("LIFETRACK_BACKUP_DIR", str(DEFAULT_BACKUP_DIR)))

WEEKLY_SECONDS = 7 * 24 * 3600


def _tables():
    return models.Base.metadata.sorted_tables


def _serialize(v):
    return v.isoformat() if isinstance(v, (date, datetime)) else v


def _timestamped_name() -> str:
    return f"backup_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.json"


def _newest_age_seconds() -> float:
    files = list(BACKUP_DIR.glob("*.json"))
    return time.time() - max((f.stat().st_mtime for f in files), default=0) if files else float("inf")


def _dump(path: Path, db: Session) -> dict:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        t.name: [{k: _serialize(v) for k, v in dict(r).items()} for r in db.execute(t.select()).mappings().all()]
        for t in _tables()
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return {name: len(rows) for name, rows in data.items()}


def maybe_weekly_backup(db: Session) -> None:
    """Lazy weekly cron: write a timestamped backup if the newest copy is >7 days old
    (or none exists). Runs on startup and when the backup list is fetched."""
    try:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        if _newest_age_seconds() < WEEKLY_SECONDS:
            return
        _dump(BACKUP_DIR / _timestamped_name(), db)
    except Exception:
        pass  # a backup failure must never break a normal request


@router.get("")
def list_backups(db: Session = Depends(get_db)):
    maybe_weekly_backup(db)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return {
        "dir": str(BACKUP_DIR),
        "files": sorted((p.name for p in BACKUP_DIR.glob("*.json")), reverse=True),
    }


@router.post("")
def create_backup(db: Session = Depends(get_db)):
    fname = _timestamped_name()
    counts = _dump(BACKUP_DIR / fname, db)
    return {"file": fname, "counts": counts}


def run_cli() -> None:
    """Standalone timestamped backup — reads the SQLite file directly, no running server.
    Run from backend/:  ./venv/bin/python -m app.routers.backup"""
    from ..database import SessionLocal

    fname = _timestamped_name()
    with SessionLocal() as db:
        counts = _dump(BACKUP_DIR / fname, db)
    print(f"{fname} -> {BACKUP_DIR} {counts}")


if __name__ == "__main__":
    run_cli()


@router.post("/restore")
def restore_backup(payload: dict, db: Session = Depends(get_db)):
    fname = Path(payload.get("file", "")).name  # basename only -> no path traversal
    fpath = BACKUP_DIR / fname
    if not fname or not fpath.exists():
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    data = json.loads(fpath.read_text())

    tables = _tables()
    for t in reversed(tables):  # clear children first
        db.execute(t.delete())
    for t in tables:
        rows = data.get(t.name, [])
        if not rows:
            continue
        date_cols = {c.name for c in t.columns if isinstance(c.type, Date) and not isinstance(c.type, DateTime)}
        dt_cols = {c.name for c in t.columns if isinstance(c.type, DateTime)}
        for row in rows:
            for c in date_cols:
                if row.get(c) is not None:
                    row[c] = date.fromisoformat(row[c])
            for c in dt_cols:
                if row.get(c) is not None:
                    row[c] = datetime.fromisoformat(row[c])
        db.execute(t.insert(), rows)
    db.commit()
    # a pre-refactor backup stores accounts with the old AccountType.key values
    # ('saving'/'investment') instead of the current type ('ahorro'/'inversion').
    # Same one-time rename as the startup migration in main.py.
    db.query(models.Category).filter(models.Category.type == "saving").update({"type": "ahorro"})
    db.query(models.Category).filter(models.Category.type == "investment").update({"type": "inversion"})
    db.commit()
    return {"restored": {t.name: len(data.get(t.name, [])) for t in tables}}
