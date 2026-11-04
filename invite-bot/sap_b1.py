"""Put the phone number on the unit in SAP Business One.

PLACEHOLDER: the screen, object and field names are filled in during the
recording session on the office LAN (see the plan, step 0).
"""


def update_unit_phone(config, code, phone, dry_run=False):
    """Return the old phone on the unit (None if empty). Raise on any problem."""
    if dry_run:
        print(f"  [dry-run] SAP: set phone of unit {code} to {phone}")
        return None
    raise NotImplementedError("SAP step not recorded yet - needs the LAN session")
