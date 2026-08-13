"""Runnable check for goals_logic. Run from backend/: `python test_goals.py` or `pytest`."""

from datetime import date
from types import SimpleNamespace

from app import goals_logic


def mv(year, month, origin, destination, amount):
    return SimpleNamespace(year=year, month=month, origin=origin, destination=destination, amount=amount)


def tgt(eff_year, eff_month, id=0, **kw):
    base = dict(amount=None, percent=None, target_amount=None, target_year=None, target_month=None)
    base.update(kw)
    return SimpleNamespace(id=id, eff_year=eff_year, eff_month=eff_month, **base)


def goal(gtype, start_year, start_month, account, targets):
    return SimpleNamespace(id=1, type=gtype, start_year=start_year, start_month=start_month, account=account, targets=targets)


def test_net_flow():
    movs = [mv(2026, 1, "Nomina", "Fondo", 300), mv(2026, 1, "Fondo", "Cuenta", 100), mv(2026, 2, "Nomina", "Fondo", 50)]
    assert goals_logic.account_net_flow(movs, "Fondo", 2026, 1) == 200  # 300 in - 100 out
    assert goals_logic.account_net_flow(movs, "Fondo", 2026, 2) == 50


def test_carryover_and_open_month():
    g = goal("fixed", 2026, 1, "Fondo", [tgt(2026, 1, amount=100)])
    movs = [mv(2026, 1, "N", "Fondo", 50), mv(2026, 2, "N", "Fondo", 200)]
    rows = goals_logic.goal_progress(g, movs, {}, date(2026, 3, 15))["rows"]
    # jan below (failed), feb catches up cumulatively (met), mar open (never failed)
    assert [r["status"] for r in rows] == ["failed", "met", "open"]
    assert rows[0]["cum_actual"] == 50 and rows[0]["cum_target"] == 100
    assert rows[1]["cum_actual"] == 250


def test_effect_dated_target():
    g = goal("fixed", 2026, 1, "Fondo", [tgt(2026, 1, amount=100), tgt(2026, 3, amount=200)])
    rows = goals_logic.goal_progress(g, [], {}, date(2026, 4, 1))["rows"]
    assert [r["target_month"] for r in rows] == [100.0, 100.0, 200.0, 200.0]  # past not rewritten


def test_percent_income():
    names = {"income": {"Nomina"}, "saving": {"Fondo"}, "investment": set(), "gasto": {"Efectivo"}}
    g = goal("percent_income", 2026, 1, "Fondo", [tgt(2026, 1, percent=10)])
    movs = [mv(2026, 1, "Nomina", "Efectivo", 1000), mv(2026, 1, "Efectivo", "Fondo", 150)]
    r = goals_logic.goal_progress(g, movs, names, date(2026, 1, 20))["rows"][0]
    assert r["target_month"] == 100.0  # 10% of 1000 income
    assert r["actual_month"] == 150.0
    assert r["status"] == "met"


def test_target_date_pace_and_completion():
    g = goal("target_date", 2026, 1, "Fondo", [tgt(2026, 1, target_amount=1200, target_year=2026, target_month=12)])
    prog = goals_logic.goal_progress(g, [], {}, date(2026, 6, 1))
    assert prog["rows"][0]["target_month"] == 100.0  # 1200 / 12 months, flat
    assert prog["completed"] is False
    # after the deadline the series caps at the target month and marks complete
    past = goals_logic.goal_progress(g, [], {}, date(2027, 1, 15))
    assert past["completed"] is True
    assert past["rows"][-1]["month"] == 12


def test_target_date_counts_existing_balance():
    # meta 60k, already have 37k, 24 months -> monthly need closes the gap, not 60k/24
    g = goal("target_date", 2026, 1, "Fondo", [tgt(2026, 1, target_amount=60000, target_year=2027, target_month=12)])
    r0 = goals_logic.goal_progress(g, [], {}, date(2026, 3, 1), start_balance=37000)["rows"][0]
    assert r0["target_month"] == 958.33  # (60000-37000) / 24 months
    assert r0["cum_actual"] == 37000.0  # existing balance seeds progress
    assert round(r0["cum_target"], 2) == 37958.33


def test_completed_uses_effective_meta_not_stale_target():
    # a stale duplicate target (23000) must not mark a 60000 goal complete just because
    # the balance already exceeds the stale value. Effective (highest id) meta wins.
    targets = [
        tgt(2026, 1, id=1, target_amount=60000, target_year=2027, target_month=12),
        tgt(2026, 1, id=2, target_amount=60000, target_year=2027, target_month=12),
    ]
    g = goal("target_date", 2026, 1, "Fondo", targets)
    prog = goals_logic.goal_progress(g, [], {}, date(2026, 3, 1), start_balance=37000)
    assert prog["completed"] is False  # 37000 < effective meta 60000


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok {name}")
    print("all passed")
