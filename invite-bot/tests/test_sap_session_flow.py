"""main.process_queue: SAP opened only when needed, closed when the queue is empty,
screenshot + close on a SAP error, and a refused login is not retried."""
import os
import sys
import types
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
# main imports playwright and whatsapp at the top; tests do not need them
sys.modules.setdefault("playwright", types.ModuleType("playwright"))
sync_api = types.ModuleType("playwright.sync_api")
sync_api.sync_playwright = None
sys.modules.setdefault("playwright.sync_api", sync_api)
sys.modules.setdefault("whatsapp", types.ModuleType("whatsapp"))

import main  # noqa: E402
import queue_db  # noqa: E402
import sap_b1  # noqa: E402
import sap_session  # noqa: E402


class FakeSap(sap_session.SapSession):
    def __init__(self, login_fails=False):
        super().__init__(lambda m: None)
        self.calls = []
        self.login_fails = login_fails

    def ensure(self):
        self.calls.append("ensure")
        if self.broken:
            raise sap_session.SapLoginError(self.broken)
        if not self.open:
            if self.login_fails:
                self.broken = "refused"
                raise sap_session.SapLoginError("refused")
            self.open = True

    def after_error(self, code):
        self.calls.append(f"error:{code}")
        self.open = False
        return "shot.png"

    def close(self):
        self.calls.append("close")
        self.open = False


class FlowTest(unittest.TestCase):
    def setUp(self):
        self.db = queue_db.connect(":memory:")
        self.sap_results = {}
        for mod, name, fake in ((main, "log", lambda m: None),
                                (main.sap_b1, "update_unit_phone", self._fake_update),
                                (main.portal, "send_invitation", lambda ctx, phone, dry_run=False: None)):
            self.addCleanup(setattr, mod, name, getattr(mod, name))
            setattr(mod, name, fake)

    def _fake_update(self, config, code, phone, dry_run=False):
        r = self.sap_results.get(code)
        if isinstance(r, Exception):
            raise r
        return "old"

    def add(self, mid, code):
        queue_db.add(self.db, mid, "s", "t", {"code": code, "phone": "07500000000"})

    def status(self, mid):
        return self.db.execute("SELECT status, error FROM requests WHERE message_id=?", (mid,)).fetchone()

    def test_empty_queue_does_not_open_sap(self):
        sap = FakeSap()
        main.process_queue(self.db, None, {}, "auto", sap)
        self.assertNotIn("ensure", sap.calls)

    def test_two_apartments_one_login_then_close(self):
        self.add("m1", "ES-1-1-01")
        self.add("m2", "ES-1-1-02")
        sap = FakeSap()
        main.process_queue(self.db, None, {}, "auto", sap)
        self.assertEqual(sap.calls, ["ensure", "ensure", "close"])
        self.assertEqual(self.status("m1")["status"], "invited")
        self.assertEqual(self.status("m2")["status"], "invited")

    def test_sap_error_screenshot_and_carry_on(self):
        self.add("m1", "ES-1-1-01")
        self.add("m2", "ES-1-1-02")
        self.sap_results["ES-1-1-01"] = sap_b1.SapError("red line")
        sap = FakeSap()
        main.process_queue(self.db, None, {}, "auto", sap)
        self.assertEqual(sap.calls, ["ensure", "error:ES-1-1-01", "ensure", "close"])
        s = self.status("m1")
        self.assertEqual(s["status"], "failed")
        self.assertIn("shot.png", s["error"])
        self.assertEqual(self.status("m2")["status"], "invited")

    def test_portal_sync_error_keeps_sap_open(self):
        self.add("m1", "ES-1-1-01")
        self.sap_results["ES-1-1-01"] = sap_b1.PortalSyncError("already used")
        sap = FakeSap()
        main.process_queue(self.db, None, {}, "auto", sap)
        self.assertEqual(sap.calls, ["ensure", "close"])
        self.assertEqual(self.status("m1")["status"], "failed")

    def test_portal_runs_after_sap_is_closed(self):
        self.add("m1", "ES-1-1-01")
        self.add("m2", "ES-1-1-02")
        sap = FakeSap()
        main.portal.send_invitation = lambda ctx, phone, dry_run=False: sap.calls.append("portal")
        main.process_queue(self.db, None, {}, "auto", sap)
        self.assertEqual(sap.calls, ["ensure", "ensure", "close", "portal", "portal"])

    def test_portal_not_ready_keeps_waiting(self):
        self.add("m1", "ES-1-1-01")

        def wait(ctx, phone, dry_run=False):
            raise main.portal.PortalWait("updating")
        main.portal.send_invitation = wait
        main.process_queue(self.db, None, {}, "auto", FakeSap())
        self.assertEqual(self.status("m1")["status"], "sap_done")

    def test_portal_problem_is_reported(self):
        self.add("m1", "ES-1-1-01")

        def blocked(ctx, phone, dry_run=False):
            raise main.portal.PortalError("Blocked")
        main.portal.send_invitation = blocked
        main.process_queue(self.db, None, {}, "auto", FakeSap())
        self.assertEqual(self.status("m1")["status"], "failed")

    def test_refused_login_waits_and_is_not_retried(self):
        self.add("m1", "ES-1-1-01")
        self.add("m2", "ES-1-1-02")
        sap = FakeSap(login_fails=True)
        main.process_queue(self.db, None, {}, "auto", sap)
        main.process_queue(self.db, None, {}, "auto", sap)
        self.assertEqual(sap.calls.count("ensure"), 1)
        self.assertEqual(self.status("m1")["status"], "confirmed")
        self.assertEqual(self.status("m2")["status"], "new")


if __name__ == "__main__":
    unittest.main()
