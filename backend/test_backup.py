"""Runnable check for backup restore. Run from backend/: `python test_backup.py` or `pytest`.

Only exercises the SQLite path (no Postgres available in dev, see CLAUDE.md) — the
Postgres-only sequence resync in restore_backup (backup.py) can't be verified here and
was checked manually against Neon instead.
"""

from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.routers import backup


def _session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_restore_then_insert_does_not_collide(tmp_path, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_DIR", tmp_path)
    db = _session()
    db.add(models.Movement(concept="cena", amount=80.0, status=models.MovementStatus.done,
                            date=date(2026, 10, 4), year=2026, month=10, week=40,
                            origin="CG Rural", destination="Con Nere"))
    db.commit()

    fname = "backup_test.json"
    backup._dump(tmp_path / fname, db)

    result = backup.restore_backup({"file": fname}, db)
    assert result["restored"]["movements"] == 1

    db.add(models.Movement(concept="otro", amount=5.0, status=models.MovementStatus.done,
                            date=date(2026, 10, 4), year=2026, month=10, week=40,
                            origin="CG Rural", destination="Con Nere"))
    db.commit()  # would raise IntegrityError on a backend where restore left ids desynced


if __name__ == "__main__":
    import tempfile
    from pathlib import Path
    from unittest.mock import patch

    with tempfile.TemporaryDirectory() as d:
        with patch.object(backup, "BACKUP_DIR", Path(d)):
            db = _session()
            db.add(models.Movement(concept="cena", amount=80.0, status=models.MovementStatus.done,
                                    date=date(2026, 10, 4), year=2026, month=10, week=40,
                                    origin="CG Rural", destination="Con Nere"))
            db.commit()
            backup._dump(Path(d) / "backup_test.json", db)
            result = backup.restore_backup({"file": "backup_test.json"}, db)
            assert result["restored"]["movements"] == 1
            db.add(models.Movement(concept="otro", amount=5.0, status=models.MovementStatus.done,
                                    date=date(2026, 10, 4), year=2026, month=10, week=40,
                                    origin="CG Rural", destination="Con Nere"))
            db.commit()
    print("ok")
