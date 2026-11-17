"""Runnable check for plan_logic. Run from backend/: `python test_plan.py` or `pytest`."""

from datetime import date

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models, plan_logic, schemas

PLAN = {
    "start_month": "2026-01",
    "phases": [
        {"name": "Despliegue", "months": 16.5, "contribution": 2000, "frequency": "biweekly", "emergency_fund": 6000,
         "initial_capital": 3500, "monthly_income": 1600, "monthly_expense": 600,
         "allocation": [{"investment_id": 1, "name": "World", "weight": 75}, {"investment_id": 2, "name": "EM", "weight": 25}]},
        {"name": "Ahorro", "months": 19.5, "dry_powder": 6000, "dips": [{"drop": 10, "amount": 2000}, {"drop": 15, "amount": 4000}],
         "reserve_tiers": [{"below": 3, "amount": 400}, {"below": 10, "amount": 100}], "contribution": 1400, "frequency": "monthly", "emergency_fund": 16000,
         "allocation": [{"investment_id": 1, "name": "World", "weight": 80},
                        {"investment_id": 2, "name": "EM", "weight": 20}]},
        {"name": "Crucero", "months": 84, "contribution": 1000, "frequency": "monthly", "emergency_fund": 16000,
         "allocation": [{"investment_id": 1, "name": "World", "weight": 100}]},
    ],
}


def session():
    engine = create_engine("sqlite://")
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add_all([
        models.Investment(id=1, name="World", type="fondo_inversion", target_weight=0),
        models.Investment(id=2, name="EM", type="fondo_inversion", target_weight=0),
    ])
    db.commit()
    return db


def test_schedule():
    parsed = schemas.PlanData(**PLAN)
    assert schemas.PlanData(**{**PLAN, "goal_id": 1, "start_age": 30}).phases == parsed.phases  # versions saved with the old goal link still load
    assert parsed.phases[0].initial_capital == 3500 and parsed.phases[1].initial_capital == 0
    s = plan_logic.schedule(PLAN)
    assert [(r["start"], r["end"]) for r in s] == [(0, 16), (16, 36), (36, 120)]
    assert [r["monthly"] for r in s] == [4000, 1400, 1000]
    assert s[-1]["cum_end"] == 4000 * 16.5 + 1400 * 19.5 + 1000 * 84  # initial capital is the starting point, not the plan
    assert plan_logic.phase_index_at(PLAN, -1) is None
    assert plan_logic.phase_index_at(PLAN, 15) == 0
    assert plan_logic.phase_index_at(PLAN, 16) == 1
    assert plan_logic.phase_index_at(PLAN, 120) is None


def test_sync_mid_phase():
    db = session()
    plan_logic.sync(db, PLAN, date(2027, 6, 10))  # offset 17 -> phase 2
    assert [i.target_weight for i in db.query(models.Investment).order_by(models.Investment.id)] == [80, 20]
    assert db.get(models.Setting, "emergency_fund").value == "16000"


def test_sync_drops_funds_outside_phase():
    db = session()
    plan_logic.sync(db, PLAN, date(2029, 3, 1))  # offset 38 -> phase 3, World only
    assert [i.target_weight for i in db.query(models.Investment).order_by(models.Investment.id)] == [100, 0]


def test_sync_is_idempotent():
    db = session()
    plan_logic.sync(db, PLAN, date(2026, 3, 1))
    plan_logic.sync(db, PLAN, date(2026, 3, 1))
    assert db.get(models.Setting, "emergency_fund").value == "6000"
    assert [i.target_weight for i in db.query(models.Investment).order_by(models.Investment.id)] == [75, 25]


def test_router_persists_plan_and_shots():
    from app.routers import plan as r
    db = session()
    r.save_plan(schemas.PlanVersionIn(reason="v1", data=PLAN), db)
    db.rollback()
    saved = db.query(models.PlanVersion).one()
    assert saved.data["phases"][1]["dry_powder"] == 6000
    assert saved.data["phases"][1]["dips"][1] == {"drop": 15, "amount": 4000}
    assert "dips" not in saved.data["phases"][1]["allocation"][0]
    assert saved.data["phases"][1]["reserve_tiers"][0] == {"below": 3, "amount": 400}
    shot = r.fire_shot(schemas.DipShotIn(phase_index=1, drop=10, amount=2000), db)
    assert [s.id for s in r.list_shots(1, db)] == [shot.id] and r.list_shots(0, db) == []
    r.undo_shot(shot.id, db)
    assert r.list_shots(None, db) == []


def test_validation():
    schemas.PlanVersionIn(reason="ok", data=PLAN)
    for bad in [
        {"reason": "  ", "data": PLAN},
        {"reason": "x", "data": {**PLAN, "phases": [{**PLAN["phases"][0], "allocation": [{"investment_id": 1, "name": "W", "weight": 90}]}]}},
        {"reason": "x", "data": {**PLAN, "phases": []}},
        {"reason": "x", "data": {**PLAN, "start_month": "2026-13"}},
        {"reason": "x", "data": {**PLAN, "phases": [{**PLAN["phases"][0], "dry_powder": -1}]}},
        {"reason": "x", "data": {**PLAN, "phases": [{**PLAN["phases"][1], "dips": [{"drop": 0, "amount": 100}]}]}},
        {"reason": "x", "data": {**PLAN, "phases": [{**PLAN["phases"][1], "reserve_tiers": [{"below": 3, "amount": -1}]}]}},
    ]:
        try:
            schemas.PlanVersionIn(**bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted invalid plan: {bad}")


if __name__ == "__main__":
    test_schedule()
    test_sync_mid_phase()
    test_sync_drops_funds_outside_phase()
    test_sync_is_idempotent()
    test_router_persists_plan_and_shots()
    test_validation()
    print("ok")
