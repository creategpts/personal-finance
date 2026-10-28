"""On-demand price scrape from an FT markets tearsheet page, same source the
user's spreadsheet formula already used:
https://markets.ft.com/data/funds/tearsheet/summary?s=<symbol>
xpath: (//span[@class='mod-ui-data-list__value'])[1]

ponytail: single scrape function, no retry/backoff/cache. FT can change its
markup any time and break this — if it does, fall back to entering the price
manually on the holding (current_price is always editable)."""

import re
from datetime import date, datetime, timedelta

import requests
from lxml import html

FT_URL = "https://markets.ft.com/data/funds/tearsheet/summary?s={symbol}"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; finance-tracker/1.0)"}


def symbol_for(ft_symbol: str | None, isin: str | None) -> str | None:
    if ft_symbol:
        return ft_symbol
    if not isin:
        return None
    return isin if ":" in isin else f"{isin}:EUR"  # un ISIN guardado ya con divisa (ISIN:USD) es el símbolo


FT_SEARCH = "https://markets.ft.com/data/searchapi/searchsecurities"


def search_symbol(isin: str) -> str | None:
    """Símbolo FT real de un ISIN (p. ej. 'IE00BDZVHT63:USD'): no todos cotizan en EUR.
    Prefiere EUR y luego el listado principal."""
    resp = requests.get(FT_SEARCH, params={"query": isin}, headers=_HEADERS, timeout=10)
    resp.raise_for_status()
    found = [
        sec
        for sec in resp.json().get("data", {}).get("security", [])
        if sec.get("assetClass") == "Funds" and str(sec.get("symbol", "")).upper().startswith(isin.upper() + ":")
    ]
    found.sort(key=lambda sec: (not sec["symbol"].endswith(":EUR"), not sec.get("isPrimary")))
    return found[0]["symbol"] if found else None


def lookup_isin(isin: str) -> tuple[str, float]:
    """(símbolo, precio en EUR) de un ISIN: prueba ISIN:EUR y, si FT no lo tiene, el que devuelva su buscador."""
    symbol = f"{isin}:EUR"
    try:
        return symbol, fetch_ft_price_eur(symbol)
    except Exception:
        found = search_symbol(isin)
        if not found or found == symbol:
            raise
        return found, fetch_ft_price_eur(found)


def fetch_ft_price(symbol: str) -> float:
    resp = requests.get(FT_URL.format(symbol=symbol), headers=_HEADERS, timeout=10)
    resp.raise_for_status()
    tree = html.fromstring(resp.text)
    nodes = tree.xpath("(//span[@class='mod-ui-data-list__value'])[1]")
    if not nodes:
        raise ValueError(f"No se encontró el valor en la página FT para '{symbol}'")
    text = nodes[0].text_content().strip()
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
    if not cleaned:
        raise ValueError(f"Valor no numérico en la página FT para '{symbol}': '{text}'")
    return float(cleaned)


FT_HISTORY_PAGE = "https://markets.ft.com/data/funds/tearsheet/historical?s={symbol}"
FT_HISTORY_AJAX = "https://markets.ft.com/data/equities/ajax/get-historical-prices"


def _ajax_history(xid: str, start: date, end: date) -> list[tuple[date, float]]:
    resp = requests.get(
        FT_HISTORY_AJAX,
        params={"startDate": start.strftime("%Y/%m/%d"), "endDate": end.strftime("%Y/%m/%d"), "symbol": xid},
        headers=_HEADERS,
        timeout=20,
    )
    resp.raise_for_status()
    rows = html.fromstring(f"<table>{resp.json().get('html', '')}</table>").xpath("//tr")
    out = []
    for row in rows:
        cells = row.xpath("./td")
        if len(cells) < 5:
            continue
        label = cells[0].xpath("./span[1]")[0].text_content().strip()
        day = datetime.strptime(label, "%A, %B %d, %Y").date()
        close = float(re.sub(r"[^\d.]", "", cells[4].text_content().replace(",", "")))
        out.append((day, close))
    return sorted(out)


def fetch_ft_history(symbol: str, start: date, end: date) -> list[tuple[date, float]]:
    """Daily closes between start and end, oldest first. FT's historical table is
    loaded via an ajax endpoint keyed by an internal xid, which only the tearsheet
    page reveals — hence the two requests. Same fragility caveat as fetch_ft_price."""
    page = requests.get(FT_HISTORY_PAGE.format(symbol=symbol), headers=_HEADERS, timeout=10)
    page.raise_for_status()
    m = re.search(r"&quot;xid&quot;:&quot;(\d+)&quot;", page.text)
    if not m:
        raise ValueError(f"No se encontró el id interno FT para '{symbol}'")
    return _ajax_history(m.group(1), start, end)


# --- Fondos que no cotizan en EUR: el precio se convierte a euros con el cambio de FT.
# ponytail: el spot trae 4 decimales pero el histórico de divisas de FT viene redondeado a 2
# (error de hasta ~0,5% por día en los precios históricos de esos fondos). Si ese ruido molesta,
# cambiar fetch_fx_history por otra fuente (p. ej. BCE) sin tocar el resto.
FT_FX_SUMMARY = "https://markets.ft.com/data/currencies/tearsheet/summary?s={pair}"


def currency_of(symbol: str) -> str:
    return symbol.rsplit(":", 1)[1].upper() if ":" in symbol else "EUR"


_FX_TTL = timedelta(minutes=5)
_fx_cache: dict[str, tuple[datetime, float]] = {}


def fetch_fx_rate(currency: str) -> float:
    """Unidades de `currency` por 1 EUR (FT: EURUSD = 1.11). Cacheado 5 min por proceso: la página
    sincroniza todos los fondos a la vez y no hace falta pedir el mismo cambio varias veces."""
    now = datetime.utcnow()
    hit = _fx_cache.get(currency)
    if hit and now - hit[0] < _FX_TTL:
        return hit[1]
    rate = fetch_ft_price(f"EUR{currency}")
    _fx_cache[currency] = (now, rate)
    return rate


def fetch_fx_history(currency: str, start: date, end: date) -> list[tuple[date, float]]:
    page = requests.get(FT_FX_SUMMARY.format(pair=f"EUR{currency}"), headers=_HEADERS, timeout=10)
    page.raise_for_status()
    m = re.search(r"&quot;xid&quot;:&quot;(\d+)&quot;", page.text)
    if not m:
        raise ValueError(f"No se encontró el id interno FT para EUR{currency}")
    return _ajax_history(m.group(1), start, end)


def fetch_ft_price_eur(symbol: str) -> float:
    price = fetch_ft_price(symbol)
    currency = currency_of(symbol)
    return price if currency == "EUR" else price / fetch_fx_rate(currency)


def fetch_ft_history_eur(symbol: str, start: date, end: date) -> list[tuple[date, float]]:
    rows = fetch_ft_history(symbol, start, end)
    currency = currency_of(symbol)
    if currency == "EUR" or not rows:
        return rows
    rates = fetch_fx_history(currency, start - timedelta(days=10), end)  # margen: fines de semana y festivos
    if not rates:
        raise ValueError(f"FT no devolvió tipos de cambio EUR{currency}")
    out = []
    for day, price in rows:
        known = [r for d, r in rates if d <= day]
        out.append((day, price / (known[-1] if known else rates[0][1])))
    return out
