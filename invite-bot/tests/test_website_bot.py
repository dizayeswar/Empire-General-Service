"""website_bot.process: website requests -> SAP -> close SAP -> portal, statuses written back."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

import portal  # noqa: E402
import sap_b1  # noqa: E402
import sap_session  # noqa: E402
import website_bot  # noqa: E402
from test_sap_session_flow import FakeSap  # noqa: E402

ACTIVE = ("waiting", "sap", "sap_done", "portal")


class FakeWebsite:
    """Behaves like the empire-api actions: rows only move when they still have `from`."""

    def __init__(self, *rows):
        self.rows = {r["id"]: dict(r) for r in rows}
        self.history = []

    def work(self):
        return [dict(r) for r in self.rows.values() if r["status"] in ACTIVE]

    def update(self, row, status, message, frm=None, result=None):
        cur = self.rows[row["id"]]
        if (frm and cur["status"] != frm) or (not frm and cur["status"] not in ACTIVE):
            return False
        cur.update(status=status, message=message)
        if result is not None:
            cur["result"] = result
        row["status"] = status
        self.history.append((row["id"], status))
        return True


def req(rid, code="ES-1-1-01", phone="07500000000", status="waiting"):
    return {"id": rid, "unitCode": code, "phone": phone, "status": status}


class WebsiteBotTest(unittest.TestCase):
    def setUp(self):
        self.sap_results = {}
        self.portal_results = {}
        self.calls = []
        for mod, name, fake in ((website_bot, "log", lambda m: None),
                                (sap_b1, "update_unit_phone", self._sap),
                                (portal, "send_invitation", self._portal)):
            self.addCleanup(setattr, mod, name, getattr(mod, name))
            setattr(mod, name, fake)
        website_bot._sap_problem.clear()
        website_bot._portal_waiting.clear()

    def _sap(self, config, code, phone, dry_run=False):
        self.calls.append(f"sap:{code}")
        r = self.sap_results.get(code)
        if isinstance(r, Exception):
            raise r
        return "old"

    def _portal(self, ctx, phone, dry_run=False):
        self.calls.append(f"portal:{phone}")
        r = self.portal_results.get(phone, "invited")
        if isinstance(r, Exception):
            raise r
        return r

    def test_nothing_waiting_does_not_open_sap(self):
        sap = FakeSap()
        website_bot.process(FakeWebsite(), None, {}, sap)
        self.assertEqual(sap.calls, [])

    def test_full_run_two_requests(self):
        web = FakeWebsite(req("a", "ES-1-1-01", "07500000001"), req("b", "WW-13-24-H", "07500000002"))
        self.portal_results["07500000002"] = "already activated"
        sap = FakeSap()
        website_bot.process(web, None, {}, sap)
        self.assertEqual(sap.calls, ["ensure", "ensure", "close"])
        self.assertEqual(self.calls, ["sap:ES-1-1-01", "sap:WW-13-24-H",
                                      "portal:07500000001", "portal:07500000002"])
        self.assertEqual(web.rows["a"]["status"], "done")
        self.assertEqual(web.rows["a"]["result"], "invited")
        self.assertEqual(web.rows["b"]["result"], "already activated")
        self.assertEqual([s for i, s in web.history if i == "a"], ["sap", "sap_done", "portal", "done"])

    def test_cancelled_request_is_not_touched(self):
        web = FakeWebsite(req("a"))
        orig = web.update

        def cancel_first(row, status, message, frm=None, result=None):
            web.rows["a"]["status"] = "cancelled"  # cancelled on the website a moment ago
            return orig(row, status, message, frm, result)
        web.update = cancel_first
        sap = FakeSap()
        website_bot.process(web, None, {}, sap)
        self.assertEqual(self.calls, [])
        self.assertNotIn("ensure", sap.calls)

    def test_sap_error_fails_with_reason_and_next_continues(self):
        web = FakeWebsite(req("a", "ES-1-1-01"), req("b", "ES-1-1-02", "07500000009"))
        self.sap_results["ES-1-1-01"] = sap_b1.SapError("Apartment ES-1-1-01 not found in SAP")
        sap = FakeSap()
        website_bot.process(web, None, {}, sap)
        self.assertEqual(web.rows["a"]["status"], "failed")
        self.assertIn("not found in SAP", web.rows["a"]["message"])
        self.assertIn("error:ES-1-1-01", sap.calls)
        self.assertEqual(web.rows["b"]["status"], "done")

    def test_portal_sync_error_fails_without_screenshot(self):
        web = FakeWebsite(req("a"))
        self.sap_results["ES-1-1-01"] = sap_b1.PortalSyncError("already used")
        sap = FakeSap()
        website_bot.process(web, None, {}, sap)
        self.assertEqual(web.rows["a"]["status"], "failed")
        self.assertEqual(sap.calls, ["ensure", "close"])

    def test_portal_not_ready_goes_back_to_sap_done(self):
        web = FakeWebsite(req("a", phone="07500000001"))
        self.portal_results["07500000001"] = portal.PortalWait("updating the system")
        website_bot.process(web, None, {}, FakeSap())
        self.assertEqual(web.rows["a"]["status"], "sap_done")
        self.assertIn("updating the system", web.rows["a"]["message"])

    def test_portal_problem_fails(self):
        web = FakeWebsite(req("a", phone="07500000001"))
        self.portal_results["07500000001"] = portal.PortalError("Blocked")
        website_bot.process(web, None, {}, FakeSap())
        self.assertEqual(web.rows["a"]["status"], "failed")

    def test_sap_login_refused_keeps_waiting(self):
        web = FakeWebsite(req("a"), req("b", "ES-1-1-02"))
        sap = FakeSap(login_fails=True)
        website_bot.process(web, None, {}, sap)
        website_bot.process(web, None, {}, sap)
        self.assertEqual(sap.calls.count("ensure"), 1)
        self.assertEqual(web.rows["a"]["status"], "waiting")
        self.assertEqual(web.rows["b"]["status"], "waiting")
        self.assertIn("SAP login problem", web.rows["b"]["message"])

    def test_half_way_rows_are_recovered(self):
        web = FakeWebsite(req("a", status="sap"), req("b", "ES-1-1-02", "07500000002", status="portal"))
        sap = FakeSap()
        website_bot.process(web, None, {}, sap)
        self.assertEqual(web.rows["a"]["status"], "failed")
        self.assertIn("check this unit in SAP", web.rows["a"]["message"])
        self.assertEqual(web.rows["b"]["status"], "done")
        self.assertNotIn("ensure", sap.calls)


if __name__ == "__main__":
    unittest.main()
