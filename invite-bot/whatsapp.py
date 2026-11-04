"""Read new incoming messages from WhatsApp Web (Edge, saved profile).

WhatsApp Web changes its page often; if reading breaks, the selectors below
are the only place to fix.
"""
import re

URL = "https://web.whatsapp.com/"
CHAT_LIST = "#pane-side"
UNREAD_CHAT = '#pane-side [role="listitem"]:has(span[aria-label*="unread" i])'
CHAT_TITLE = "span[title]"
INCOMING = "#main div[data-id^='false_']"  # false_ = message from the other person
MESSAGE_TEXT = "span.selectable-text"

# An unsaved contact shows as its number, e.g. "+964 750 123 4567"
PHONE_TITLE_RE = re.compile(r"^\+?[\d\s\-()]{8,}$")


def open_whatsapp(context):
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(URL)
    print("Waiting for WhatsApp Web (scan the QR code with the phone if asked)...")
    page.wait_for_selector(CHAT_LIST, timeout=0)
    return page


def read_new_messages(page, only_unknown_numbers=True, last_n=5):
    """Open each unread chat and return [{message_id, sender, text}].

    Opening a chat marks it as read in WhatsApp, same as clicking it by hand.
    """
    found = []
    for _ in range(page.locator(UNREAD_CHAT).count()):
        # Re-query each time: the list re-orders after a chat is opened.
        chats = page.locator(UNREAD_CHAT)
        chat = None
        for i in range(chats.count()):
            title = chats.nth(i).locator(CHAT_TITLE).first.get_attribute("title") or ""
            if not only_unknown_numbers or PHONE_TITLE_RE.match(title.strip()):
                chat = chats.nth(i)
                break
        if chat is None:
            break
        sender = chat.locator(CHAT_TITLE).first.get_attribute("title").strip()
        chat.click()
        page.wait_for_selector(INCOMING, timeout=10000)
        page.wait_for_timeout(500)
        msgs = page.locator(INCOMING)
        for j in range(max(0, msgs.count() - last_n), msgs.count()):
            msg = msgs.nth(j)
            text = " ".join(msg.locator(MESSAGE_TEXT).all_inner_texts()).strip()
            if text:
                found.append({"message_id": msg.get_attribute("data-id"), "sender": sender, "text": text})
    return found
