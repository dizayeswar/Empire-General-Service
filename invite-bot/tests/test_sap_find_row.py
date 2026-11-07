import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sap_b1  # noqa: E402


def _xml(units):
    rows = "".join(
        f"<Row><Visible>1</Visible><Columns>"
        f"<Column><ID>CardCode</ID><Value>C{i}</Value></Column>"
        f"<Column><ID>LicTradNum</ID><Value>{u}</Value></Column>"
        f"</Columns></Row>" for i, u in enumerate(units, start=1))
    return f"<Matrix><Rows>{rows}</Rows></Matrix>"


class _Cell:
    def __init__(self, value):
        self.Specific = type("S", (), {"Value": value})()


class FakeMatrix:
    """Just enough of the SAP list matrix for _find_row."""

    def __init__(self, units):
        self.units = units
        self.Columns = self
        self.Cells = self

    def Item(self, key):
        # Columns.Item(uid) -> column (self); Cells.Item(row) -> cell
        return _Cell(self.units[key - 1]) if isinstance(key, int) else self

    def SerializeAsXML(self, _):
        return _xml(self.units)


class FindRowTest(unittest.TestCase):
    def test_exact_match(self):
        m = FakeMatrix(["", "ES-4-8-08", "ES-4-8-09", "ES-4-8-10"])
        self.assertEqual(sap_b1._find_row(m, "ES-4-8-09"), (3, "C3"))

    def test_not_found_is_not_nearest(self):
        m = FakeMatrix(["ES-4-8-08", "ES-4-8-10"])
        with self.assertRaises(sap_b1.SapError):
            sap_b1._find_row(m, "ES-4-8-09")

    def test_duplicate_stops(self):
        m = FakeMatrix(["ES-4-8-09", "ES-4-8-09"])
        with self.assertRaisesRegex(sap_b1.SapError, "2 times"):
            sap_b1._find_row(m, "ES-4-8-09")

    def test_bad_phone_does_nothing(self):
        with self.assertRaises(sap_b1.SapError):
            sap_b1.update_unit_phone({}, "ES-4-8-09", "0750 466")


if __name__ == "__main__":
    unittest.main()
