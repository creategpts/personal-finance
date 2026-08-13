"""Goal progress: month-by-month, cumulative (carryover) evaluation.

A goal tracks net contributions to one account. Each month's actual is money in
minus money out of that account (Done movements only) — the same net semantics as
the saving/investment KPI, so a mid-month withdrawal reduces progress. Verdict is
cumulative: real acumulado >= objetivo acumulado -> "voy al día". A weak month is
offset by a strong one. The open (current) month never fails.
"""

from .kpi_logic import kpi_amount, matches_kpi

GOAL_TYPES = ("fixed", "percent_income", "target_date")


def _months_from(start_y, start_m, end_y, end_m):
    out = []
    y, m = start_y, start_m
    while (y, m) <= (end_y, end_m):
        out.append((y, m))
        m += 1
        if m == 13:
            m, y = 1, y + 1
    return out


def _total_months(start_y, start_m, end_y, end_m):
    return (end_y - start_y) * 12 + (end_m - start_m) + 1


def account_net_flow(movements, account, year, month):
    """Net contribution to `account` in (year, month): money in minus money out."""
    return sum(
        (mv.amount if mv.destination == account else -mv.amount)
        for mv in movements
        if mv.year == year
        and mv.month == month
        and (mv.origin == account or mv.destination == account)
    )


def income_for_month(movements, names, year, month):
    return sum(
        kpi_amount(mv, "income", names)
        for mv in movements
        if mv.year == year and mv.month == month and matches_kpi(mv, "income", names)
    )


def resolve_target(targets, year, month):
    """The target in force for (year, month): latest whose eff month is <= it.
    Ties on eff month break by id so the most recently added wins deterministically."""
    eligible = [t for t in targets if (t.eff_year, t.eff_month) <= (year, month)]
    return max(eligible, key=lambda t: (t.eff_year, t.eff_month, t.id)) if eligible else None


def target_month_value(goal, t, year, month, movements, names, seed=0.0):
    if t is None:
        return 0.0
    if goal.type == "fixed":
        return t.amount or 0.0
    if goal.type == "percent_income":
        return (t.percent or 0.0) / 100.0 * income_for_month(movements, names, year, month)
    if goal.type == "target_date":
        if not t.target_amount or not t.target_year:
            return 0.0
        # meta is a TOTAL balance target. Spread the remaining gap (meta - balance already
        # in the account at start) flat over the months to the deadline — not meta from zero.
        # Falling behind does NOT ramp the monthly target up (Q13).
        n = _total_months(goal.start_year, goal.start_month, t.target_year, t.target_month)
        return (t.target_amount - seed) / n if n > 0 else (t.target_amount - seed)
    return 0.0


def goal_progress(goal, done_movements, names, today, start_balance=0.0):
    targets = sorted(goal.targets, key=lambda t: (t.eff_year, t.eff_month, t.id))
    end_y, end_m = today.year, today.month
    completed = False

    # target_date is a total-balance goal: the balance already in the account counts as
    # progress (seed), and the pace closes the gap to the meta. Flow goals (fixed / percent)
    # only measure contributions made since the goal started, so they seed at 0.
    seed = start_balance if goal.type == "target_date" else 0.0

    if goal.type == "target_date" and targets and targets[-1].target_year:
        last = targets[-1]
        # cap the series at the target date once it has passed
        if (last.target_year, last.target_month) < (end_y, end_m):
            end_y, end_m = last.target_year, last.target_month
            completed = True

    rows = []
    cum_t = cum_a = seed
    for (y, m) in _months_from(goal.start_year, goal.start_month, end_y, end_m):
        t = resolve_target(targets, y, m)
        tm = target_month_value(goal, t, y, m, done_movements, names, seed)
        am = account_net_flow(done_movements, goal.account, y, m)
        cum_t += tm
        cum_a += am
        is_current = (y, m) == (today.year, today.month)
        on_track = cum_a >= cum_t - 1e-9
        status = ("met" if on_track else "open") if is_current else ("met" if on_track else "failed")
        rows.append(
            {
                "year": y,
                "month": m,
                "target_month": round(tm, 2),
                "actual_month": round(am, 2),
                "cum_target": round(cum_t, 2),
                "cum_actual": round(cum_a, 2),
                "on_track": on_track,
                "status": status,
            }
        )

    # complete when the balance reaches the effective (in-force) meta — not a stale target
    eff = resolve_target(targets, end_y, end_m)
    if goal.type == "target_date" and eff and eff.target_amount:
        if cum_a >= eff.target_amount - 1e-9:
            completed = True

    # meta/deadline drive the target_date progress view; None for flow goals
    meta = eff.target_amount if goal.type == "target_date" and eff else None
    deadline = (
        f"{eff.target_year:04d}-{eff.target_month:02d}"
        if goal.type == "target_date" and eff and eff.target_year
        else None
    )

    return {"goal_id": goal.id, "rows": rows, "completed": completed, "meta": meta, "deadline": deadline}
