"""Investment plan schedule: which phase is active and what it commits to each month.
The plan itself is a schemas.PlanData dict stored in PlanVersion; sync() pushes the
parts other features already read (fund target weights and emergency fund setting)
so they follow the current plan."""

from datetime import date
from math import floor

from . import models


def monthly(phase: dict) -> float:
    return phase["contribution"] * (2 if phase.get("frequency") == "biweekly" else 1)


def _start(data: dict) -> tuple[int, int]:
    y, m = data["start_month"].split("-")
    return int(y), int(m)


def add_months(y: int, m: int, n: int) -> tuple[int, int]:
    idx = y * 12 + (m - 1) + n
    return idx // 12, idx % 12 + 1


def offset_of(data: dict, y: int, m: int) -> int:
    sy, sm = _start(data)
    return (y - sy) * 12 + (m - sm)


# ponytail: a phase that ends mid-month (16.5) hands the whole boundary month to the
# next phase (floor); switch to half-month targets if biweekly accuracy ever matters.
def schedule(data: dict) -> list[dict]:
    rows, at, cum = [], 0.0, 0.0
    for p in data["phases"]:
        cum += monthly(p) * p["months"]
        rows.append({"start": floor(at), "end": floor(at + p["months"]), "monthly": monthly(p), "cum_end": cum})
        at += p["months"]
    return rows


def phase_index_at(data: dict, offset: int) -> int | None:
    for i, r in enumerate(schedule(data)):
        if r["start"] <= offset < r["end"]:
            return i
    return None


def sync(db, data: dict, today: date) -> None:
    offset = offset_of(data, today.year, today.month)
    phases = data["phases"]
    idx = phase_index_at(data, offset)
    in_force = phases[idx] if idx is not None else phases[0] if offset < 0 else phases[-1]

    weights = {a["investment_id"]: a["weight"] for a in in_force.get("allocation", [])}
    if weights:
        for inv in db.query(models.Investment).all():
            inv.target_weight = weights.get(inv.id, 0)

    setting = db.get(models.Setting, "emergency_fund") or models.Setting(key="emergency_fund")
    setting.value = str(in_force.get("emergency_fund", 0))
    db.add(setting)

    db.commit()


def current(db) -> models.PlanVersion | None:
    return db.query(models.PlanVersion).order_by(models.PlanVersion.id.desc()).first()
