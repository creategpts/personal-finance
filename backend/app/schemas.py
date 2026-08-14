from datetime import date as date_type

from pydantic import BaseModel, ConfigDict

from .models import (
    MovementStatus,
    RecurrenceFrequency,
)


# ---- Category ----
class CategoryBase(BaseModel):
    name: str
    type: str  # 'income', 'expense', or one of models.ACCOUNT_TYPES
    visible: bool = True
    initial_balance: float = 0
    include_in_total: bool = True
    es_ingreso: bool = True
    es_gasto: bool = True
    es_pasivo: bool = False
    parent_id: int | None = None  # expense categories only: the top-level category this nests under
    icon: str = "Tag"  # lucide-react icon name, display only; a subcategory's icon is never shown, the parent's is used instead
    color: str = "#6b7280"


class CategoryCreate(CategoryBase):
    pass


class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- Movement ----
class MovementBase(BaseModel):
    concept: str
    amount: float
    status: MovementStatus = MovementStatus.plan
    date: date_type
    origin: str
    destination: str


class MovementCreate(MovementBase):
    pass


class MovementOut(MovementBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    year: int
    month: int
    week: int


# ---- Account values (live per-category balance) ----
class AccountValueItem(BaseModel):
    category: str
    amount: float


class AccountSnapshot(BaseModel):
    date: date_type
    items: list[AccountValueItem]
    total_assets: float


# ---- Recurring expenses ----
class RecurringExpenseBase(BaseModel):
    concept: str
    amount: float
    origin: str
    destination: str
    frequency: RecurrenceFrequency
    next_due_date: date_type
    active: bool = True
    auto_generate: bool = True


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseOut(RecurringExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- Budget ----
class BudgetItem(BaseModel):
    category: str
    amount: float


class BudgetSet(BaseModel):
    items: list[BudgetItem]


# ---- Dashboard ----
class DashboardSummary(BaseModel):
    total_income: float
    total_income_passive: float = 0
    total_expenses: float
    total_savings: float
    total_investments: float
    total_budget: float | None = None


class BudgetVsActualItem(BaseModel):
    category: str
    planned: float
    actual: float


class CategoryBreakdownItem(BaseModel):
    category: str
    amount: float
    color: str
    icon: str
    es_pasivo: bool = False  # income only: flags a passive-income category


class TopDestinationItem(BaseModel):
    destination: str
    amount: float
    color: str  # a subcategory inherits its parent's color, matching the rest of the app


class NetWorthPoint(BaseModel):
    month: str  # "YYYY-MM"
    total: float
    by_type: dict[str, float]  # account_type key -> month-end balance


class MonthlyKpiPoint(BaseModel):
    month: str  # "YYYY-MM"
    income: float
    expense: float
    saving: float
    investment: float
    budget: float


# ---- Goals ----
class GoalTargetIn(BaseModel):
    eff_year: int | None = None  # defaults to the goal's start month on create
    eff_month: int | None = None
    amount: float | None = None  # fixed
    percent: float | None = None  # percent_income (0-100)
    target_amount: float | None = None  # target_date
    target_year: int | None = None
    target_month: int | None = None


class GoalTargetOut(GoalTargetIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    eff_year: int
    eff_month: int


class GoalCreate(BaseModel):
    name: str
    account: str
    type: str  # one of goals_logic.GOAL_TYPES
    active: bool = True
    start_year: int
    start_month: int
    target: GoalTargetIn


class GoalUpdate(BaseModel):
    name: str
    active: bool


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    account: str
    type: str
    active: bool
    start_year: int
    start_month: int
    targets: list[GoalTargetOut]


class GoalProgressRow(BaseModel):
    year: int
    month: int
    target_month: float
    actual_month: float
    cum_target: float
    cum_actual: float
    on_track: bool
    status: str  # 'met' | 'failed' | 'open'


class GoalProgress(BaseModel):
    goal_id: int
    rows: list[GoalProgressRow]
    completed: bool
    meta: float | None = None  # target_date: effective meta (total balance target)
    deadline: str | None = None  # target_date: "YYYY-MM"

