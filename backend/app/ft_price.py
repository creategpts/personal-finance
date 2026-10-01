"""On-demand price scrape from an FT markets tearsheet page, same source the
user's spreadsheet formula already used:
https://markets.ft.com/data/funds/tearsheet/summary?s=<symbol>
xpath: (//span[@class='mod-ui-data-list__value'])[1]

ponytail: single scrape function, no retry/backoff/cache. FT can change its
markup any time and break this — if it does, fall back to entering the price
manually on the holding (current_price is always editable)."""

import re

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
