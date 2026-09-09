"""Drive NovaSys EnergySale: search apartment, create payment, open receipt."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys
from pywinauto.mouse import click

LOG_DIR = Path(__file__).resolve().parent / "logs"
SCREEN_DIR = LOG_DIR / "screenshots"
NOVA_TITLE = r"(?i).*NovaSys EnergySale.*"


@dataclass
class ChargeResult:
    ok: bool
    dry_run: bool
    apartment: str
    tariff: str
    amount: str
    steps: list[str] = field(default_factory=list)
    error: str = ""
    screenshot: str = ""
    started_at: str = ""
    finished_at: str = ""


def find_novasys_window():
    desktop = Desktop(backend="uia")
    matches = desktop.windows(title_re=NOVA_TITLE)
    if not matches:
        raise RuntimeError("NovaSys EnergySale is not open.")
    visible = [w for w in matches if w.is_visible()]
    candidates = visible or matches
    return max(candidates, key=lambda w: w.rectangle().width() * w.rectangle().height())


def _center(rect):
    return ((rect.left + rect.right) // 2, (rect.top + rect.bottom) // 2)


class NovaSysRobot:
    def __init__(self) -> None:
        self.app: Application | None = None
        self.win = None
        self.notes: list[str] = []

    def log(self, message: str) -> None:
        self.notes.append(message)

    def connect(self):
        try:
            self.win = find_novasys_window()
        except Exception as exc:
            raise RuntimeError(
                "NovaSys EnergySale is not open. Open it and leave it logged in, then try again."
            ) from exc
        self.win.set_focus()
        time.sleep(0.3)
        self.app = Application(backend="uia").connect(handle=self.win.handle)
        self.log("Connected to NovaSys EnergySale.")

    def screenshot(self, name: str) -> Path:
        SCREEN_DIR.mkdir(parents=True, exist_ok=True)
        path = SCREEN_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{name}.png"
        try:
            self.win.capture_as_image().save(path)
            return path
        except Exception:
            pass
        from PIL import ImageGrab

        rect = self.win.rectangle() if self.win is not None else None
        if rect is not None:
            ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom)).save(path)
        else:
            ImageGrab.grab(all_screens=True).save(path)
        return path

    def _main(self):
        return self.app.window(handle=self.win.handle)

    def _child_window(self, title: str):
        try:
            w = self._main().child_window(title=title, control_type="Window")
            if w.exists(timeout=0.8) and w.is_visible():
                return w
        except Exception:
            return None
        return None

    def _click_button(self, parent, title: str):
        btn = parent.child_window(title=title, control_type="Button")
        btn.wait("exists", timeout=6)
        rect = btn.rectangle()
        click(coords=_center(rect))
        return btn

    def _login_window(self):
        desktop = Desktop(backend="win32")
        for title in (
            "Login to the NovaSyS",
            "Login to the NovaSys",
            "Logging in to NovaSys",
            "Logging on to NovaSys",
        ):
            try:
                w = desktop.window(title=title)
                if w.exists(timeout=0.4) and w.is_visible():
                    return w
            except Exception:
                continue
        return None

    def _fail_if_login(self) -> None:
        if self._login_window() is not None:
            raise RuntimeError(
                "NovaSys asked for a password. Type it in NovaSys yourself, click OK, then run again. Do not send the password in chat."
            )

    def _wait_for_login_if_needed(self, seconds: int = 90) -> None:
        dlg = self._login_window()
        if dlg is None:
            return
        self.log("NovaSys asked for a password. Waiting for you to type it there and click OK.")
        deadline = time.time() + seconds
        while time.time() < deadline:
            if self._login_window() is None:
                self.log("Login closed. Continuing.")
                time.sleep(0.4)
                return
            time.sleep(0.5)
        raise RuntimeError("Timed out waiting for the NovaSys login. Type the password in NovaSys, then try again.")

    def _close_invoice_if_open(self) -> None:
        invoice = self._child_window("Invoice")
        if invoice is None:
            return
        try:
            close = invoice.child_window(title="Close", control_type="Button")
            if close.exists(timeout=0.5):
                click(coords=_center(close.rectangle()))
                time.sleep(0.4)
                self.log("Closed leftover Invoice.")
                return
        except Exception:
            pass
        try:
            invoice.close()
            time.sleep(0.4)
            self.log("Closed leftover Invoice.")
        except Exception:
            self.log("Invoice was open; could not close it. Close it and try again.")

    def _open_payments(self) -> None:
        if self._child_window("Payment management") is not None:
            self.log("Payment management already open.")
            return
        btn = self._main().child_window(title="Payments (TOU Tariff)", control_type="Button")
        btn.wait("exists", timeout=6)
        rect = btn.rectangle()
        x, y = _center(rect)
        click(coords=(x, y))
        time.sleep(0.15)
        click(coords=(x, y))
        self.log("Double-clicked Payments (TOU Tariff).")
        time.sleep(1.2)
        if self._child_window("Payment management") is None:
            raise RuntimeError("Payment management did not open.")

    def _win32_main(self):
        app32 = Application(backend="win32").connect(handle=self.win.handle)
        return app32.window(handle=self.win.handle)

    def _personal_account_edit(self):
        main32 = self._win32_main()
        payment = None
        for child in main32.children():
            try:
                if child.window_text() == "Payment management":
                    payment = child
                    break
            except Exception:
                continue
        search_root = payment or main32
        edits = []
        for w in search_root.descendants():
            try:
                if "EDIT" not in (w.class_name() or "").upper():
                    continue
                if not w.is_visible():
                    continue
                rect = w.rectangle()
                if rect.width() < 8 or rect.height() < 8:
                    continue
                edits.append(w)
            except Exception:
                continue
        if not edits:
            raise RuntimeError("Could not find the Personal account search box.")
        # Toolbar record box sits near the Pay buttons. The grid filter is lower.
        grid = [e for e in edits if e.rectangle().top > 120]
        pick = max(grid or edits, key=lambda e: e.rectangle().top)
        return pick

    def _search_apartment(self, apartment: str) -> None:
        edit = self._personal_account_edit()
        rect = edit.rectangle()
        click(coords=_center(rect))
        time.sleep(0.2)
        send_keys("^a{BACKSPACE}")
        time.sleep(0.1)
        send_keys(apartment, with_spaces=True)
        send_keys("{ENTER}")
        self.log(f"Searched Personal account for {apartment}.")
        time.sleep(1.0)

    def _select_result_row(self, apartment: str) -> None:
        edit = self._personal_account_edit()
        rect = edit.rectangle()
        # One click on the result row under the filter box.
        click(coords=(rect.left + 8, rect.bottom + 18))
        self.log(f"Clicked the result row for {apartment}.")
        time.sleep(0.35)

    def _choose_automatic(self) -> None:
        pay = self._main().child_window(title="Pay", control_type="Button")
        pay.wait("exists", timeout=6)
        rect = pay.rectangle()
        arrow = (rect.right - 10, (rect.top + rect.bottom) // 2)
        click(coords=arrow)
        time.sleep(0.4)
        # WinForms ToolStrip menu is not in UIA. Manual is first, Automatic second.
        click(coords=(rect.left + 36, rect.bottom + 36))
        self.log("Clicked Pay -> Automatic.")
        time.sleep(0.6)
        self._wait_for_login_if_needed()
        time.sleep(0.4)

    def _create_payment_dialog(self):
        deadline = time.time() + 10
        while time.time() < deadline:
            dlg = self._child_window("Create payment")
            if dlg is not None:
                dlg.set_focus()
                self.log("Create payment window is open.")
                return dlg
            time.sleep(0.25)
        raise RuntimeError("Create payment did not open.")

    def _combo_and_edits(self, dlg):
        combos = []
        edits = []
        try:
            combos = dlg.descendants(control_type="ComboBox")
        except Exception:
            combos = []
        try:
            edits = [e for e in dlg.descendants(control_type="Edit") if e.is_visible()]
        except Exception:
            edits = []
        return combos, edits

    def _win32_create_payment(self):
        app32 = Application(backend="win32").connect(handle=self.win.handle)
        for w in app32.windows():
            try:
                if w.window_text() == "Create payment":
                    return w
            except Exception:
                continue
        return None

    def _win32_tariff_combo(self):
        pay = self._win32_create_payment()
        if pay is None:
            return None
        for d in pay.descendants():
            try:
                if "COMBOBOX" in (d.class_name() or "").upper() and d.is_visible():
                    return d
            except Exception:
                continue
        return None

    def _win32_amount_edit(self):
        pay = self._win32_create_payment()
        if pay is None:
            return None
        zero = None
        typed = None
        for d in pay.descendants():
            try:
                if "EDIT" not in (d.class_name() or "").upper() or not d.is_visible():
                    continue
                text = (d.window_text() or "").strip()
                if "kWh" in text or "IQD" in text or " " in text:
                    continue
                if text in {"0.00", "0.0", "0"}:
                    if zero is None:
                        zero = d
                    continue
                digits = text.replace(",", "").replace(".", "")
                if digits.isdigit() and len(digits) >= 4:
                    typed = d
            except Exception:
                continue
        return typed or zero

    @staticmethod
    def _shown_tariff(raw: str) -> str:
        text = (raw or "").strip().upper()
        if text == "T1" or text.startswith("T1"):
            return "T1"
        if text == "T2" or text.startswith("T2"):
            return "T2"
        return ""

    def _read_tariff(self, dlg=None) -> str:
        combo = self._win32_tariff_combo()
        if combo is None:
            return ""
        return self._shown_tariff(combo.window_text() or "")

    def _click_tariff_dropdown_item(self, combo, wanted: str) -> None:
        rect = combo.rectangle()
        click(coords=(rect.right - 10, (rect.top + rect.bottom) // 2))
        time.sleep(0.2)
        try:
            combo.select(wanted)
            time.sleep(0.2)
            return
        except Exception:
            pass
        offset = 16 if wanted == "T1" else 38
        click(coords=((rect.left + rect.right) // 2, rect.bottom + offset))
        time.sleep(0.25)

    def _set_tariff(self, dlg, tariff: str) -> None:
        wanted = tariff.strip().upper()
        if wanted not in {"T1", "T2"}:
            raise RuntimeError("Tariff must be T1 or T2.")
        combo = self._win32_tariff_combo()
        if combo is None:
            raise RuntimeError("Could not find Payment for tariff.")

        shown = self._shown_tariff(combo.window_text() or "")
        if shown == wanted:
            self.log(f"Tariff already {wanted}.")
            return

        self._click_tariff_dropdown_item(combo, wanted)
        shown = self._shown_tariff(combo.window_text() or "")
        if shown != wanted:
            raise RuntimeError(
                f"Tariff dropdown still shows {shown or 'blank'}, needed {wanted}. Stopped before Pay."
            )
        self.log(f"Tariff dropdown now {wanted}.")

    def _read_amount(self, dlg=None) -> str:
        box = self._win32_amount_edit()
        if box is None:
            return ""
        raw = (box.window_text() or "").replace(",", "").strip()
        return raw.split(".")[0].replace(" ", "")

    def _win32_apartment(self) -> str:
        pay = self._win32_create_payment()
        if pay is None:
            return ""
        for d in pay.descendants():
            try:
                if "EDIT" not in (d.class_name() or "").upper() or not d.is_visible():
                    continue
                text = (d.window_text() or "").strip()
                if text.upper().startswith(("ES-", "WW-")):
                    return text
            except Exception:
                continue
        return ""

    def _require_payment_matches(self, dlg, tariff: str, amount: str, apartment: str = "") -> None:
        wanted_t = tariff.strip().upper()
        wanted_a = str(amount).strip().replace(",", "").split(".")[0]
        shown_t = self._read_tariff()
        shown_a = self._read_amount()
        shown_apt = self._win32_apartment()
        if apartment and apartment.strip().upper() not in shown_apt.upper():
            raise RuntimeError(
                f"Will not Pay: apartment is {shown_apt or 'blank'}, needed {apartment}."
            )
        if shown_t != wanted_t:
            raise RuntimeError(
                f"Will not Pay: tariff dropdown is {shown_t or 'blank'}, needed {wanted_t}."
            )
        if shown_a != wanted_a:
            raise RuntimeError(
                f"Will not Pay: amount box is {shown_a or 'blank'}, needed {wanted_a}."
            )
        self.log(f"Double-checked Create payment: {shown_apt} {shown_t} {shown_a}.")

    def _set_amount(self, dlg, amount: str) -> None:
        box = self._win32_amount_edit()
        if box is None:
            raise RuntimeError("Could not find Payment amount.")
        wanted = str(amount).strip()
        click(coords=_center(box.rectangle()))
        time.sleep(0.1)
        try:
            box.set_edit_text("")
            box.set_edit_text(wanted)
        except Exception:
            send_keys("^a{BACKSPACE}")
            send_keys(wanted)
        time.sleep(0.2)
        shown = self._read_amount()
        if shown != wanted.split(".")[0]:
            raise RuntimeError(
                f"Amount box still shows {shown or 'blank'}, needed {wanted}. Stopped before Pay."
            )
        self.log(f"Amount box now {shown}.")

    def _click_dialog_pay(self, dlg) -> None:
        btn = dlg.child_window(title="Pay", control_type="Button")
        btn.wait("enabled", timeout=6)
        click(coords=_center(btn.rectangle()))
        self.log("Clicked Pay on Create payment.")
        time.sleep(1.2)

    def _maximize_invoice(self) -> None:
        deadline = time.time() + 12
        invoice = None
        while time.time() < deadline:
            invoice = self._child_window("Invoice")
            if invoice is not None:
                break
            time.sleep(0.25)
        if invoice is None:
            raise RuntimeError("Invoice / payment receipt did not open.")
        invoice.set_focus()
        try:
            restore = invoice.child_window(title="Restore", control_type="Button")
            if restore.exists(timeout=0.8):
                click(coords=_center(restore.rectangle()))
                self.log("Clicked Restore to make Invoice full screen.")
                time.sleep(0.4)
                return
        except Exception:
            pass
        try:
            invoice.maximize()
            self.log("Maximized Invoice.")
        except Exception:
            self.log("Invoice opened; could not maximize.")
        time.sleep(0.4)

    def run(self, apartment: str, tariff: str, amount: str, dry_run: bool) -> ChargeResult:
        result = ChargeResult(
            ok=False,
            dry_run=dry_run,
            apartment=apartment.strip(),
            tariff=tariff.strip().upper(),
            amount=str(amount).strip(),
            started_at=datetime.now().isoformat(timespec="seconds"),
        )
        try:
            if not result.apartment:
                raise RuntimeError("Apartment is empty.")
            if result.tariff not in {"T1", "T2"}:
                raise RuntimeError("Tariff must be T1 or T2.")
            if not result.amount:
                raise RuntimeError("Amount is empty.")

            self.connect()
            self._fail_if_login()
            self._close_invoice_if_open()
            self._open_payments()
            self._search_apartment(result.apartment)
            self._select_result_row(result.apartment)
            self._choose_automatic()
            dlg = self._create_payment_dialog()
            self._set_tariff(dlg, result.tariff)
            self._set_amount(dlg, result.amount)
            self._require_payment_matches(dlg, result.tariff, result.amount, result.apartment)

            shot = self.screenshot("before-pay")
            result.screenshot = str(shot)

            if dry_run:
                self.log("Dry run: stopped before Pay. Check Create payment, then Cancel.")
                result.ok = True
            else:
                self._require_payment_matches(dlg, result.tariff, result.amount, result.apartment)
                self._click_dialog_pay(dlg)
                self._maximize_invoice()
                shot = self.screenshot("receipt")
                result.screenshot = str(shot)
                result.ok = True
                self.log("Charge finished. Receipt is on screen.")
        except Exception as exc:
            result.error = str(exc)
            self.log(f"Stopped: {exc}")
            try:
                shot = self.screenshot("error")
                result.screenshot = str(shot)
            except Exception:
                pass
        result.steps = list(self.notes)
        result.finished_at = datetime.now().isoformat(timespec="seconds")
        return result


def inspect_novasys() -> str:
    win = find_novasys_window()
    win.set_focus()
    lines = [f"Window: {win.window_text()}", ""]
    for desc in win.descendants():
        try:
            info = desc.element_info
            text = (info.name or "").strip()
            ctype = info.control_type
            if not text and ctype not in {"Edit", "ComboBox", "Button", "SplitButton"}:
                continue
            lines.append(f"{ctype:16} | {text}")
        except Exception:
            continue
    return "\n".join(lines[:400])
