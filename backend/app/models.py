import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Date,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class CategoryType(str, enum.Enum):
    expense = "expense"
    income = "income"


# Category.type is one of these two flow types, or one of ACCOUNT_TYPES.
FLOW_TYPES = ("income", "expense")

# The three fixed account types. Every account (Cuenta) is exactly one of these —
# this is the single source of truth for account grouping everywhere (KPIs, net
# worth, goals). No behavior/AccountType indirection: the type IS the group.
ACCOUNT_TYPES = ("ahorro", "gasto", "inversion")


class MovementStatus(str, enum.Enum):
    plan = "Plan"
    done = "Done"


class RecurrenceFrequency(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


# Fixed investment holding types (Panel de inversión). Independent of ACCOUNT_TYPES /
# Cuenta — a holding here is not a Category, it's a position tracked by its own
# transactions (aportaciones/ventas), not by Movimientos.
INVESTMENT_TYPES = ("fondo_inversion", "criptomoneda", "mmpp", "seguros")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    # 'income', 'expense', or one of ACCOUNT_TYPES ('ahorro'/'gasto'/'inversion').
    type = Column(String, nullable=False)
    visible = Column(Boolean, nullable=False, default=True)
    # for account categories: the balance before any tracked movements.
    # Live balance = this + full ledger net.
    initial_balance = Column(Float, nullable=False, default=0)
    # whether this account's balance counts toward "Valor total de activos".
    include_in_total = Column(Boolean, nullable=False, default=True)
    # for income/expense categories: whether movements through it count toward the
    # income / expense KPI totals (user-toggleable; e.g. Bizum/Revalorización are not real income).
    es_ingreso = Column(Boolean, nullable=False, default=True)
    es_gasto = Column(Boolean, nullable=False, default=True)
    # for income categories: passive (interest, dividends, rent…) vs active (salary).
    # Drives the Activo/Pasivo split on the dashboard. Replaces the old hardcoded
    # "passive = category named Intereses" rule.
    es_pasivo = Column(Boolean, nullable=False, default=False)
    # subcategory support (expense categories only): the top-level expense category
    # this one nests under. NULL = top-level. Exactly 2 levels — a category that is
    # itself a subcategory (parent_id set) can't have children of its own.
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    # display only. `icon` is a lucide-react icon name (e.g. "Utensils"), not an emoji —
    # rendered via <CategoryIcon> on the frontend. A subcategory has no icon/color of its
    # own — the UI always shows its parent's, so these are only meaningful (and only
    # editable) on a top-level category.
    icon = Column(String, nullable=False, default="Tag")
    color = Column(String, nullable=False, default="#6b7280")


class Setting(Base):
    """App-wide key-value settings (app name, user name, favicon emoji…).
    Single-user app, so global; no user_id."""

    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False, default="")


class Movement(Base):
    __tablename__ = "movements"

    id = Column(Integer, primary_key=True, index=True)
    concept = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SAEnum(MovementStatus), nullable=False, default=MovementStatus.plan)
    date = Column(Date, nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    week = Column(Integer, nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    # display-only umbrella label (e.g. "Vacaciones con Nerea 2026"): movements sharing
    # a non-null group_name collapse into one expandable row in the Movimientos table.
    # Purely presentational — each movement still counts individually in KPIs/Análisis.
    group_name = Column(String, nullable=True, index=True)


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0)


class Goal(Base):
    """A savings/investment goal tracking net contributions to one account.
    type is one of goals_logic.GOAL_TYPES. The target amount/%/meta lives in
    GoalTarget rows keyed by effective month, so changing a goal never rewrites
    the past — each month is evaluated against the target in force then."""

    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    account = Column(String, nullable=False)  # Category.name of the tracked account
    type = Column(String, nullable=False)  # one of goals_logic.GOAL_TYPES
    active = Column(Boolean, nullable=False, default=True)
    start_year = Column(Integer, nullable=False)
    start_month = Column(Integer, nullable=False)

    targets = relationship(
        "GoalTarget",
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="GoalTarget.eff_year, GoalTarget.eff_month",
    )


class GoalTarget(Base):
    """Effect-dated target for a Goal. Only the columns for the goal's type are
    set: amount (fixed), percent (percent_income), or target_amount+date (target_date)."""

    __tablename__ = "goal_targets"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    eff_year = Column(Integer, nullable=False)
    eff_month = Column(Integer, nullable=False)
    amount = Column(Float, nullable=True)
    percent = Column(Float, nullable=True)
    target_amount = Column(Float, nullable=True)
    target_year = Column(Integer, nullable=True)
    target_month = Column(Integer, nullable=True)

    goal = relationship("Goal", back_populates="targets")


class Investment(Base):
    """A holding tracked for the Panel de inversión (fondo indexado, fondo de
    inversión, criptomoneda, MMPP). capital invertido and rentabilidad are
    derived from its own transactions, not from Movimientos — account just
    scopes it to the Cuenta (type='inversion') the money for it sits in,
    linking it to the general ledger for the pending-assignment flow."""

    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # one of INVESTMENT_TYPES
    isin = Column(String, nullable=True)
    # Category.name of the Cuenta (type='inversion') this holding's money sits in.
    # Nullable: holdings created before this field existed have none until edited.
    account = Column(String, nullable=True)
    target_weight = Column(Float, nullable=False, default=0)  # objetivo de peso en cartera, %
    current_price = Column(Float, nullable=False, default=0)  # valor liquidativo/precio actual
    price_updated_at = Column(DateTime, nullable=True)
    # FT tearsheet symbol (the "s=" query param, e.g. "LU1234567890:EUR") used to
    # scrape current_price on demand. Null = price is set manually only.
    ft_symbol = Column(String, nullable=True)
    active = Column(Boolean, nullable=False, default=True)

    transactions = relationship(
        "InvestmentTransaction",
        back_populates="investment",
        cascade="all, delete-orphan",
        order_by="InvestmentTransaction.date",
    )
    snapshots = relationship(
        "PriceSnapshot",
        back_populates="investment",
        cascade="all, delete-orphan",
        order_by="PriceSnapshot.date",
    )


class InvestmentTransaction(Base):
    """One aportación (units/amount > 0) or venta (units/amount < 0) against a
    holding. avg cost is derived from these, weighted-average-cost method.

    kind="flow": real cash movement (aportación/venta), counts toward total_invertido.
    kind="adjustment": manual valuation change (lump-sum holdings only, e.g. seguros) —
    counts toward valor_actual but not total_invertido. units is unused (0.0) for
    lump-sum holdings; they have no per-unit price."""

    __tablename__ = "investment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    units = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    kind = Column(String, nullable=False, default="flow")
    note = Column(String, nullable=True)

    investment = relationship("Investment", back_populates="transactions")


class PriceSnapshot(Base):
    """One current_price reading for a holding on a given day — recorded every
    time a price is set (manual edit or FT refresh), at most one per day. Feeds
    the invertido-vs-valor-actual time series; a day with no reading simply has
    no valor_actual contribution for that holding until the next one."""

    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    price = Column(Float, nullable=False)

    __table_args__ = (UniqueConstraint("investment_id", "date", name="uq_price_snapshot_investment_date"),)

    investment = relationship("Investment", back_populates="snapshots")


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id = Column(Integer, primary_key=True, index=True)
    concept = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    frequency = Column(SAEnum(RecurrenceFrequency), nullable=False)
    next_due_date = Column(Date, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    # when False: tracked for year-view analysis only, never auto-creates a Movement
    # (e.g. no-fixed-date expenses like haircut, ITV, car service).
    auto_generate = Column(Boolean, nullable=False, default=True)
