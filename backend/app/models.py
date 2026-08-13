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
