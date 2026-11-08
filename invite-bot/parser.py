"""Find the apartment code and phone number in a WhatsApp message."""
import re

# es-4-8-09, ES 4 8 09, es_4_8_09, es-4/8/09, WW-13-24-H, RA-C3-G-M2
# A part with letters (H, C3, M2) must come after - _ / or . (never after a plain space),
# so ordinary words like "my unit is WW-13-24-H" are not read as a code.
_MARK_PART = r"\s*[\-_/.]\s*[a-z0-9]{1,3}"
_SPACE_PART = r"\s+\d{1,3}"
CODE_RE = re.compile(
    rf"(?i)\b([a-z]{{2}})((?:{_MARK_PART})|\s*\d{{1,3}})((?:{_MARK_PART})|{_SPACE_PART})"
    rf"((?:{_MARK_PART})|{_SPACE_PART})\b")
# 0750 123 4567, +964 750 123 4567, 00964-750-123-4567
PHONE_RE = re.compile(r"(?:\+|00)?(?:964[\s\-]?)?0?7\d{2}[\s\-]?\d{3}[\s\-]?\d{4}")

# Eastern Arabic and Persian digits -> 0-9
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def normalize_phone(raw):
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("964"):
        digits = digits[3:]
    if not digits.startswith("0"):
        digits = "0" + digits
    return digits if re.fullmatch(r"07\d{9}", digits) else None


def _codes(text):
    out = set()
    for prefix, *parts in CODE_RE.findall(text):
        parts = [re.sub(r"[\s\-_/.]", "", p).upper() for p in parts]
        if any(ch.isdigit() for p in parts for ch in p):  # a real code always has a number
            out.add("-".join([prefix.upper()] + parts))
    return out


def parse_message(text):
    """Return {"code", "phone"} or None when the message can't be read safely."""
    text = text.translate(_DIGITS)
    codes = _codes(text)
    phones = {p for p in (normalize_phone(m) for m in PHONE_RE.findall(text)) if p}
    # More than one code or phone: don't guess, flag it for a person.
    if len(codes) != 1 or len(phones) != 1:
        return None
    return {"code": codes.pop(), "phone": phones.pop()}
