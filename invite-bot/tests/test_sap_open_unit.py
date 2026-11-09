"""sap_b1._open_unit: fast find by Property Detail first, the whole '*' list only as fallback."""
import os
import sys
import unittest
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sap_b1  # noqa: E402


class Box:
    def __init__(self, value=""):
        self.Value = value


class Form:
    def __init__(self, type_ex, mode, code="", unit="", on_find=None):
        self.TypeEx, self.Mode, self.closed = type_ex, mode, False
        self.boxes = {sap_b1.CODE: Box(code), sap_b1.PROPERTY_DETAIL: Box(unit)}
        self.on_find = on_find
        self.Items = NS(Item=self._item)

    def _item(self, uid):
        click = (lambda _: self.on_find(self)) if uid == sap_b1.BTN_OK and self.on_find else (lambda _: None)
        return NS(Specific=self.boxes.get(uid, Box()), Click=click)

    def Close(self):
        self.closed = True


class OpenUnitTest(unittest.TestCase):
    def setUp(self):
        self.app = NS(Forms=NS(ActiveForm=None))
        self.used_list = []
        for name, fake in (("_open_find_window", self._find_window),
                           ("_open_unit_list", lambda app, unit: self.used_list.append(unit) or "LIST"),
                           ("_choose_from_list", lambda app, lst, unit: ("CHOSEN", lst.TypeEx)),
                           ("DIRECT_FIND_WAIT", 1)):
            self.addCleanup(setattr, sap_b1, name, getattr(sap_b1, name))
            setattr(sap_b1, name, fake)
        self.result = None

    def _find_window(self, app):
        def on_find(bp):
            self.typed = bp.boxes[sap_b1.PROPERTY_DETAIL].Value
            if self.result == "one":
                bp.Mode = sap_b1.OK_MODE
                bp.boxes[sap_b1.CODE].Value = "C1"
            elif self.result == "other":
                bp.Mode = sap_b1.OK_MODE
                bp.boxes[sap_b1.PROPERTY_DETAIL].Value = "ES-4-1-070"
            elif self.result == "list":
                app.Forms.ActiveForm = Form(sap_b1.LIST_FORM, 0)
        self.bp = Form(sap_b1.BP_FORM, sap_b1.FIND_MODE, on_find=on_find)
        app.Forms.ActiveForm = self.bp
        return self.bp

    def test_one_hit_opens_directly(self):
        self.result = "one"
        form = sap_b1._open_unit(self.app, "ES-4-1-07")
        self.assertIs(form, self.bp)
        self.assertEqual(self.typed, "ES-4-1-07")
        self.assertEqual(self.used_list, [])

    def test_several_hits_pick_from_the_short_list(self):
        self.result = "list"
        self.assertEqual(sap_b1._open_unit(self.app, "ES-4-1-07"), ("CHOSEN", sap_b1.LIST_FORM))
        self.assertEqual(self.used_list, [])

    def test_nothing_found_uses_the_whole_list(self):
        self.result = None
        self.assertEqual(sap_b1._open_unit(self.app, "ES-4-1-07"), "LIST")
        self.assertTrue(self.bp.closed)

    def test_other_unit_is_closed_and_whole_list_used(self):
        self.result = "other"
        self.assertEqual(sap_b1._open_unit(self.app, "ES-4-1-07"), "LIST")
        self.assertTrue(self.bp.closed)


if __name__ == "__main__":
    unittest.main()
