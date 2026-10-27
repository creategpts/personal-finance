"""On-demand price scrape from an FT markets tearsheet page, same source the
user's spreadsheet formula already used:
https://markets.ft.com/data/funds/tearsheet/summary?s=<symbol>
xpath: (//span[@class='mod-ui-data-list__value'])[1]

ponytail: single scrape function, no retry/backoff/cache. FT can change its
markup any time and break this — if it does, fall back to entering the price
manually on the holding (current_price is always editable)."""

import re
from datetime import date, datetime

import requests
from lxml import html

FT_URL = "https://markets.ft.com/data/funds/tearsheet/summary?s={symbol}"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; finance-tracker/1.0)"}


def symbol_for(ft_symbol: str | None, isin: str | None) -> str | None:
    return ft_symbol or (f"{isin}:EUR" if isin else None)


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


def fetch_ft_history(symbol: str, start: date, end: date) -> list[tuple[date, float]]:
    """Daily closes between start and end, oldest first. FT's historical table is
    loaded via an ajax endpoint keyed by an internal xid, which only the tearsheet
    page reveals — hence the two requests. Same fragility caveat as fetch_ft_price."""
    page = requests.get(FT_HISTORY_PAGE.format(symbol=symbol), headers=_HEADERS, timeout=10)
    page.raise_for_status()
    m = re.search(r"&quot;xid&quot;:&quot;(\d+)&quot;", page.text)
    if not m:
        raise ValueError(f"No se encontró el id interno FT para '{symbol}'")
    resp = requests.get(
        FT_HISTORY_AJAX,
        params={"startDate": start.strftime("%Y/%m/%d"), "endDate": end.strftime("%Y/%m/%d"), "symbol": m.group(1)},
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
