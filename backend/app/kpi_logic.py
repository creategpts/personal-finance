from sqlalchemy.orm import Session

from . import models

KPI_NAMES = ("income", "expense", "saving", "investment")


def _category_names(db: Session, category_type: models.CategoryType) -> set[str]:
    return {r[0] for r in db.query(models.Category.name).filter(models.Category.type == category_type).all()}


def category_name_sets(db: Session) -> dict[str, set[str]]:
    cats = db.query(models.Category).all()

    # account sets are grouped directly by Category.type — 'ahorro'/'gasto'/'inversion'
    # are the source of truth, no separate behavior indirection.
    def acct(account_type: str) -> set[str]:
        return {c.name for c in cats if c.type == account_type}

    return {
        # income/expense sets are filtered by the user-toggleable es_ingreso/es_gasto flags
        "income": {c.name for c in cats if c.type == "income" and c.es_ingreso},
        "income_passive": {
            c.name for c in cats if c.type == "income" and c.es_ingreso and c.es_pasivo
        },
        "expense": {c.name for c in cats if c.type == "expense" and c.es_gasto},
        "saving": acct("ahorro"),
        "investment": acct("inversion"),
        "gasto": acct("gasto"),
    }


def matches_kpi(movement: models.Movement, kpi: str, names: dict[str, set[str]]) -> bool:
    # every account, regardless of type — there's no neutral/checking type
    account_names = names["saving"] | names["investment"] | names["gasto"]
    origin, destination = movement.origin, movement.destination

    if kpi == "income":
        # income = money entering an account from an income category flagged es_ingreso
        return origin in names["income"] and destination in account_names
    if kpi == "expense":
        return origin in account_names and destination in names["expense"]
    if kpi in ("saving", "investment"):
        # double-entry: touching the behavior on either end matches, regardless of the
        # other end — a transfer within the same behavior still "matches" even though
        # its net kpi_amount is zero.
        return origin in names[kpi] or destination in names[kpi]
    return False


def kpi_amount(movement: models.Movement, kpi: str, names: dict[str, set[str]]) -> float:
    """Signed contribution of this movement to the given KPI (for summing).

    Symmetric double-entry: +amount when the destination has this type, -amount
    when the origin has it. A transfer between two accounts of the SAME type nets
    to zero automatically (e.g. two savings accounts); a saving->investment move debits
    saving and credits investment in the same movement, with no special-casing.
    """
    if kpi not in ("saving", "investment"):
        return movement.amount
    amount = 0.0
    if movement.destination in names[kpi]:
        amount += movement.amount
    if movement.origin in names[kpi]:
        amount -= movement.amount
    return amount
