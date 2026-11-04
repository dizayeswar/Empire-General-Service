import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parser import parse_message  # noqa: E402


class ParseMessageTest(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(parse_message("es-4-8-09 07501234567"),
                         {"code": "ES-4-8-09", "phone": "07501234567"})

    def test_spaces_and_country_code(self):
        self.assertEqual(parse_message("Hi, apartment ES 4 8 09\nmy number +964 750 123 4567"),
                         {"code": "ES-4-8-09", "phone": "07501234567"})

    def test_arabic_digits(self):
        self.assertEqual(parse_message("es-٤-٨-٠٩ ٠٧٥٠١٢٣٤٥٦٧"),
                         {"code": "ES-4-8-09", "phone": "07501234567"})

    def test_missing_phone(self):
        self.assertIsNone(parse_message("es-4-8-09 please add me"))

    def test_two_codes_is_not_guessed(self):
        self.assertIsNone(parse_message("es-4-8-09 or es-4-8-10, 07501234567"))


if __name__ == "__main__":
    unittest.main()
