"""Runnable check for kpi_logic. Run from backend/: `python test_kpi.py` or `pytest`."""

from types import SimpleNamespace

from app import kpi_logic


def mv(origin, destination, amount):
    return SimpleNamespace(origin=origin, destination=destination, amount=amount)


def names(**over):
    base = {
        "income": set(), "income_passive": set(), "income_all": set(),
        "expense": set(), "expense_all": set(),
        "saving": set(), "investment": set(), "gasto": set(),
    }
    base.update(over)
    return base


def test_saving_to_investment_not_a_retirada():
    n = names(saving={"Fondo"}, investment={"Broker"})
    m = mv("Fondo", "Broker", 100)
    assert kpi_logic.matches_kpi(m, "saving", n) is False
    assert kpi_logic.matches_kpi(m, "investment", n) is True
    assert kpi_logic.kpi_amount(m, "investment", n) == 100


def test_investment_to_saving_still_a_retirada():
    n = names(saving={"Fondo"}, investment={"Broker"})
    m = mv("Broker", "Fondo", 100)
    assert kpi_logic.matches_kpi(m, "saving", n) is True
    assert kpi_logic.kpi_amount(m, "saving", n) == 100
    assert kpi_logic.matches_kpi(m, "investment", n) is True
    assert kpi_logic.kpi_amount(m, "investment", n) == -100


def test_saving_withdrawal_to_expense_still_a_retirada():
    n = names(saving={"Fondo"}, expense_all={"Ocio"}, expense={"Ocio"})
    m = mv("Fondo", "Ocio", 50)
    assert kpi_logic.matches_kpi(m, "saving", n) is True
    assert kpi_logic.kpi_amount(m, "saving", n) == -50


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok {name}")
    print("all passed")
