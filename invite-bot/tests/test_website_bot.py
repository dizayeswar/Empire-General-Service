"""website_bot.process: website requests -> SAP (own program) -> close SAP -> portal (Edge opened
only then), statuses written back."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

import portal  # noqa: E402
import sap_b1  # noqa: E402
import sap_job  # noqa: E402
import website_bot  # noqa: E402
from test_sap_session_flow import FakeSap  # noqa: E402

ACTIVE = ("waiting", "sap", "sap_done", "portal")


class FakeWebsite:
    """Behaves like the empire-api actions: rows only move when they still have `from`."""

    def __init__(self, *rows):
        self.rows = {r["id"]: dict(r, message="") for r in rows}
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
        row["message"] = message
        self.history.append((row["id"], status))
        return True


def req(rid, code="ES-1-1-01", phone="07500000000", status="waiting"):
    return {"id": rid, "unitCode": code, "phone": phone, "status": status}


class WebsiteBotTest(unittest.TestCase):
    def setUp(self):
        self.sap_results = {}
        self.portal_results = {}
        self.calls = []
        self.sap = FakeSap()
        self.sap_job_runs = 0

        def fake_run_sap_job(jobs):
            self.sap_job_runs += 1
            self.calls.append("sap_job")
            events = []
            sap_job.run_jobs(jobs, {}, self.sap, events.append)
            return events

        for mod, name, fake in ((website_bot, "log", lambda m: None),
                                (website_bot, "run_sap_job", fake_run_sap_job),
                                (website_bot, "open_edge", self._open_edge),
                                (website_bot, "close_edge", lambda pw, ctx: self.calls.append("edge closed")),
                                (sap_b1, "update_unit_phone", self._sap),
                                (portal, "send_invitation", self._portal)):
            self.addCleanup(setattr, mod, name, getattr(mod, name))
            setattr(mod, name, fake)
        website_bot._portal_waiting.clear()
        website_bot._portal_retry_at.clear()
        self.state = website_bot.SapState()

    def _open_edge(self):
        self.calls.append("edge open")
        return None, None

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

    def run_once(self, web):
        website_bot.process(web, self.state)

    def test_nothing_waiting_opens_nothing(self):
        self.run_once(FakeWebsite())
        self.assertEqual(self.calls, [])

    def test_full_run_two_requests(self):
        web = FakeWebsite(req("a", "ES-1-1-01", "07500000001"), req("b", "WW-13-24-H", "07500000002"))
        self.portal_results["07500000002"] = "already activated"
        self.run_once(web)
        # SAP alone (one run, closed), then Edge only for the portal, then Edge closed
        self.assertEqual(self.calls, ["sap_job", "sap:ES-1-1-01", "sap:WW-13-24-H", "edge open",
                                      "portal:07500000001", "portal:07500000002", "edge closed"])
        self.assertEqual(self.sap.calls, ["ensure", "ensure", "close"])
        self.assertEqual(web.rows["a"]["status"], "done")
        self.assertEqual(web.rows["a"]["result"], "invited")
        self.assertEqual(web.rows["b"]["result"], "already activated")
        self.assertEqual([s for i, s in web.history if i == "a"],
                         ["sap", "sap", "sap_done", "portal", "done"])

    def test_cancelled_request_is_not_touched(self):
        web = FakeWebsite(req("a"))
        orig = web.update

        def cancel_first(row, status, message, frm=None, result=None):
            web.rows["a"]["status"] = "cancelled"  # cancelled on the website a moment ago
            return orig(row, status, message, frm, result)
        web.update = cancel_first
        self.run_once(web)
        self.assertEqual(self.calls, [])

    def test_sap_error_fails_with_reason_and_next_continues(self):
        web = FakeWebsite(req("a", "ES-1-1-01"), req("b", "ES-1-1-02", "07500000009"))
        self.sap_results["ES-1-1-01"] = sap_b1.SapError("Apartment ES-1-1-01 not found in SAP")
        self.run_once(web)
        self.assertEqual(web.rows["a"]["status"], "failed")
        self.assertIn("not found in SAP", web.rows["a"]["message"])
        self.assertIn("error:ES-1-1-01", self.sap.calls)
        self.assertEqual(web.rows["b"]["status"], "done")

    def test_portal_sync_error_fails_without_screenshot(self):
        web = FakeWebsite(req("a"))
        self.sap_results["ES-1-1-01"] = sap_b1.PortalSyncError("already used")
        self.run_once(web)
        self.assertEqual(web.rows["a"]["status"], "failed")
        self.assertEqual(self.sap.calls, ["ensure", "close"])
        self.assertNotIn("edge open", self.calls)

    def test_portal_not_ready_goes_back_to_sap_done_and_waits_a_minute(self):
        web = FakeWebsite(req("a", phone="07500000001"))
        self.portal_results["07500000001"] = portal.PortalWait("updating the system")
        self.run_once(web)
        self.assertEqual(web.rows["a"]["status"], "sap_done")
        self.assertIn("updating the system", web.rows["a"]["message"])
        self.calls.clear()
        self.run_once(web)  # 10 s later: not tried again yet, Edge not opened
        self.assertEqual(self.calls, [])

    def test_portal_problem_fails(self):
        web = FakeWebsite(req("a", phone="07500000001"))
        self.portal_results["07500000001"] = portal.PortalError("Blocked")
        self.run_once(web)
        self.assertEqual(web.rows["a"]["status"], "failed")

    def test_sap_login_refused_keeps_waiting_and_is_not_retried(self):
        web = FakeWebsite(req("a"), req("b", "ES-1-1-02"))
        self.sap = FakeSap(login_fails=True)
        self.run_once(web)
        self.run_once(web)
        self.assertEqual(self.sap_job_runs, 1)
        self.assertEqual(web.rows["a"]["status"], "waiting")
        self.assertEqual(web.rows["b"]["status"], "waiting")
        self.assertIn("SAP login problem", web.rows["b"]["message"])

    def test_stuck_sap_fails_the_unfinished_ones(self):
        web = FakeWebsite(req("a", "ES-1-1-01"), req("b", "ES-1-1-02", "07500000002"))
        website_bot.run_sap_job = lambda jobs: [{"id": "a", "event": "start"},
                                                {"id": "a", "event": "ok", "old": ""},
                                                {"id": "b", "event": "start"},
                                                {"event": "stuck"}]
        self.run_once(web)
        self.assertEqual(web.rows["b"]["status"], "failed")
        self.assertIn("stuck", web.rows["b"]["message"])
        self.assertEqual(web.rows["a"]["status"], "done")

    def test_half_way_rows_are_recovered(self):
        web = FakeWebsite(req("a", status="sap"), req("b", "ES-1-1-02", "07500000002", status="portal"))
        self.run_once(web)
        self.assertEqual(web.rows["a"]["status"], "failed")
        self.assertIn("check this unit in SAP", web.rows["a"]["message"])
        self.assertEqual(web.rows["b"]["status"], "done")
        self.assertNotIn("sap_job", self.calls)


if __name__ == "__main__":
    unittest.main()
