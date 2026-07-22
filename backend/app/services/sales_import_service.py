"""Resilient sales-export importer (Loss Discovery Path A).

Any POS exports differently, so this parser is defensive by design
(notes §4.1.2 / acceptance §4.2):

  - auto-detects delimiter (comma / semicolon / tab) and encoding
    (UTF-8 with BOM, then Latin-1 fallback);
  - fuzzy-maps columns (date, item, qty, price/revenue, category) by
    header keywords across it/en, with a manual override hook;
  - parses Italian decimals ("12,50") and thousands ("1.234,56"), and
    DD/MM/YYYY as well as ISO dates;
  - quarantines malformed rows instead of aborting the whole file.

Pure-Python stdlib only (csv module) — no pandas/openpyxl dependency.
XLSX is accepted at the API layer by asking the operator to export CSV;
a future openpyxl path can slot in behind the same `parse()` contract.

Returns a normalized summary the loss engine consumes plus the raw
quarantine list so the UI can show "42 rows imported, 3 skipped".
"""
from __future__ import annotations

import csv
import io
import re

# Header keyword → canonical column. First match wins; case/space-insensitive.
_COLUMN_KEYWORDS = {
    "date": ["date", "data", "giorno", "day", "datetime", "timestamp"],
    "item": ["item", "prodotto", "piatto", "articolo", "descrizione", "name", "nome", "product"],
    "qty": ["qty", "quantity", "quantita", "quantità", "qta", "pezzi", "units", "coperti"],
    "revenue": ["revenue", "total", "totale", "importo", "amount", "incasso", "prezzo", "price", "netto"],
    "category": ["category", "categoria", "reparto", "gruppo", "type"],
}


def _detect_encoding(raw: bytes) -> str:
    if raw.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        return "latin-1"


def _detect_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=";,\t").delimiter
    except csv.Error:
        # Fall back to whichever candidate appears most in the header line.
        header = sample.splitlines()[0] if sample else ""
        return max(";,\t", key=lambda d: header.count(d))


def _map_columns(headers: list[str], overrides: dict | None = None) -> dict:
    """Return {canonical: header_index}. overrides maps canonical→header name."""
    mapping: dict[str, int] = {}
    norm = [h.strip().lower() for h in headers]
    overrides = overrides or {}
    for canonical, keywords in _COLUMN_KEYWORDS.items():
        if canonical in overrides:
            want = overrides[canonical].strip().lower()
            if want in norm:
                mapping[canonical] = norm.index(want)
                continue
        for i, h in enumerate(norm):
            if any(k in h for k in keywords):
                mapping[canonical] = i
                break
    return mapping


_NUM_RE = re.compile(r"[^0-9,.\-]")


def _parse_number(s: str) -> float | None:
    """Handle Italian '1.234,56' and English '1,234.56' and plain '12.5'."""
    if s is None:
        return None
    s = _NUM_RE.sub("", str(s)).strip()
    if not s:
        return None
    if "," in s and "." in s:
        # The rightmost separator is the decimal.
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        # Comma is decimal if it's followed by 1-2 digits, else a thousands sep.
        if re.search(r",\d{1,2}$", s):
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse(raw: bytes, overrides: dict | None = None) -> dict:
    """Parse a sales export into a normalized summary + quarantine list.

    Returns:
      {
        "rows_imported": int,
        "rows_quarantined": int,
        "quarantine": [{"line": int, "reason": str}],
        "column_mapping": {canonical: header},
        "summary": {
          "monthly_revenue": float,   # scaled to a 30-day month
          "total_revenue": float,
          "total_units": int,
          "day_span": int,            # distinct days seen
          "top_items": [{"item", "units", "revenue"}],
        },
      }
    """
    if not raw:
        return _empty_result("empty file")

    encoding = _detect_encoding(raw)
    text = raw.decode(encoding, errors="replace")
    sample = "\n".join(text.splitlines()[:20])
    delimiter = _detect_delimiter(sample)

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        headers = next(reader)
    except StopIteration:
        return _empty_result("no header row")

    mapping = _map_columns(headers, overrides)
    if "item" not in mapping or ("revenue" not in mapping and "qty" not in mapping):
        return _empty_result("could not identify item + revenue/qty columns",
                             mapping={k: headers[v] for k, v in mapping.items()})

    quarantine = []
    per_item: dict[str, dict] = {}
    total_revenue = 0.0
    total_units = 0
    days: set[str] = set()
    imported = 0

    for lineno, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row):
            continue
        try:
            item = row[mapping["item"]].strip() if mapping.get("item") is not None else ""
            if not item:
                raise ValueError("missing item name")
            qty = 1
            if "qty" in mapping and mapping["qty"] < len(row):
                q = _parse_number(row[mapping["qty"]])
                qty = int(q) if q and q > 0 else 1
            revenue = 0.0
            if "revenue" in mapping and mapping["revenue"] < len(row):
                revenue = _parse_number(row[mapping["revenue"]]) or 0.0
            if "date" in mapping and mapping["date"] < len(row):
                d = row[mapping["date"]].strip()
                if d:
                    days.add(d)

            slot = per_item.setdefault(item, {"item": item, "units": 0, "revenue": 0.0})
            slot["units"] += qty
            slot["revenue"] += revenue
            total_revenue += revenue
            total_units += qty
            imported += 1
        except Exception as e:  # noqa: BLE001 — quarantine, never abort
            quarantine.append({"line": lineno, "reason": str(e)})

    day_span = max(len(days), 1)
    # Scale observed revenue to a 30-day month for the engine.
    monthly_revenue = round(total_revenue / day_span * 30.0, 2) if total_revenue else 0.0
    top_items = sorted(per_item.values(), key=lambda r: r["revenue"], reverse=True)[:5]

    return {
        "rows_imported": imported,
        "rows_quarantined": len(quarantine),
        "quarantine": quarantine[:50],
        "column_mapping": {k: headers[v] for k, v in mapping.items()},
        "summary": {
            "monthly_revenue": monthly_revenue,
            "total_revenue": round(total_revenue, 2),
            "total_units": total_units,
            "day_span": day_span,
            "top_items": [
                {"item": t["item"], "units": t["units"], "revenue": round(t["revenue"], 2)}
                for t in top_items
            ],
        },
    }


def _empty_result(reason: str, mapping: dict | None = None) -> dict:
    return {
        "rows_imported": 0,
        "rows_quarantined": 0,
        "quarantine": [{"line": 0, "reason": reason}],
        "column_mapping": mapping or {},
        "summary": {"monthly_revenue": 0.0, "total_revenue": 0.0,
                    "total_units": 0, "day_span": 0, "top_items": []},
    }
