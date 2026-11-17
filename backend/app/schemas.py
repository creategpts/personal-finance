from datetime import date as date_type, datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    group_name: str | None = None


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
    date: str  # "YYYY-MM-DD" — the point's evaluation date (granularity-dependent spacing)
    total: float
    by_type: dict[str, float]  # account_type key -> balance as of `date`
    investment_invertido: float  # capital invertido en inversiones, a fecha `date`
    investment_valor_actual: float  # valor de mercado de las inversiones, a fecha `date`


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


# ---- Investments ----
class InvestmentTransactionBase(BaseModel):
    date: date_type
    units: float  # positive = aportación/compra, negative = venta; unused (0) for lump-sum holdings
    amount: float  # positive = dinero entrante, negative = dinero saliente
    kind: str = "flow"  # "flow" (aportación/venta), "adjustment" (ajuste de valor, lump-sum only)
    note: str | None = None


class InvestmentTransactionCreate(InvestmentTransactionBase):
    pass


class InvestmentTransactionOut(InvestmentTransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    investment_id: int


class InvestmentBase(BaseModel):
    name: str
    type: str  # one of models.INVESTMENT_TYPES
    isin: str | None = None
    account: str | None = None  # Category.name of the Cuenta (type='inversion') this holding sits in
    target_weight: float = 0
    ft_symbol: str | None = None  # FT tearsheet "s=" param, e.g. "LU1234567890:EUR"
    active: bool = True


class InvestmentCreate(InvestmentBase):
    pass


class InvestmentUpdate(InvestmentBase):
    current_price: float | None = None  # manual price edit; omit to keep current


class InvestmentStats(BaseModel):
    units_held: float
    avg_cost: float
    total_invertido: float
    valor_actual: float
    plusvalia: float
    rentabilidad: float


class InvestmentOut(InvestmentBase):
    id: int
    current_price: float
    price_updated_at: datetime | None = None
    transactions: list[InvestmentTransactionOut]
    stats: InvestmentStats


class PortfolioSummary(BaseModel):
    total_invertido: float
    valor_actual: float
    plusvalia: float
    rentabilidad: float


class PortfolioCompositionItem(BaseModel):
    investment_id: int
    name: str
    type: str
    valor_actual: float
    weight_real: float
    weight_target: float


class PriceRefreshResult(BaseModel):
    investment_id: int
    ok: bool
    price: float | None = None
    error: str | None = None


class MarketSyncResult(BaseModel):
    investment_id: int
    ok: bool
    skipped: bool = False
    error: str | None = None


class MarketPricePoint(BaseModel):
    date: date_type
    price: float


class MarketFund(BaseModel):
    investment_id: int
    name: str
    current_price: float
    price_updated_at: datetime | None
    units_held: float
    avg_cost: float | None  # None when nothing is held, so the chart skips that line
    high_52w: float | None
    all_time_high: float | None
    series: list[MarketPricePoint]


class Liquidity(BaseModel):
    account: str | None
    balance: float | None
    emergency_fund: float
    available: float | None  # balance - emergency_fund, never below 0


class MarketOverview(BaseModel):
    liquidity: Liquidity
    funds: list[MarketFund]


class FxRate(BaseModel):
    currency: str
    rate: float  # unidades de `currency` por 1 EUR


class PriceLookupResult(BaseModel):
    ok: bool
    price: float | None = None
    symbol: str | None = None  # símbolo FT resuelto, p. ej. "IE00BDZVHT63:USD"
    error: str | None = None


class PortfolioHistoryPoint(BaseModel):
    date: str
    total_invertido: float
    valor_actual: float


class AccountCheckItem(BaseModel):
    account: str
    net_moved: float
    contributed: float
    difference: float


class PendingAllocation(BaseModel):
    investment_id: int
    amount: float  # positive = aportación a esa holding
    price: float | None = None  # required for fund-style holdings; ignored for lump-sum (seguros)


class AssignPendingRequest(BaseModel):
    date: date_type
    allocations: list[PendingAllocation]


class PlanDip(BaseModel):
    drop: float = Field(gt=0, le=100)
    amount: float = Field(ge=0)  # euros injected when this drop is reached


class ReserveTier(BaseModel):
    below: float = Field(gt=0, le=100)  # applies while the phase index is less than this % below its peak
    amount: float = Field(ge=0)  # euros per month diverted from the contribution to emergency fund + dry powder


class PlanAllocation(BaseModel):
    investment_id: int
    name: str
    weight: float = Field(ge=0, le=100)


class PlanPhase(BaseModel):
    name: str
    months: float = Field(gt=0)
    contribution: float = Field(ge=0)
    frequency: Literal["monthly", "biweekly"] = "monthly"
    emergency_fund: float = Field(ge=0, default=0)  # total reserve while this phase is active
    note: str = ""
    weight_tolerance: float = Field(ge=0, default=2)
    allocation: list[PlanAllocation] = []
    dry_powder: float = Field(ge=0, default=0)
    reserve_tiers: list[ReserveTier] = []
    dips: list[PlanDip] = []  # drop measured on the phase's weighted index of its funds, never per fund
    initial_capital: float = Field(ge=0, default=0)  # portfolio at phase start: reference only, never in projections
    monthly_income: float | None = None
    monthly_expense: float | None = None

    @model_validator(mode="after")
    def _weights_sum_100(self):
        total = sum(a.weight for a in self.allocation)
        if self.allocation and abs(total - 100) > 0.01:
            raise ValueError(f"La asignación de «{self.name}» debe sumar 100 % (suma {total:g} %)")
        return self


class PlanData(BaseModel):
    summary: str = ""
    start_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    phases: list[PlanPhase] = Field(min_length=1)


class PlanVersionIn(BaseModel):
    reason: str = Field(min_length=1)
    data: PlanData

    @field_validator("reason")
    @classmethod
    def _reason_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El motivo es obligatorio")
        return v.strip()


class PlanVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    reason: str
    data: PlanData


class DipShotIn(BaseModel):
    phase_index: int = Field(ge=0)
    drop: float = Field(gt=0, le=100)
    amount: float = Field(ge=0)


class DipShotOut(DipShotIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
