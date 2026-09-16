"""Write Charging Electricity after Pay / skip. Does not wait for this chat."""
from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SHOT = ROOT / "logs" / "screenshots"
SQL_DIR = ROOT / "logs"
PUBLIC = "https://nobcitpaudeopzfymgzi.supabase.co/storage/v1/object/public/empire-photos"


def _digits(ru: str) -> str:
    return "".join(ch for ch in ru if ch.isdigit())


def _sql_str(value: str) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sql_ts(value: str) -> str:
    raw = (value or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", raw):
        raw = utc_iso()
    raw = raw.replace("'", "")[:40]
    return f"{_sql_str(raw)}::timestamptz"


def _ym() -> str:
    return datetime.now(ZoneInfo("Asia/Baghdad")).strftime("%Y-%m")


def _invoice_path(ru: str) -> Path:
    return SHOT / f"invoice-RU-{_digits(ru)}.jpg"


def _invoice_url(ru: str) -> str:
    return f"{PUBLIC}/charging/{_ym()}/ru-{_digits(ru)}.jpg"


def _run(cmd: str, timeout: int) -> str:
    r = subprocess.run(
        cmd,
        cwd=str(REPO),
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=True,
    )
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        raise RuntimeError(out[-1200:] or f"exit {r.returncode}")
    return out


def _upload(ru: str) -> str:
    src = _invoice_path(ru)
    if not src.exists() or src.stat().st_size < 2000:
        raise RuntimeError(f"missing invoice {src}")
    dest = f"ss:///empire-photos/charging/{_ym()}/ru-{_digits(ru)}.jpg"
    _run(
        "npx supabase storage cp --experimental --linked --content-type image/jpeg "
        f'"{src}" "{dest}"',
        timeout=70,
    )
    return _invoice_url(ru)


def _upsert(sql: str, name: str) -> None:
    SQL_DIR.mkdir(parents=True, exist_ok=True)
    path = SQL_DIR / name
    path.write_text(sql, encoding="utf-8")
    out = _run(
        f'npx supabase db query --linked --file "{path}"',
        timeout=90,
    )
    print("dashboard", out[-500:].strip())


def save_charged(
    *,
    ru: str,
    unit: str,
    amount: str,
    source: str,
    tariff: str = "",
    note: str = "",
    started_at: str = "",
    charged_at: str = "",
) -> None:
    url = _upload(ru)
    electric = "generator" if tariff == "T2" else "national"
    if source == "overseas":
        note = note or "Overseas STS Recharge."
    else:
        note = note or "Nova Pay."
    started = _sql_ts(started_at)
    finished = _sql_ts(charged_at or utc_iso())
    sql = f"""insert into charging_requests (
  id, ru, unit_id, nova_search, electric_type, tariff, amount, status, note, invoice_url,
  retry_requested, source, created_by, updated_by, started_at, charged_at, created_at, updated_at
) values (
  gen_random_uuid()::text, {_sql_str(ru)}, {_sql_str(unit)}, {_sql_str(unit)},
  {_sql_str(electric)}, {_sql_str(tariff or "T1")}, {_sql_str(str(amount))}, 'charged',
  {_sql_str(note)}, {_sql_str(url)},
  false, {_sql_str(source)}, 'charge-robot', 'charge-robot', {started}, {finished}, now(), now()
)
on conflict (ru) do update set
  unit_id = excluded.unit_id,
  nova_search = excluded.nova_search,
  electric_type = excluded.electric_type,
  tariff = excluded.tariff,
  amount = excluded.amount,
  status = 'charged',
  note = excluded.note,
  invoice_url = excluded.invoice_url,
  retry_requested = false,
  source = excluded.source,
  updated_by = excluded.updated_by,
  started_at = excluded.started_at,
  charged_at = excluded.charged_at,
  updated_at = now()
returning ru, status, unit_id, amount, source;
"""
    _upsert(sql, f"save_{_digits(ru)}.sql")
    print("dashboard saved", ru, unit, amount, source, started_at, charged_at)


def save_skip(
    *,
    ru: str,
    unit: str,
    status: str,
    note: str,
    source: str,
    amount: str = "",
    tariff: str = "",
    started_at: str = "",
) -> None:
    electric = "generator" if tariff == "T2" else "national"
    started = _sql_ts(started_at)
    sql = f"""insert into charging_requests (
  id, ru, unit_id, nova_search, electric_type, tariff, amount, status, note, invoice_url,
  retry_requested, source, created_by, updated_by, started_at, charged_at, created_at, updated_at
) values (
  gen_random_uuid()::text, {_sql_str(ru)}, {_sql_str(unit)}, {_sql_str(unit)},
  {_sql_str(electric)}, {_sql_str(tariff)}, {_sql_str(str(amount))}, {_sql_str(status)},
  {_sql_str(note)}, '',
  false, {_sql_str(source)}, 'charge-robot', 'charge-robot', {started}, null, now(), now()
)
on conflict (ru) do update set
  unit_id = excluded.unit_id,
  nova_search = excluded.nova_search,
  electric_type = excluded.electric_type,
  tariff = excluded.tariff,
  amount = excluded.amount,
  status = excluded.status,
  note = excluded.note,
  invoice_url = excluded.invoice_url,
  retry_requested = false,
  source = excluded.source,
  updated_by = excluded.updated_by,
  started_at = excluded.started_at,
  updated_at = now()
returning ru, status, unit_id, amount, source;
"""
    _upsert(sql, f"save_{_digits(ru)}.sql")
    print("dashboard skip", ru, status, unit)
