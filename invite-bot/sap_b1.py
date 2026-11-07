"""Put the phone number on the unit in SAP Business One.

Works through the SAP UI API on the SAP window that is already open and logged in,
following the same steps a person does (recorded 2026-11-07 on ES-4-8-09):

  1. F6 / Business Partner Master Data (menu 2561), opens in Find mode
  2. '*' in Code, Find -> "List of Business Partners"
  3. Sort by Unit Code (the arrow next to Unit Code)
  4. Pick the row whose Unit Code is exactly the apartment (the bot reads the list
     itself - SAP's Find box ignores text typed by a program and would leave the
     wrong row highlighted), then Choose
  5. Check Property Detail = apartment
  6. Phone into E-Mail, Mobile App. No. and Username (old number / NA / gmail replaced)
  7. Sync To Portal = Yes, Update, wait for success
  8. Glitch fix: Sync To Portal No -> Yes, Update again, wait for success
  9. OK
 10. Watch PortalError for 30 s (re-open the BP): any message = report and stop
     (no portal invitation)

SAP must be opened from the Start menu, NOT the Desktop shortcut: that one runs as
administrator and the bot cannot reach it.

Any problem raises SapError and leaves the SAP window as it is, so a person can see it.
"""
import re
import time
import xml.etree.ElementTree as ET

# SAP's public development connection string for the UI API (same for every installation).
_DEV_CONNECTION = ("0030002C0030002C00530041005000420044005F00440061007400650076002C"
                   "0050004C006F006D0056004900490056")

BP_MENU = "2561"          # Business Partner Master Data
BP_FORM = "134"
LIST_FORM = "10001"       # List of Business Partners

FIND_MODE, OK_MODE, UPDATE_MODE = 0, 1, 2

# Business Partner Master Data items
CODE = "5"
PROPERTY_DETAIL = "41"    # Unit Code (OCRD.LicTradNum)
EMAIL = "60"
MOBILE_APP_NO = "185"
USERNAME = "U_Username"
SYNC_TO_PORTAL = "U_PortalSync"
PORTAL_ERROR = "U_PortalError"
PORTAL_ERROR_WATCH = 30   # seconds to watch PortalError after the second update
PORTAL_ERROR_EVERY = 3    # re-open the BP this often while watching
BTN_OK = "1"              # Find / OK / Update depending on mode
PHONE_BOXES = {"E-Mail": EMAIL, "Mobile App. No.": MOBILE_APP_NO, "Username": USERNAME}

# List of Business Partners items
LIST_MATRIX = "7"
LIST_CHOOSE = "1"
LIST_CANCEL = "2"
COL_UNIT = "LicTradNum"
COL_CODE = "CardCode"

_app = None


class SapError(Exception):
    pass


def _application():
    global _app
    if _app is not None:
        try:
            _app.Company.Name
            return _app
        except Exception:
            _app = None
    import win32com.client
    gui = win32com.client.Dispatch("SAPbouiCOM.SboGuiApi")
    try:
        gui.Connect(_DEV_CONNECTION)
    except Exception as e:
        raise SapError("Cannot reach SAP. Is it open, logged in, and started from the "
                       f"Start menu (not as administrator)? ({e})")
    _app = gui.GetApplication(-1)
    return _app


def _wait_for(check, what, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            result = check()
            if result:
                return result
        except Exception:
            pass
        time.sleep(0.5)
    raise SapError(f"Timed out waiting for {what}")


def _active(app, form_type):
    f = app.Forms.ActiveForm
    return f if f.TypeEx == form_type else None


def _find_row(matrix, unit):
    """Row number (1-based, as shown) whose Unit Code is exactly `unit`."""
    root = ET.fromstring(matrix.SerializeAsXML(0))
    hits = []
    for i, row in enumerate(root.iter("Row"), start=1):
        vals = {c.findtext("ID"): (c.findtext("Value") or "") for c in row.iter("Column")}
        if vals.get(COL_UNIT, "").strip().upper() == unit:
            hits.append((i, vals.get(COL_CODE, "")))
    if not hits:
        raise SapError(f"Apartment {unit} not found in SAP")
    if len(hits) > 1:
        raise SapError(f"Apartment {unit} found {len(hits)} times in SAP "
                       f"({', '.join(c for _, c in hits)}) - a person must check")
    row, card_code = hits[0]
    check = matrix.Columns.Item(COL_UNIT).Cells.Item(row).Specific.Value
    if check.strip().upper() != unit:
        raise SapError(f"List row {row} shows {check!r}, expected {unit} - stopped")
    return row, card_code


def _open_unit(app, unit):
    app.ActivateMenuItem(BP_MENU)
    bp = _wait_for(lambda: _active(app, BP_FORM), "Business Partner window")
    if bp.Mode != FIND_MODE:
        raise SapError("Business Partner window did not open in Find mode")
    bp.Items.Item(CODE).Specific.Value = "*"
    bp.Items.Item(BTN_OK).Click(0)
    lst = _wait_for(lambda: _active(app, LIST_FORM), "List of Business Partners")
    matrix = lst.Items.Item(LIST_MATRIX).Specific
    matrix.Columns.Item(COL_UNIT).TitleObject.Sort(0)  # ascending, same as double-click
    time.sleep(1)
    try:
        row, card_code = _find_row(matrix, unit)
    except SapError:
        lst.Items.Item(LIST_CANCEL).Click(0)
        f = _active(app, BP_FORM)
        if f is not None and f.Mode == FIND_MODE:
            f.Close()
        raise
    matrix.Columns.Item(COL_CODE).Cells.Item(row).Click(0)
    if matrix.GetNextSelectedRow(0, 1) != row:
        raise SapError(f"Could not highlight the row for {unit}")
    lst.Items.Item(LIST_CHOOSE).Click(0)

    form = _wait_for(lambda: (lambda f: f if f and f.Mode == OK_MODE else None)(_active(app, BP_FORM)),
                     f"{unit} to open")
    opened_code = form.Items.Item(CODE).Specific.Value
    opened_unit = form.Items.Item(PROPERTY_DETAIL).Specific.Value.strip().upper()
    if opened_code != card_code or opened_unit != unit:
        raise SapError(f"Opened {opened_code} / {opened_unit}, expected {card_code} / {unit} - "
                       "nothing changed, window left open")
    return form


def _set_sync(form, value):
    combo = form.Items.Item(SYNC_TO_PORTAL).Specific
    current = combo.Selected.Value if combo.Selected else ""
    if current != value:
        combo.Select(value, 0)  # 0 = by value


def _update(form, step):
    """Click Update and wait until SAP accepts it (window back in OK mode)."""
    if form.Mode != UPDATE_MODE:
        raise SapError(f"{step}: nothing to update (button is not 'Update')")
    form.Items.Item(BTN_OK).Click(0)
    try:
        _wait_for(lambda: form.Mode == OK_MODE, f"{step} to be saved", timeout=30)
    except SapError:
        raise SapError(f"{step}: SAP did not accept the update (red message?) - "
                       "window left open for a person to check")


def update_unit_phone(config, code, phone, dry_run=False):
    """Return the old values of the three boxes. Raise SapError on any problem."""
    if dry_run:
        print(f"  [dry-run] SAP: set phone of unit {code} to {phone}")
        return None
    unit = code.strip().upper()
    if not re.fullmatch(r"07\d{9}", phone or ""):
        raise SapError(f"Phone {phone!r} is not 07XXXXXXXXX - nothing done")
    app = _application()
    form = _open_unit(app, unit)

    old = {}
    for label, uid in PHONE_BOXES.items():
        box = form.Items.Item(uid).Specific
        old[label] = box.Value
        if box.Value != phone:
            box.Value = phone
    for label, uid in PHONE_BOXES.items():
        if form.Items.Item(uid).Specific.Value != phone:
            raise SapError(f"{label} did not take the new number - window left open")
    _set_sync(form, "Y")

    if form.Mode == UPDATE_MODE:
        _update(form, "First update")
    # else: everything was already the same - only the glitch fix below is needed

    # Glitch fix: Sync To Portal No -> Yes, Update again.
    _set_sync(form, "N")
    _set_sync(form, "Y")
    _update(form, "Second update (Sync To Portal)")

    card_code = form.Items.Item(CODE).Specific.Value
    form.Items.Item(BTN_OK).Click(0)  # OK closes the window (SAP is already saved)

    portal_error = _watch_portal_error(app, card_code)
    if portal_error:
        raise SapError(f"SAP saved, but the portal sync answered with an error - "
                       f"no invitation sent: {portal_error}")
    return ", ".join(f"{k}={v or '(empty)'}" for k, v in old.items())


def _read_portal_error(app, card_code):
    """Open the BP by its code (read-only), read PortalError, close."""
    app.ActivateMenuItem(BP_MENU)
    bp = _wait_for(lambda: _active(app, BP_FORM), "Business Partner window")
    if bp.Mode != FIND_MODE:
        raise SapError("Business Partner window did not open in Find mode")
    bp.Items.Item(CODE).Specific.Value = card_code
    bp.Items.Item(BTN_OK).Click(0)
    _wait_for(lambda: bp.Mode == OK_MODE, f"{card_code} to open")
    try:
        if bp.Items.Item(CODE).Specific.Value != card_code:
            raise SapError(f"Re-opened the wrong business partner while checking {card_code}")
        return bp.Items.Item(PORTAL_ERROR).Specific.Value.strip()
    finally:
        if bp.Mode == OK_MODE:
            bp.Close()


def _watch_portal_error(app, card_code):
    """Measured 2026-11-07: the portal's answer is written into PortalError about 7-13 s after
    the update and is cleared again within about a minute, and the open window does not show
    it. So re-open the BP every few seconds for PORTAL_ERROR_WATCH seconds."""
    end = time.time() + PORTAL_ERROR_WATCH
    while time.time() < end:
        time.sleep(PORTAL_ERROR_EVERY)
        err = _read_portal_error(app, card_code)
        if err:
            return err
    return ""


if __name__ == "__main__":
    import sys
    args = [a for a in sys.argv[1:] if a != "--yes"]
    if len(args) != 2:
        sys.exit("usage: python sap_b1.py UNIT PHONE [--yes]   e.g. python sap_b1.py ES-4-8-09 07504663930")
    unit, phone = args
    if "--yes" not in sys.argv and \
            input(f"Update {unit.upper()} in SAP to {phone}? [y/n] ").strip().lower() != "y":
        sys.exit("Cancelled")
    try:
        print("Old values:", update_unit_phone({}, unit, phone))
        print("Done")
    except SapError as e:
        sys.exit(f"STOPPED: {e}")
