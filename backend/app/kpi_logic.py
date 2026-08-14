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
        # unfiltered — used to recognize a flagged-off category (Revalorización,
        # Devaluación...) as a valuation adjustment rather than "not a category at all"
        "income_all": {c.name for c in cats if c.type == "income"},
        "expense_all": {c.name for c in cats if c.type == "expense"},
        "saving": acct("ahorro"),
        "investment": acct("inversion"),
        "gasto": acct("gasto"),
    }


def _is_valuation_adjustment(name: str, names: dict[str, set[str]]) -> bool:
    """A flow category that exists but has its es_ingreso/es_gasto flag off — e.g.
    Revalorización/Devaluación. Not a real cash flow, just marks a balance change,
    so it shouldn't count as an aportación/retirada either."""
    if name in names["income_all"]:
        return name not in names["income"]
    if name in names["expense_all"]:
        return name not in names["expense"]
    return False


def matches_kpi(movement: models.Movement, kpi: str, names: dict[str, set[str]]) -> bool:
    # every account, regardless of type — there's no neutral/checking type
    account_names = names["saving"] | names["investment"] | names["gasto"]
    origin, destination = movement.origin, movement.destination

    if kpi == "income":
        # income = money entering an account from an income category flagged es_ingreso
        return origin in names["income"] and destination in account_names
    if kpi == "expense":
        # normally paid from a real account, but also valid straight from an Ingreso
        # category (e.g. Pluxee: restaurant credit deducted from gross pay — it never
        # sits in a tracked account, so it shouldn't touch patrimonio, but it's still
        # real spending). Origin can only ever be an account or an income category
        # (categoryTypes.isOrigin) — expense/other combos can't occur.
        return (origin in account_names or origin in names["income"]) and destination in names["expense"]
    if kpi in ("saving", "investment"):
        origin_is_acct = origin in names[kpi]
        destination_is_acct = destination in names[kpi]
        # double-entry: touching the behavior on either end matches, regardless of the
        # other end — a transfer within the same behavior still "matches" even though
        # its net kpi_amount is zero.
        if not origin_is_acct and not destination_is_acct:
            return False
        if origin_is_acct and destination_is_acct:
            return True
        # exactly one side is the account — a valuation adjustment on the other side
        # (Revalorización/Devaluación) changes the balance but isn't a real aportación/retirada
        other = destination if origin_is_acct else origin
        return not _is_valuation_adjustment(other, names)
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
