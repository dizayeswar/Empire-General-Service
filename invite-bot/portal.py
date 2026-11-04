"""Send the invitation in the Empire World Customer Service Portal.

PLACEHOLDER: the search box and invite button are filled in once you show
the portal flow. You sign in yourself; the saved Edge profile remembers it.
"""

URL = "https://c21531-empirefrontend.cloudiax.com/"


def send_invitation(context, phone, dry_run=False):
    if dry_run:
        print(f"  [dry-run] Portal: search {phone} and send invitation")
        return
    raise NotImplementedError("Portal step not recorded yet")
