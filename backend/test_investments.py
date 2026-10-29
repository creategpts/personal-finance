"""Runnable check for investment_logic. Run from backend/: `python test_investments.py` or `pytest`."""

from datetime import date
from types import SimpleNamespace

from app import investment_logic


def tx(units, amount, d=date(2026, 1, 1), kind="flow"):
    return SimpleNamespace(units=units, amount=amount, date=d, kind=kind)


def snap(d, price):
    return SimpleNamespace(date=d, price=price)


def test_single_buy():
    s = investment_logic.holding_stats(current_price=30.0, transactions=[tx(10, 200.0)])
    assert s["units_held"] == 10
    assert s["avg_cost"] == 20.0
    assert s["total_invertido"] == 200.0
    assert s["valor_actual"] == 300.0
    assert s["plusvalia"] == 100.0
    assert round(s["rentabilidad"], 2) == 50.0


def test_multiple_buys_weighted_average():
    # 10 @ 20 then 10 @ 30 -> avg 25, 20 units held
    s = investment_logic.holding_stats(30.0, [tx(10, 200.0), tx(10, 300.0)])
    assert s["units_held"] == 20
    assert s["avg_cost"] == 25.0
    assert s["total_invertido"] == 500.0


def test_sell_keeps_avg_cost():
    # buy 10@20, sell 4 units for 120 -> avg cost stays 20, 6 units left, cost basis 120
    s = investment_logic.holding_stats(25.0, [tx(10, 200.0), tx(-4, -120.0)])
    assert s["units_held"] == 6
    assert s["avg_cost"] == 20.0
    assert s["total_invertido"] == 120.0
    assert s["valor_actual"] == 150.0
    assert s["plusvalia"] == 30.0


def test_full_exit_resets():
    s = investment_logic.holding_stats(25.0, [tx(10, 200.0), tx(-10, -250.0)])
    assert s["units_held"] == 0
    assert s["total_invertido"] == 0
    assert s["rentabilidad"] == 0  # no division by zero


def test_no_transactions():
    s = investment_logic.holding_stats(100.0, [])
    assert s == {
        "units_held": 0.0, "avg_cost": 0.0, "total_invertido": 0.0,
        "valor_actual": 0.0, "plusvalia": 0.0, "rentabilidad": 0.0,
    }


def test_portfolio_summary():
    stats = [
        {"total_invertido": 200.0, "valor_actual": 300.0},
        {"total_invertido": 100.0, "valor_actual": 80.0},
    ]
    p = investment_logic.portfolio_summary(stats)
    assert p["total_invertido"] == 300.0
    assert p["valor_actual"] == 380.0
    assert p["plusvalia"] == 80.0
    assert round(p["rentabilidad"], 2) == round(80 / 300 * 100, 2)


def test_portfolio_summary_zero_invertido_counts_valor_actual():
    stats = [
        {"total_invertido": 200.0, "valor_actual": 300.0},
        {"total_invertido": 0.0, "valor_actual": 9825.6},
    ]
    p = investment_logic.portfolio_summary(stats)
    assert p["total_invertido"] == 10025.6
    assert p["valor_actual"] == 10125.6
    assert p["plusvalia"] == 100.0


def test_composition_weights():
    inv_a = SimpleNamespace(id=1, name="A", type="fondo_indexado", target_weight=70)
    inv_b = SimpleNamespace(id=2, name="B", type="criptomoneda", target_weight=30)
    holdings = [
        (inv_a, {"valor_actual": 300.0}),
        (inv_b, {"valor_actual": 100.0}),
    ]
    comp = investment_logic.composition(holdings)
    assert round(comp[0]["weight_real"], 2) == 75.0
    assert round(comp[1]["weight_real"], 2) == 25.0
    assert comp[0]["weight_target"] == 70
    assert comp[1]["weight_target"] == 30


def test_composition_empty_portfolio():
    assert investment_logic.composition([]) == []


def test_time_series_single_holding():
    transactions = [tx(10, 200.0, date(2026, 1, 5))]
    snapshots = [snap(date(2026, 1, 5), 20.0), snap(date(2026, 1, 20), 25.0)]
    series = investment_logic.portfolio_time_series([("fund", transactions, snapshots)])
    assert [p["date"] for p in series] == ["2026-01-05", "2026-01-20"]
    assert series[0] == {"date": "2026-01-05", "total_invertido": 200.0, "valor_actual": 200.0}
    assert series[1] == {"date": "2026-01-20", "total_invertido": 200.0, "valor_actual": 250.0}


def test_time_series_no_price_before_first_snapshot():
    transactions = [tx(10, 200.0, date(2026, 1, 1))]
    snapshots = [snap(date(2026, 1, 10), 20.0)]
    series = investment_logic.portfolio_time_series([("fund", transactions, snapshots)])
    assert series[0] == {"date": "2026-01-01", "total_invertido": 200.0, "valor_actual": 0.0}
    assert series[1]["valor_actual"] == 200.0


def test_time_series_sums_across_holdings():
    a_tx = [tx(10, 100.0, date(2026, 1, 1))]
    a_snap = [snap(date(2026, 1, 1), 10.0)]
    b_tx = [tx(5, 50.0, date(2026, 1, 2))]
    b_snap = [snap(date(2026, 1, 2), 10.0)]
    series = investment_logic.portfolio_time_series([("fund", a_tx, a_snap), ("fund", b_tx, b_snap)])
    assert series[-1] == {"date": "2026-01-02", "total_invertido": 150.0, "valor_actual": 150.0}


def test_time_series_empty():
    assert investment_logic.portfolio_time_series([]) == []


def test_holding_stats_balance_flow_only():
    s = investment_logic.holding_stats_balance([tx(0, 1000.0, kind="flow"), tx(0, 500.0, kind="flow")])
    assert s["total_invertido"] == 1500.0
    assert s["valor_actual"] == 1500.0
    assert s["plusvalia"] == 0.0
    assert s["units_held"] == 0.0


def test_holding_stats_balance_with_adjustment():
    # aporta 1000, luego el seguro revaloriza +45 (sin tocar lo aportado)
    s = investment_logic.holding_stats_balance([tx(0, 1000.0, kind="flow"), tx(0, 45.0, kind="adjustment")])
    assert s["total_invertido"] == 1000.0
    assert s["valor_actual"] == 1045.0
    assert s["plusvalia"] == 45.0
    assert round(s["rentabilidad"], 2) == 4.5


def test_holding_stats_for_dispatches_by_type():
    seguro = SimpleNamespace(type="seguros", current_price=0, transactions=[tx(0, 1000.0, kind="flow")])
    fondo = SimpleNamespace(type="fondo_inversion", current_price=30.0, transactions=[tx(10, 200.0)])
    assert investment_logic.holding_stats_for(seguro)["valor_actual"] == 1000.0
    assert investment_logic.holding_stats_for(fondo)["valor_actual"] == 300.0


def test_time_series_balance_holding():
    transactions = [tx(0, 1000.0, date(2026, 1, 5), kind="flow"), tx(0, 45.0, date(2026, 1, 20), kind="adjustment")]
    series = investment_logic.portfolio_time_series([("balance", transactions, [])])
    assert series[0] == {"date": "2026-01-05", "total_invertido": 1000.0, "valor_actual": 1000.0}
    assert series[1] == {"date": "2026-01-20", "total_invertido": 1000.0, "valor_actual": 1045.0}


def test_time_series_balance_holding_all_adjustment_counts_valor_as_invertido():
    transactions = [tx(0, 1000.0, date(2026, 1, 5), kind="adjustment"), tx(0, -200.0, date(2026, 3, 1), kind="adjustment")]
    series = investment_logic.portfolio_time_series([("balance", transactions, [])])
    assert series[0] == {"date": "2026-01-05", "total_invertido": 1000.0, "valor_actual": 1000.0}
    assert series[1] == {"date": "2026-03-01", "total_invertido": 800.0, "valor_actual": 800.0}


def test_extend_to_today_appends_flat_point():
    series = [{"date": "2026-01-01", "total_invertido": 1000.0, "valor_actual": 1000.0}]
    extended = investment_logic.extend_to_today(series, date(2026, 3, 15))
    assert extended == [
        {"date": "2026-01-01", "total_invertido": 1000.0, "valor_actual": 1000.0},
        {"date": "2026-03-15", "total_invertido": 1000.0, "valor_actual": 1000.0},
    ]


def test_extend_to_today_noop_if_already_current():
    series = [{"date": "2026-03-15", "total_invertido": 1000.0, "valor_actual": 1000.0}]
    assert investment_logic.extend_to_today(series, date(2026, 3, 15)) == series


def test_extend_to_today_noop_on_empty_series():
    assert investment_logic.extend_to_today([], date(2026, 3, 15)) == []


def test_monthly_movement_date_is_29th_or_last_day():
    assert investment_logic.monthly_movement_date(2026, 10) == date(2026, 10, 29)
    assert investment_logic.monthly_movement_date(2026, 2) == date(2026, 2, 28)
    assert investment_logic.monthly_movement_date(2028, 2) == date(2028, 2, 29)


def test_holding_value_on_uses_known_price_then_current():
    txs = [tx(10, 100.0, date(2026, 1, 10)), tx(5, 60.0, date(2026, 3, 10))]
    prices = [(date(2026, 1, 31), 12.0), (date(2026, 2, 28), 14.0)]
    today = date(2026, 4, 15)
    f = lambda d: investment_logic.holding_value_on("fund", txs, prices, 20.0, d, today)
    assert f(date(2026, 1, 5)) == 0.0                # aún sin participaciones
    assert f(date(2026, 2, 28)) == 10 * 14.0         # último precio conocido <= d
    assert f(date(2026, 3, 31)) == 15 * 14.0         # 5 participaciones nuevas, mismo precio conocido
    assert f(date(2026, 4, 15)) == 15 * 20.0         # hoy: precio actual


def test_holding_value_on_balance_sums_everything():
    txs = [tx(0.0, 1000.0, date(2026, 1, 1)), tx(0.0, 30.0, date(2026, 2, 1), kind="adjustment")]
    assert investment_logic.holding_value_on("balance", txs, [], 0.0, date(2026, 2, 15), date(2026, 3, 1)) == 1030.0


def test_revalorization_direction():
    assert investment_logic.revalorization_movement(80.0, "Reval", "Deval", "CV") == ("Reval", "CV", 80.0)
    assert investment_logic.revalorization_movement(-30.0, "Reval", "Deval", "CV") == ("CV", "Deval", 30.0)
    assert investment_logic.revalorization_movement(0.0, "Reval", "Deval", "CV") is None


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok {name}")
    print("all passed")
