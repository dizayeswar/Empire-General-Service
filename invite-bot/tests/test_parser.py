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

    def test_letter_at_the_end(self):
        self.assertEqual(parse_message("ww-13-24-h 07504718498"),
                         {"code": "WW-13-24-H", "phone": "07504718498"})

    def test_letters_inside(self):
        self.assertEqual(parse_message("RA-C3-G-M2\n0750 471 8498"),
                         {"code": "RA-C3-G-M2", "phone": "07504718498"})

    def test_words_before_code_are_not_a_code(self):
        self.assertEqual(parse_message("Hello my unit is WW-13-24-H and number 07504718498 thanks"),
                         {"code": "WW-13-24-H", "phone": "07504718498"})
        self.assertEqual(parse_message("hi i am in es 4 8 09 my phone 07501234567"),
                         {"code": "ES-4-8-09", "phone": "07501234567"})

    def test_no_separator_after_project(self):
        self.assertEqual(parse_message("es4-8-09 07501234567"),
                         {"code": "ES-4-8-09", "phone": "07501234567"})

    def test_letters_with_only_spaces_is_not_guessed(self):
        # "ww 13 24 h": the H after a plain space could be any word - a person checks it
        self.assertIsNone(parse_message("ww 13 24 h 07504718498"))

    def test_two_codes_is_not_guessed(self):
        self.assertIsNone(parse_message("es-4-8-09 or es-4-8-10, 07501234567"))


if __name__ == "__main__":
    unittest.main()
