"""Per-holding and portfolio-level math for the Panel de inversión.

Cost basis uses the weighted-average-cost method: a buy (units>0) folds its
amount into the running average; a sell (units<0) only reduces units held,
leaving avg_cost unchanged (standard average-cost behavior)."""


def holding_stats(current_price: float, transactions) -> dict:
    """transactions: iterable of objects with .units and .amount, oldest first."""
    units_held = 0.0
    avg_cost = 0.0
    for t in transactions:
        if t.units > 0:
            cost_before = avg_cost * units_held
            units_held += t.units
            avg_cost = (cost_before + t.amount) / units_held if units_held > 0 else 0.0
        else:
            units_held += t.units  # t.units is negative
            if units_held <= 1e-9:
                units_held = 0.0
                avg_cost = 0.0

    total_invertido = avg_cost * units_held
    valor_actual = current_price * units_held
    plusvalia = valor_actual - total_invertido
    rentabilidad = (plusvalia / total_invertido * 100) if total_invertido > 0 else 0.0

    return {
        "units_held": units_held,
        "avg_cost": avg_cost,
        "total_invertido": total_invertido,
        "valor_actual": valor_actual,
        "plusvalia": plusvalia,
        "rentabilidad": rentabilidad,
    }


def holding_stats_balance(transactions) -> dict:
    """Lump-sum holdings (seguros): no units/price, just a running balance.
    transactions: iterable of objects with .amount and .kind ("flow" or "adjustment").
    total_invertido only counts "flow" (real aportación/retirada); valor_actual counts
    everything, including "adjustment" (manual revalorización)."""
    total_invertido = 0.0
    valor_actual = 0.0
    for t in transactions:
        valor_actual += t.amount
        if t.kind == "flow":
            total_invertido += t.amount

    plusvalia = valor_actual - total_invertido
    rentabilidad = (plusvalia / total_invertido * 100) if total_invertido > 0 else 0.0

    return {
        "units_held": 0.0,
        "avg_cost": 0.0,
        "total_invertido": total_invertido,
        "valor_actual": valor_actual,
        "plusvalia": plusvalia,
        "rentabilidad": rentabilidad,
    }


def holding_stats_for(investment) -> dict:
    if investment.type == "seguros":
        return holding_stats_balance(investment.transactions)
    return holding_stats(investment.current_price, investment.transactions)


def allocation_matches(pending: float, allocated: float, tolerance: float = 0.01) -> bool:
    """Whether a pending-assignment split accounts for the full pending amount,
    within rounding tolerance (splitting cents across holdings can leave a 0.01
    residual)."""
    return abs(allocated - pending) <= tolerance


def portfolio_summary(stats_list: list[dict]) -> dict:
    # a holding with no known total_invertido (e.g. lump-sum where flow vs
    # adjustment hasn't been sorted out yet) counts its full valor_actual as
    # invertido here, so it doesn't drag the portfolio-wide rentabilidad up
    # artificially. Stops applying on its own once that holding gets a real
    # total_invertido.
    total_invertido = sum(s["total_invertido"] or s["valor_actual"] for s in stats_list)
    valor_actual = sum(s["valor_actual"] for s in stats_list)
    plusvalia = valor_actual - total_invertido
    rentabilidad = (plusvalia / total_invertido * 100) if total_invertido > 0 else 0.0
    return {
        "total_invertido": total_invertido,
        "valor_actual": valor_actual,
        "plusvalia": plusvalia,
        "rentabilidad": rentabilidad,
    }


def _step_series_fund(transactions):
    units_held = 0.0
    avg_cost = 0.0
    steps = []
    for t in sorted(transactions, key=lambda t: t.date):
        if t.units > 0:
            cost_before = avg_cost * units_held
            units_held += t.units
            avg_cost = (cost_before + t.amount) / units_held if units_held > 0 else 0.0
        else:
            units_held += t.units
            if units_held <= 1e-9:
                units_held = 0.0
                avg_cost = 0.0
        steps.append((t.date, units_held, avg_cost * units_held))
    return steps


def _step_series_balance(transactions):
    """Lump-sum equivalent of _step_series_fund: no units/price, the running amount
    IS the value — no price lookup needed at read time."""
    invertido = 0.0
    valor = 0.0
    steps = []
    for t in sorted(transactions, key=lambda t: t.date):
        valor += t.amount
        if t.kind == "flow":
            invertido += t.amount
        steps.append((t.date, invertido, valor))
    return steps


def _value_at_fund(steps, prices, d):
    units = invertido = 0.0
    for sd, su, si in steps:
        if sd > d:
            break
        units, invertido = su, si
    price = None
    for pd, pp in prices:
        if pd > d:
            break
        price = pp
    return invertido, (units * price if price is not None else 0.0)


def _value_at_balance(steps, d):
    invertido = valor = 0.0
    for sd, si, sv in steps:
        if sd > d:
            break
        invertido, valor = si, sv
    return invertido, valor


def _prepare(holdings):
    """holdings: iterable of (kind, transactions, snapshots) triples, kind "fund" or
    "balance" (lump-sum, e.g. seguros — snapshots ignored, the running transaction sum
    IS the value)."""
    prepared = []
    for kind, transactions, snapshots in holdings:
        if kind == "balance":
            prepared.append(("balance", _step_series_balance(transactions), None))
        else:
            prepared.append(("fund", _step_series_fund(transactions), sorted(((s.date, s.price) for s in snapshots))))
    return prepared


def value_at(holdings, d) -> tuple[float, float]:
    """total_invertido, valor_actual across holdings, evaluated at date d — same
    fallback as portfolio_time_series: a holding with no known invertido at this
    point counts its valor as invertido instead."""
    total_invertido = total_valor = 0.0
    for kind, steps, prices in _prepare(holdings):
        invertido, valor = _value_at_balance(steps, d) if kind == "balance" else _value_at_fund(steps, prices, d)
        total_invertido += invertido or valor
        total_valor += valor
    return total_invertido, total_valor


def portfolio_time_series(holdings) -> list[dict]:
    """Returns one point per date any holding has a transaction or a price
    snapshot, summing total_invertido and valor_actual across holdings."""
    prepared = _prepare(holdings)

    all_dates = sorted(
        {d for _, steps, _ in prepared for d, _, _ in steps}
        | {d for kind, _, prices in prepared if kind == "fund" for d, _ in prices}
    )

    series = []
    for d in all_dates:
        total_invertido = total_valor = 0.0
        for kind, steps, prices in prepared:
            invertido, valor = _value_at_balance(steps, d) if kind == "balance" else _value_at_fund(steps, prices, d)
            # same fallback as portfolio_summary: a holding with no known invertido
            # at this point counts its valor as invertido here, so it doesn't read
            # as a sudden swing in the invertido line.
            total_invertido += invertido or valor
            total_valor += valor
        series.append({"date": d.isoformat(), "total_invertido": total_invertido, "valor_actual": total_valor})
    return series


def extend_to_today(series: list[dict], today) -> list[dict]:
    """A chart ending at its last real data point can look broken when that point
    is old (or the only one) — a dot stranded mid-chart with empty space after it.
    Carry the last known values flat to today, same as a stepAfter line implies."""
    if not series:
        return series
    today_str = today.isoformat()
    if series[-1]["date"] >= today_str:
        return series
    last = series[-1]
    return series + [{"date": today_str, "total_invertido": last["total_invertido"], "valor_actual": last["valor_actual"]}]


def composition(holdings) -> list[dict]:
    """holdings: iterable of (investment, stats) pairs. Real weight = share of
    total valor_actual; target weight = investment.target_weight as stored."""
    total_valor = sum(s["valor_actual"] for _, s in holdings) or 0.0
    return [
        {
            "investment_id": inv.id,
            "name": inv.name,
            "type": inv.type,
            "valor_actual": s["valor_actual"],
            "weight_real": (s["valor_actual"] / total_valor * 100) if total_valor > 0 else 0.0,
            "weight_target": inv.target_weight,
        }
        for inv, s in holdings
    ]
