"""Open SAP Business One, log in, and close it again when the queue is empty.

SAP glitches when it is left open, so the bot opens it only when an apartment is waiting
and closes it as soon as there are no more apartments.

Login, as a person does it (recorded 2026-11-07):
  - SAP is started from the Start-menu program (NOT the Desktop shortcut, that one runs
    as administrator and the bot cannot reach it)
  - login window "SAP Business One": Company Name is already 1.1 Empire World,
    click User ID, type it, click Password, type it, Enter (Tab does NOT move to Password
    when the keys come from a program)
  - wrong password -> SAP shows "Choose/Create Company" with the red
    "Enter valid user name and password": the bot closes SAP and stops trying until it is
    restarted (trying again and again could lock the SAP user)
  - wait 15 s (SAP can be slow), Cancel "Select Default Branch"

Closing: like clicking SAP's X, then Yes on "Closing SAP Business One will stop all running
processes ... Do you want to continue?" (the bot answers only that question).

The password is never stored in a file. It is kept in Windows Credential Manager:
    python sap_session.py save-password
(asks for the user and password; the password is not shown while typing.)

SAP draws its own login fields (they are not normal Windows boxes), so the bot types into
them with the keyboard. Before EVERY key it checks that the SAP window is in front; if not,
it stops, so the password can never be typed into another program.
"""
import ctypes
import datetime
import os
import subprocess
import time

import sap_b1
from sap_b1 import SapError

SAP_EXE = r"C:\Program Files\SAP\SAP Business One\SAP Business One.exe"
CRED_TARGET = "EmpireInviteBot SAP"
COMPANY = "1.1 Empire World"
LOGIN_TITLE = "SAP Business One"          # the login window inside the SAP frame
BAD_LOGIN_TITLE = "Choose/Create Company"  # what SAP shows after a wrong password
FRAME_CLASS = "TMFrameClass"
CHILD_CLASS = "TMMDIChildClass"
BRANCH_WAIT = 15                           # seconds before the branch window is cancelled (SAP can be slow)
# User ID box, measured from the login window's top-left corner (2026-11-07 screenshot)
USER_ID_OFFSET = (367, 136)
PASSWORD_OFFSET = (367, 156)
EDIT_CLASS = "TMEditTextClass"             # SAP puts a real edit box on the field being typed in

SHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")


class SapLoginError(SapError):
    """SAP did not let the bot in - do not try again until a person checks."""


# ---------- password ----------

def get_credentials():
    import win32cred
    try:
        cred = win32cred.CredRead(CRED_TARGET, win32cred.CRED_TYPE_GENERIC)
    except Exception:
        raise SapLoginError(
            "The SAP password is not saved on this PC. Run once in the invite-bot folder:  "
            "python sap_session.py save-password")
    user = cred["UserName"]
    password = cred["CredentialBlob"].decode("utf-16-le")
    if not user or not password:
        raise SapLoginError(f'The saved SAP login "{CRED_TARGET}" is empty')
    return user, password


def save_credentials():
    """Ask for the SAP user and password and keep them in Windows Credential Manager."""
    import getpass
    import win32cred
    user = input("SAP User ID [SAP044]: ").strip() or "SAP044"
    password = getpass.getpass("SAP password (not shown while typing): ")
    if not password:
        raise SapLoginError("No password typed - nothing saved")
    if getpass.getpass("Type the password again: ") != password:
        raise SapLoginError("The two passwords are different - nothing saved")
    win32cred.CredWrite({
        "Type": win32cred.CRED_TYPE_GENERIC,
        "TargetName": CRED_TARGET,
        "UserName": user,
        "CredentialBlob": password,
        "Persist": win32cred.CRED_PERSIST_LOCAL_MACHINE,
    }, 0)
    print(f'Saved in Windows Credential Manager as "{CRED_TARGET}" (user {user})')


# ---------- windows ----------

def _frame():
    import win32gui
    found = []

    def cb(h, _):
        if win32gui.GetClassName(h) == FRAME_CLASS and win32gui.IsWindowVisible(h):
            found.append(h)
    win32gui.EnumWindows(cb, None)
    return found[0] if found else None


def _children(frame):
    """{title: hwnd} of the windows open inside SAP (login, Choose/Create Company, ...)."""
    import win32gui
    out = {}

    def cb(h, _):
        if win32gui.GetClassName(h) == CHILD_CLASS and win32gui.IsWindowVisible(h):
            out[win32gui.GetWindowText(h)] = h
    win32gui.EnumChildWindows(frame, cb, None)
    return out


def _to_front(frame):
    import win32con
    import win32gui
    if win32gui.IsIconic(frame):  # only when minimized: SW_RESTORE un-maximizes and moves the login box
        win32gui.ShowWindow(frame, win32con.SW_RESTORE)
    ctypes.windll.user32.keybd_event(0x12, 0, 0, 0)  # Alt down/up lets SetForegroundWindow work
    ctypes.windll.user32.keybd_event(0x12, 0, 2, 0)
    try:
        win32gui.SetForegroundWindow(frame)
    except Exception:
        pass  # checked right after by _check_front
    time.sleep(0.5)


def _check_front(frame):
    import win32gui
    if win32gui.GetForegroundWindow() != frame:
        raise SapLoginError("Another window came in front of SAP during login - stopped typing")


# ---------- keyboard (SendInput) ----------

class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", ctypes.c_ushort), ("wScan", ctypes.c_ushort), ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong), ("dwExtraInfo", ctypes.c_size_t)]


class _INPUT(ctypes.Structure):
    class _U(ctypes.Union):
        _fields_ = [("ki", _KEYBDINPUT), ("pad", ctypes.c_byte * 32)]
    _anonymous_ = ("u",)
    _fields_ = [("type", ctypes.c_ulong), ("u", _U)]


_KEYUP, _UNICODE = 0x2, 0x4
VK_TAB, VK_RETURN, VK_END, VK_BACK = 0x09, 0x0D, 0x23, 0x08


def _send(vk=0, scan=0, flags=0):
    inp = _INPUT(type=1)
    inp.ki = _KEYBDINPUT(vk, scan, flags, 0, 0)
    ctypes.windll.user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(inp))


def _key(frame, vk):
    _check_front(frame)
    _send(vk=vk)
    _send(vk=vk, flags=_KEYUP)
    time.sleep(0.05)


def _type(frame, text):
    for ch in text:
        _check_front(frame)
        _send(scan=ord(ch), flags=_UNICODE)
        _send(scan=ord(ch), flags=_UNICODE | _KEYUP)
        time.sleep(0.03)


def _click(x, y):
    ctypes.windll.user32.SetCursorPos(x, y)
    ctypes.windll.user32.mouse_event(0x2, 0, 0, 0, 0)
    ctypes.windll.user32.mouse_event(0x4, 0, 0, 0, 0)
    time.sleep(0.3)


def _edit_box_at(frame, xy):
    """The SAP edit box (shown only on the field that has the cursor) under point xy, or None."""
    import win32gui
    hits = []

    def cb(h, _):
        if win32gui.GetClassName(h) == EDIT_CLASS and win32gui.IsWindowVisible(h):
            l, t, r, b = win32gui.GetWindowRect(h)
            if l <= xy[0] <= r and t - 3 <= xy[1] <= b + 3:
                hits.append(h)
    win32gui.EnumChildWindows(frame, cb, None)
    return hits[0] if hits else None


def _click_box(frame, xy, name):
    """Click a login field and make sure the cursor really is in it before anything is typed."""
    _check_front(frame)
    _click(*xy)
    try:
        return _wait(lambda: _edit_box_at(frame, xy), f"the {name} box", 5)
    except SapLoginError:
        kill_sap()
        raise SapLoginError(f"Could not put the cursor in the {name} box - stopped, nothing typed there")


def _box_text(box):
    """Text in a SAP edit box. GetWindowText returns '' for another program's box, WM_GETTEXT works."""
    buf = ctypes.create_unicode_buffer(256)
    ctypes.windll.user32.SendMessageW(box, 0x000D, 256, buf)  # WM_GETTEXT
    return buf.value


def _clear(frame):
    _key(frame, VK_END)
    for _ in range(40):
        _key(frame, VK_BACK)


# ---------- screenshot ----------

def screenshot(name):
    """Save the whole screen to screenshots/<time>_<name>.png and return the path."""
    os.makedirs(SHOTS_DIR, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    path = os.path.join(SHOTS_DIR, f"{datetime.datetime.now():%Y%m%d_%H%M%S}_{safe}.png")
    ps = ("Add-Type -AssemblyName System.Windows.Forms,System.Drawing;"
          "$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;"
          "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;"
          "$g=[System.Drawing.Graphics]::FromImage($bmp);"
          "$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);"
          f"$bmp.Save('{path}')")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=False, timeout=30)
    return path if os.path.exists(path) else None


# ---------- open / login / close ----------

def _logged_in_app():
    try:
        app = sap_b1._application()
        app.Company.Name
        return app
    except Exception:
        return None


def kill_sap():
    """Close SAP without saving anything (used after an error and when Exit does not work)."""
    subprocess.run(["taskkill", "/F", "/IM", "SAP Business One.exe"],
                   capture_output=True, check=False)
    sap_b1._app = None
    end = time.time() + 20
    while _frame() and time.time() < end:
        time.sleep(0.5)


def _wait(check, what, timeout):
    end = time.time() + timeout
    while time.time() < end:
        result = check()
        if result:
            return result
        time.sleep(0.5)
    raise SapLoginError(f"Timed out waiting for {what}")


def _cancel_branch(app):
    time.sleep(BRANCH_WAIT)
    sap_b1.cancel_branch_window(app)


def login():
    """Make sure SAP is open and logged in to 1.1 Empire World. Returns the SAP application."""
    ctypes.windll.user32.SetProcessDPIAware()  # window positions in real screen pixels
    app = _logged_in_app()
    if app is None:
        user, password = get_credentials()
        if _frame():  # open but not logged in (half-way, or stuck) - start clean
            kill_sap()
        subprocess.Popen([SAP_EXE])  # same as the Start-menu program, not as administrator
        frame = _wait(_frame, "SAP to start", 120)
        login_win = _wait(lambda: _children(frame).get(LOGIN_TITLE), "the SAP login window", 120)
        time.sleep(2)

        import win32gui
        _to_front(frame)
        _check_front(frame)
        left, top, _, _ = win32gui.GetWindowRect(login_win)  # measured after it is in front
        user_xy = (left + USER_ID_OFFSET[0], top + USER_ID_OFFSET[1])
        pass_xy = (left + PASSWORD_OFFSET[0], top + PASSWORD_OFFSET[1])

        user_box = _click_box(frame, user_xy, "User ID")
        _clear(frame)
        _type(frame, user)
        if _box_text(user_box) != user:
            kill_sap()
            raise SapLoginError("User ID box did not take the user name - stopped before the password")

        _click_box(frame, pass_xy, "Password")   # never Tab: SAP ignored it (2026-11-07)
        _clear(frame)
        _type(frame, password)
        _key(frame, VK_RETURN)
        password = None

        def done():
            if BAD_LOGIN_TITLE in _children(frame):
                return "refused"
            return _logged_in_app()
        result = _wait(done, "SAP to log in", 120)
        if result == "refused":
            # no screenshot here: the refused window can show what was typed
            kill_sap()
            raise SapLoginError("SAP refused the login (wrong user or password?). "
                                "The bot will not try again until it is restarted.")
        app = result
        _cancel_branch(app)
    else:
        # SAP was already open (seen 2026-11-08): "Select Default Branch" may still be up
        try:
            sap_b1.cancel_branch_window(app)
        except Exception:
            pass

    company = app.Company.Name
    if company != COMPANY:
        kill_sap()
        raise SapLoginError(f"SAP opened company {company!r}, expected {COMPANY!r} - stopped")
    return app


EXIT_QUESTION = "closing sap business one will stop all running processes"


def _answer_exit_question(app):
    """Click Yes on SAP's "Closing SAP Business One will stop all running processes ... continue?"
    and on nothing else (a "save changes?" question is never answered - SAP is closed by force
    instead, which saves nothing)."""
    try:
        form = app.Forms.ActiveForm
        if form.TypeEx != "0":           # SAP's System Message window
            return False
        texts = []
        for i in range(form.Items.Count):
            try:
                texts.append(str(form.Items.Item(i).Specific.Caption))
            except Exception:
                pass
        if any(EXIT_QUESTION in t.lower() for t in texts):
            form.Items.Item("1").Click(0)  # Yes
            return True
    except Exception:
        pass
    return False


def close_sap():
    """Close SAP like clicking its X, answer Yes to "Closing SAP Business One ... continue?".
    If SAP does not close within 30 s, it is closed by force.

    Not File -> Exit through the UI API: that call only returns after the question is
    answered, so the bot would wait on itself (seen 2026-11-07)."""
    import win32con
    import win32gui
    frame = _frame()
    if not frame:
        sap_b1._app = None
        return
    app = _logged_in_app()
    if app:
        win32gui.PostMessage(frame, win32con.WM_CLOSE, 0, 0)  # does not wait for the answer
        end = time.time() + 30
        answered = False
        while _frame() and time.time() < end:
            if not answered:
                answered = _answer_exit_question(app)
            time.sleep(0.5)
    if _frame():
        kill_sap()
    sap_b1._app = None


class SapSession:
    """Opens SAP the first time it is needed; main.py closes it when the queue is empty."""

    def __init__(self, log):
        self.log = log
        self.open = False
        self.broken = None   # set after a refused login; SAP is not tried again

    def ensure(self):
        if self.broken:
            raise SapLoginError(self.broken)
        if not self.open:
            self.log("Opening SAP and logging in")
            try:
                login()
            except SapLoginError as e:
                self.broken = str(e)
                raise
            self.open = True
            self.log("SAP logged in")

    def after_error(self, code):
        """A SAP step went wrong: screenshot, then close SAP without saving."""
        shot = screenshot(f"sap_error_{code}")
        kill_sap()
        self.open = False
        return shot

    def close(self):
        if self.open:
            close_sap()
            self.open = False
            self.log("SAP closed (no more apartments)")


if __name__ == "__main__":
    # python sap_session.py save-password | login | close
    import sys
    what = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if what == "save-password":
            save_credentials()
        elif what == "login":
            a = login()
            print(f"Logged in: {a.Company.Name}, user {a.Company.UserName}")
        elif what == "full":
            # login -> one apartment -> close, like the bot does
            if len(sys.argv) == 4:
                unit, phone = sys.argv[2], sys.argv[3]
            else:
                unit = input("Unit Code (e.g. ES-4-8-09): ").strip().upper()
                phone = input("Phone (07XXXXXXXXX): ").strip().replace(" ", "")
            import re
            if not re.fullmatch(r"[A-Z]{2}(-[A-Z0-9]+)+", unit.upper()):
                sys.exit(f"STOPPED: {unit!r} does not look like a Unit Code - SAP not opened")
            if not re.fullmatch(r"07\d{9}", phone):
                sys.exit(f"STOPPED: {phone!r} is not 07XXXXXXXXX - SAP not opened")
            if input(f"Put {phone} on {unit.upper()} in SAP? [y/n] ").strip().lower() != "y":
                sys.exit("Cancelled - SAP not opened")
            a = login()
            print(f"Logged in: {a.Company.Name}")
            try:
                print("SAP done, old values:", sap_b1.update_unit_phone({}, unit, phone))
            except sap_b1.PortalSyncError as e:
                print(f"STOPPED (SAP is fine): {e}")
            except Exception as e:
                print(f"STOPPED: {e}\nScreenshot: {screenshot('sap_error_' + unit)}")
                kill_sap()
            close_sap()
            print("SAP closed" if not _frame() else "SAP is STILL OPEN")
        elif what == "close":
            close_sap()
            print("SAP closed" if not _frame() else "SAP is STILL OPEN")
        else:
            sys.exit("usage: python sap_session.py save-password | login | close | full UNIT PHONE")
    except SapError as e:
        sys.exit(f"STOPPED: {e}")
