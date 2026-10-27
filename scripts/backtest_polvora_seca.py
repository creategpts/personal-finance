"""Backtest de la estrategia de "pólvora seca" (drawdown desde máximos) frente a invertir todo desde el día 1.

Cartera: 75% mundo desarrollado + 15% emergentes + 10% small caps, rebalanceada cada mes.
Datos: Ken French Data Library (rentabilidades mensuales total return en USD, Bloomberg).
  - Desarrollados  = Mkt-RF + RF de Developed_3_Factors
  - Emergentes     = Mkt-RF + RF de Emerging_5_Factors
  - Small caps     = media de las 3 carteras SMALL de Developed_6_Portfolios_ME_OP (value-weighted)
  - Caja           = RF (T-bill USD); también se prueba con caja al 0%.
Son proxies, no los índices MSCI exactos, y todo va en USD (sin efecto divisa EUR/USD).

Uso: python3 scripts/backtest_polvora_seca.py [--sin-diciembre] [--en-maximos]
"""
import io
import statistics
import sys
import urllib.request
import zipfile

BASE = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/"
START = 200001
W_DEV, W_EM, W_SMALL = 0.75, 0.15, 0.10

BASE_MONTHLY = 1500.0
RESERVE = 20000.0
DEC_PACKAGE = 4000.0   # regla de diciembre
DEC_RULE = "--sin-diciembre" not in sys.argv
EN_MAXIMOS = "--en-maximos" in sys.argv  # ventanas solo si empiezan a menos de un 2% del máximo
LEVEL3_BLOCK = 4000.0  # bloque extraordinario (entre 3.000 y 5.000)


def fetch_csv(name):
    raw = urllib.request.urlopen(BASE + name + "_CSV.zip", timeout=30).read()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        return z.read(z.namelist()[0]).decode("latin-1").splitlines()


def monthly_rows(lines, start_after=0):
    """Filas YYYYMM,... hasta que acaba la primera sección mensual."""
    rows = {}
    seen = False
    for line in lines[start_after:]:
        parts = [p.strip() for p in line.split(",")]
        if parts and len(parts[0]) == 6 and parts[0].isdigit():
            rows[int(parts[0])] = [float(p) for p in parts[1:]]
            seen = True
        elif seen:
            break
    return rows


def load():
    dev = monthly_rows(fetch_csv("Developed_3_Factors"))
    em = monthly_rows(fetch_csv("Emerging_5_Factors"))
    lines = fetch_csv("Developed_6_Portfolios_ME_OP")
    i = next(k for k, l in enumerate(lines) if "Average Value Weighted Returns -- Monthly" in l)
    header = [h.strip() for h in lines[i + 1].split(",")]
    # columnas: SMALL LoOP, ME1 OP2, SMALL HiOP (small) y BIG LoOP, ME2 OP2, BIG HiOP (big)
    assert header[1:4] == ["SMALL LoOP", "ME1 OP2", "SMALL HiOP"], header
    small_cols = [0, 1, 2]
    sm = monthly_rows(lines, i + 2)

    months = sorted(m for m in dev if m >= START and m in em and m in sm)
    dev_r, blend, cash, dev_idx = [], [], [], []
    for m in months:
        rf = dev[m][3]
        r_dev = dev[m][0] + rf
        r_em = em[m][0] + em[m][5]
        r_sm = sum(sm[m][c] for c in small_cols) / 3
        assert all(x > -99 for x in (r_dev, r_em, r_sm)), m
        dev_r.append(r_dev / 100)
        blend.append((W_DEV * r_dev + W_EM * r_em + W_SMALL * r_sm) / 100)
        cash.append(rf / 100)
    return months, dev_r, blend, cash


def simulate(start, end, dev_r, blend, cash, reserve, base=BASE_MONTHLY, rules=True, cash_on=True, refill=0.0):
    """Simula los meses [start, end). Cada mes: se compra a precio de cierre del mes anterior y luego rinde el mes.

    reserve = caja total reservada como pólvora. Lo que no es pólvora se invierte el día 1.
    refill  = € al mes de la aportación base que repone la pólvora hasta `reserve`, solo con el
              mercado a menos de un 10% de máximos y sin haber desplegado nada ese mes.
    Devuelve (patrimonio final, flujos [(mes, importe)], estadísticas).
    """
    equity, powder = 0.0, reserve
    flows = [(0, -reserve)] if reserve else []
    stats = {"lvl1": 0, "lvl2": 0, "lvl3": 0, "lvl4": 0, "dec": 0, "refilled": 0.0}
    armed3 = True
    plan4 = 0.0  # cuota mensual comprometida del Nivel 4
    plan4_left = 0
    year_activated = False
    year = None

    for k, t in enumerate(range(start, end)):
        # el día 1 el drawdown se mide con el cierre del mes anterior
        dd = DD_START[t]
        month_no = (MONTHS[t] % 100)
        if year != MONTHS[t] // 100:
            year, year_activated = MONTHS[t] // 100, False

        buy = base
        flows.append((k, -base))
        if rules:
            extra = 0.0
            has_powder = powder > 0
            if dd > -0.10:
                armed3 = True
            elif dd > -0.15:
                extra = 0.5 * base
                stats["lvl1"] += has_powder
            elif dd > -0.20:
                extra = 1.0 * base
                stats["lvl2"] += has_powder
            elif dd > -0.30:
                extra = 1.0 * base  # cuota reforzada mientras dure el tramo
                if armed3:
                    extra += LEVEL3_BLOCK
                    armed3 = False
                stats["lvl3"] += has_powder
            else:
                if plan4_left == 0 and has_powder:
                    plan4_left, plan4 = 6, powder / 6
                    stats["lvl4"] += 1
            if plan4_left > 0:  # el reparto de 6 meses se completa aunque el mercado rebote
                extra = max(extra, plan4)
                plan4_left -= 1
            if extra:
                year_activated = True
            elif DEC_RULE and month_no == 12 and not year_activated and has_powder:
                extra = DEC_PACKAGE
                stats["dec"] += 1
            extra = min(extra, powder)
            powder -= extra
            buy += extra
            if extra == 0 and dd > -0.10 and plan4_left == 0 and powder < reserve:
                top = min(refill, reserve - powder, base)
                powder += top
                buy -= top
                stats["refilled"] += top

        equity = (equity + buy) * (1 + blend[t])
        if cash_on:
            powder *= 1 + cash[t]

    final = equity + powder
    flows.append((end - start, final))
    return final, flows, stats


def irr_annual(flows):
    """TIR mensual por bisección -> anualizada."""
    def npv(r):
        return sum(c / (1 + r) ** t for t, c in flows)
    lo, hi = -0.05, 0.10
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(mid) > 0:
            lo = mid
        else:
            hi = mid
    return (1 + lo) ** 12 - 1


def run(label, start, end, dev_r, blend, cash, reserve, rules, cash_on=True):
    # Los flujos de aportación base son idénticos en todas las variantes, así que la
    # reserva inicial se trata como dinero aportado el mes 0.
    final, flows, st = simulate(start, end, dev_r, blend, cash, reserve, rules=rules, cash_on=cash_on)
    return final, irr_annual(flows), st


MONTHS = []
DD_START = []  # drawdown del índice desarrollado al empezar cada mes, desde el máximo de toda la serie


def main():
    global MONTHS
    MONTHS, dev_r, blend, cash = load()
    n = len(MONTHS)
    level = peak = 1.0
    for r in dev_r:
        DD_START.append(level / peak - 1)
        level *= 1 + r
        peak = max(peak, level)
    for name, ser in (("Desarrollados", dev_r), ("Cartera 75/15/10", blend), ("Caja (RF)", cash)):
        g = 1.0
        for r in ser:
            g *= 1 + r
        print(f"CAGR {name:18s} {g ** (12 / n) - 1:6.2%}")
    print(f"Peor drawdown desarrollados: {min(DD_START):.1%}")
    print(f"Datos: {MONTHS[0]} a {MONTHS[-1]} ({n} meses)\n")

    # Todas las variantes reciben los mismos 20.000 € iniciales + 1.500 €/mes.
    # Para reserva < 20.000 el resto se invierte el día 1: modelado como lump + reserva.
    def variant(reserve, rules, cash_on=True, start=0, end=n, refill=0.0):
        eq0 = 20000.0 - reserve  # el resto de los 20.000 € iniciales se invierte el día 1
        final, flows, st = simulate(start, end, dev_r, blend, cash, reserve, rules=rules, cash_on=cash_on, refill=refill)
        g = 1.0
        for t in range(start, end):
            g *= 1 + blend[t]
        return final + eq0 * g, st

    def fmt(st):
        return (f"N1 {st['lvl1']} N2 {st['lvl2']} N3 {st['lvl3']} N4 {st['lvl4']} dic {st['dec']}"
                f" repuesto {st['refilled']:,.0f}")

    configs = [(r, f) for r in (20000, 10000, 6000) for f in (0, 500, 1000)]
    base_all, _ = variant(0, False)
    print(f"=== Período completo (A = todo invertido el día 1: {base_all:,.0f}) ===")
    for reserve, refill in configs:
        w, st = variant(reserve, True, refill=refill)
        w0, _ = variant(reserve, True, cash_on=False, refill=refill)
        print(f"reserva {reserve:>6,} reposición {refill:>5,}/mes  final {w:>10,.0f} ({w / base_all - 1:+6.2%})"
              f"  caja 0%: {w0 / base_all - 1:+6.2%}   {fmt(st)}")

    for H in (60, 120):
        starts = [s0 for s0 in range(0, n - H + 1) if not EN_MAXIMOS or DD_START[s0] > -0.02]
        print(f"\n=== Ventanas móviles de {H // 12} años ({len(starts)} inicios{', en máximos' if EN_MAXIMOS else ''}) ===")
        for reserve, refill in configs:
            for cash_on in (True, False):
                ratios = []
                for s0 in starts:
                    a, _ = variant(0, False, cash_on, s0, s0 + H)
                    b, _ = variant(reserve, True, cash_on, s0, s0 + H, refill)
                    ratios.append(b / a - 1)
                wins = sum(r > 0 for r in ratios) / len(ratios)
                print(f"reserva {reserve:>6,} repone {refill:>5,}  caja {'RF' if cash_on else '0%'}: gana en {wins:5.1%}"
                      f"  mediana {statistics.median(ratios):+6.2%}  peor {min(ratios):+6.2%}  mejor {max(ratios):+6.2%}")


if __name__ == "__main__":
    main()
