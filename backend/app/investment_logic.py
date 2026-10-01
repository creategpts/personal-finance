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


def portfolio_summary(stats_list: list[dict]) -> dict:
    total_invertido = sum(s["total_invertido"] for s in stats_list)
    valor_actual = sum(s["valor_actual"] for s in stats_list)
    plusvalia = valor_actual - total_invertido
    rentabilidad = (plusvalia / total_invertido * 100) if total_invertido > 0 else 0.0
    return {
        "total_invertido": total_invertido,
        "valor_actual": valor_actual,
        "plusvalia": plusvalia,
        "rentabilidad": rentabilidad,
    }


def _step_series(transactions):
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


def _value_at(steps, prices, d):
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


def portfolio_time_series(holdings) -> list[dict]:
    """holdings: iterable of (transactions, snapshots) pairs, snapshots having
    .date/.price. Returns one point per date any holding has a transaction or a
    price snapshot, summing total_invertido and valor_actual across holdings."""
    prepared = [(_step_series(transactions), sorted(((s.date, s.price) for s in snapshots))) for transactions, snapshots in holdings]

    all_dates = sorted(
        {d for steps, _ in prepared for d, _, _ in steps} | {d for _, prices in prepared for d, _ in prices}
    )

    series = []
    for d in all_dates:
        total_invertido = total_valor = 0.0
        for steps, prices in prepared:
            invertido, valor = _value_at(steps, prices, d)
            total_invertido += invertido
            total_valor += valor
        series.append({"date": d.isoformat(), "total_invertido": total_invertido, "valor_actual": total_valor})
    return series


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
