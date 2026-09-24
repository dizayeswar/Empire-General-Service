"""Website Bot On/Off. Off = stop everything. Never block the phone on npx."""
from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "logs" / "bot_switch.cache"
API = "https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api"
REST = "https://nobcitpaudeopzfymgzi.supabase.co/rest/v1/charging_bot_state?id=eq.default&select=enabled"
ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vYmNpdHBhdWRlb3B6ZnltZ3ppIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3ODQxMjEyNzMsImV4cCI6MjA5OTY5NzI3M30.mI4SBx5klT_FN6EPQNrGYaWKuujaRGADYEkr00zJorQ"
)
HTTP_TIMEOUT = 2.5
CACHE_ON_SEC = 180
CACHE_OFF_SEC = 12
PREFETCH_ON_SEC = 15

_bg_lock = threading.Lock()
_bg_started = 0.0


def _load() -> dict | None:
    try:
        data = json.loads(CACHE.read_text(encoding="utf-8"))
        age = time.time() - float(data.get("t") or 0)
        if age < 0:
            return None
        return {"on": data.get("on"), "age": age}
    except Exception:
        return None


def _write_cache(on: bool) -> None:
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps({"t": time.time(), "on": on}), encoding="utf-8")
    except Exception:
        pass


def _parse_enabled(raw) -> bool | None:
    if raw is True:
        return True
    if raw is False:
        return False
    if isinstance(raw, str):
        low = raw.strip().lower()
        if low in {"true", "1", "on"}:
            return True
        if low in {"false", "0", "off"}:
            return False
    return None


def _http_json(url: str, data: bytes | None, headers: dict, timeout: float):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    return json.loads(body)


def _query_rest() -> bool | None:
    headers = {
        "apikey": ANON,
        "Authorization": f"Bearer {ANON}",
        "Accept": "application/json",
    }
    try:
        rows = _http_json(REST, None, headers, HTTP_TIMEOUT)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    if not isinstance(rows, list) or not rows:
        return None
    return _parse_enabled(rows[0].get("enabled"))


def _query_api() -> bool | None:
    payload = json.dumps({"action": "getChargingBotEnabled"}).encode("utf-8")
    headers = {"Content-Type": "application/json", "apikey": ANON, "Authorization": f"Bearer {ANON}"}
    try:
        data = _http_json(API, payload, headers, HTTP_TIMEOUT)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    if not isinstance(data, dict):
        return None
    if "enabled" in data:
        return _parse_enabled(data.get("enabled"))
    bot = data.get("bot")
    if isinstance(bot, dict):
        return _parse_enabled(bot.get("enabled"))
    return None


def _query_switch() -> bool | None:
    """HTTP only. Never npx — that freeze blocked the phone for 12–60s."""
    on = _query_rest()
    if on is None:
        on = _query_api()
    if on is True:
        _write_cache(True)
        return True
    if on is False:
        _write_cache(False)
        return False
    print("BOT_SWITCH unread — treat as Off")
    return None


def _kick_bg() -> None:
    global _bg_started
    now = time.time()
    with _bg_lock:
        if now - _bg_started < PREFETCH_ON_SEC:
            return
        _bg_started = now

    def run() -> None:
        try:
            _query_switch()
        except Exception:
            pass

    threading.Thread(target=run, daemon=True).start()


def bot_is_on(*, fresh: bool = False) -> bool | None:
    """True / False if the website switch was read. None = unread. Never blocks on npx."""
    hit = _load()
    if hit is not None:
        on, age = hit.get("on"), float(hit.get("age") or 0)
        if on is False and age < CACHE_OFF_SEC:
            if fresh:
                got = _query_switch()
                return False if got is None else got
            return False
        if on is True and age < CACHE_ON_SEC:
            if age >= PREFETCH_ON_SEC or fresh:
                _kick_bg()
            if fresh:
                got = _query_switch()
                if got is False:
                    return False
                if got is True:
                    return True
            return True

    return _query_switch()


def require_bot_on(*, fresh: bool = False, allow_unread: bool = False) -> None:
    on = bot_is_on(fresh=fresh)
    if on is True:
        return
    if on is None and allow_unread:
        print("BOT_SWITCH unread — leftover SET PIN still runs")
        return
    print("BOT_OFF stop (no Pay, no SET PIN, no phone, no PLANB)")
    if on is False:
        raise SystemExit(3)
    raise SystemExit(4)


if __name__ == "__main__":
    v = bot_is_on(fresh=True)
    print("BOT_ON" if v is True else "BOT_OFF" if v is False else "BOT_UNREAD")
