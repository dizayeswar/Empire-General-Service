"""Send the invitation in the Empire World Customer Service Portal (by phone number).

As a person does it (shown 2026-11-08, recorded read-only):
  - The bot's own Edge window stays signed in. If the login page shows, the password is
    saved, so only SIGN IN is clicked - once. If that fails they are updating the system:
    leave it, try again later, never fight it.
  - Customers -> All -> FILTER -> only the last box, Phone Number -> FILTER
  - Only INVITATION STATUS and the Send Invitation (envelope) button matter; name, account
    status, project etc. are ignored.
      Not Invited        -> Send Invitation -> YES, INVITE -> "Operation successful." = done
      Activated          -> nothing to do, done
      Invitation Pending -> already invited, done (never invite twice)
      Blocked            -> leave it, report
      No results.        -> SAP may not have reached the portal yet: try again every minute
                            for 5 minutes, then report "not in the portal"
      more than one row  -> stop, report (a person must check)
  - Always finish with FILTER -> CLEAR FILTERS (fresh start for the next number).

Only rows whose PHONE NUMBER is exactly the number are looked at. The bot never clicks
Block, Show / Edit, Balances or Sign out.
"""
import re
import time

URL = "https://c21531-empirefrontend.cloudiax.com/"
PHONE_BOX = "Enter phone number."
PASSWORD_BOX = "Enter your password."
NOT_FOUND_TEXT = "No results."
NOT_FOUND_TRIES = 5          # minutes
LOGIN_PAUSE = 15 * 60        # after a failed SIGN IN, leave the portal alone this long

COL_PHONE, COL_STATUS = 3, 4  # PHONE NUMBER, INVITATION STATUS (0-based table columns)

ROWS_JS = """() => [...document.querySelectorAll('table tbody tr')].map(tr =>
  [...tr.querySelectorAll('td')].map(td => td.innerText.trim()))"""


class PortalError(Exception):
    pass


class PortalWait(PortalError):
    """Not a failure: the portal is not ready (login failed / number not there yet). Try later."""


_login_failed_at = None


def _page(context):
    for p in context.pages:
        if p.url.startswith(URL):
            return p
    page = context.new_page()
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    return page


def _signed_in(page):
    return page.get_by_role("button", name="Customers", exact=True).count() > 0


def _ensure_signed_in(page):
    global _login_failed_at
    if _signed_in(page):
        return
    if page.get_by_placeholder(PASSWORD_BOX).count() == 0:
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        if _signed_in(page):
            return
    if _login_failed_at and time.time() - _login_failed_at < LOGIN_PAUSE:
        raise PortalWait("Portal sign-in failed earlier (system update?) - waiting before trying again")
    if page.get_by_placeholder(PASSWORD_BOX).count() == 0:
        raise PortalWait("Portal shows neither the login page nor the menu - left alone")
    if not page.get_by_placeholder(PASSWORD_BOX).input_value():
        _login_failed_at = time.time()
        raise PortalWait("Portal login page has no saved password - a person must sign in "
                         "once in the bot's Edge window")
    page.get_by_role("button", name="SIGN IN").click()  # password is saved in Edge
    try:
        page.get_by_role("button", name="Customers", exact=True).wait_for(timeout=30000)
        _login_failed_at = None
    except Exception:
        _login_failed_at = time.time()
        raise PortalWait("Portal SIGN IN did not work (they may be updating the system) - "
                         "left alone, will try again later")


def _filter_dialog(page):
    box = page.get_by_placeholder(PHONE_BOX)
    return box, box.locator("xpath=ancestor::div[.//button[normalize-space()='CLEAR FILTERS']][1]")


def _open_filter(page):
    page.get_by_role("button", name="FILTER", exact=True).first.click()
    box, dialog = _filter_dialog(page)
    box.wait_for(timeout=10000)
    return box, dialog


def _clear_filters(page):
    try:
        _, dialog = _filter_dialog(page)
        if page.get_by_placeholder(PHONE_BOX).count() == 0:
            _open_filter(page)
            _, dialog = _filter_dialog(page)
        dialog.get_by_role("button", name="CLEAR FILTERS").click()
        page.wait_for_timeout(1500)
        if page.get_by_placeholder(PHONE_BOX).count():
            dialog.get_by_role("button", name="CLOSE").click()
    except Exception:
        pass  # a fresh start is nice to have; the next search fills the box again anyway


def _search(page, phone):
    """Filter by phone; return the rows whose PHONE NUMBER is exactly `phone`, or [] for No results."""
    page.get_by_role("button", name="Customers", exact=True).click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="All", exact=True).first.click()
    page.wait_for_timeout(1000)
    box, dialog = _open_filter(page)
    box.fill(phone)
    dialog.get_by_role("button", name="FILTER", exact=True).click()

    end = time.time() + 30
    while time.time() < end:
        page.wait_for_timeout(1000)
        rows = page.evaluate(ROWS_JS)
        exact = [r for r in rows if len(r) > COL_STATUS and r[COL_PHONE].replace(" ", "") == phone]
        if exact and all(len(r) > COL_PHONE and r[COL_PHONE].replace(" ", "") == phone for r in rows):
            return exact
        if not rows and page.get_by_text(NOT_FOUND_TEXT, exact=True).count():
            return []
    rows = page.evaluate(ROWS_JS)
    return [r for r in rows if len(r) > COL_STATUS and r[COL_PHONE].replace(" ", "") == phone]


def _invite(page, phone):
    row = page.locator("table tbody tr").filter(
        has=page.locator("td", has_text=re.compile(rf"^\s*{phone}\s*$")))
    if row.count() != 1:
        raise PortalError(f"Could not pin down the row for {phone} - nothing sent")
    send = row.locator("xpath=.//div[./div[normalize-space()='Send Invitation']]/button")
    if send.count() != 1:
        raise PortalError(f"{phone} is Not Invited but has no Send Invitation button - nothing sent")
    send.click()
    yes = page.get_by_role("button", name="YES, INVITE")
    yes.wait_for(timeout=10000)
    if page.get_by_text("Do you really want to invite this customer?").count() == 0:
        raise PortalError("The invite box did not ask the expected question - nothing sent")
    yes.click()
    try:
        page.get_by_text("Operation successful.").wait_for(timeout=30000)
    except Exception:
        raise PortalError(f"Clicked YES, INVITE for {phone} but no 'Operation successful.' - "
                          "check it in the portal")
    page.wait_for_timeout(1500)
    close = page.get_by_role("button", name="CLOSE")
    if page.get_by_text("Do you really want to invite this customer?").count() and close.count():
        close.last.click()  # the invite box stays open after success


def send_invitation(context, phone, dry_run=False):
    """Return what was done ("invited" / "already activated" / "already invited").
    Raise PortalWait to try again later, PortalError to report."""
    if dry_run:
        print(f"  [dry-run] Portal: filter {phone}, invite if Not Invited")
        return None
    if not re.fullmatch(r"07\d{9}", phone or ""):
        raise PortalError(f"Phone {phone!r} is not 07XXXXXXXXX")
    page = _page(context)
    page.bring_to_front()
    _ensure_signed_in(page)
    try:
        for attempt in range(1, NOT_FOUND_TRIES + 1):
            rows = _search(page, phone)
            if rows:
                break
            if attempt < NOT_FOUND_TRIES:
                time.sleep(60)
        if not rows:
            raise PortalError(f"{phone} is not in the portal ({NOT_FOUND_TRIES} minutes of "
                              "searching) - a person must check")
        if len(rows) > 1:
            raise PortalError(f"{phone} is in the portal {len(rows)} times "
                              f"({', '.join(r[0] for r in rows)}) - a person must check")
        status = rows[0][COL_STATUS].strip()
        if status == "Activated":
            return "already activated"
        if status == "Invitation Pending":
            return "already invited"
        if status == "Not Invited":
            _invite(page, phone)
            return "invited"
        raise PortalError(f"{phone} has invitation status {status!r} (e.g. Blocked) - left alone")
    finally:
        _clear_filters(page)


if __name__ == "__main__":
    # Test by hand against the bot's Edge window (keep_portal_open style, port 9333):
    #   python portal.py PHONE --look      only search and print the status (no invitation)
    #   python portal.py PHONE             search and invite if Not Invited
    import sys
    from playwright.sync_api import sync_playwright
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit("usage: python portal.py PHONE [--look]")
    with sync_playwright() as p:
        ctx = p.chromium.connect_over_cdp("http://127.0.0.1:9333").contexts[0]
        if "--look" in sys.argv:
            pg = _page(ctx)
            _ensure_signed_in(pg)
            try:
                print(_search(pg, args[0]) or "No results.")
            finally:
                _clear_filters(pg)
        else:
            try:
                print("Done:", send_invitation(ctx, args[0]))
            except PortalError as e:
                sys.exit(f"STOPPED: {e}")
