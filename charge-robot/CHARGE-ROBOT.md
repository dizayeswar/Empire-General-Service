# Charge robot

Local laptop tool for Empire World electricity charging. It does **not** run on GitHub Pages. NovaSys must be open on this Windows PC.

The live site has a **Charging Electricity** department tile (`charging-electricity.html`). Website charging is not live yet — this laptop robot stays separate.

Start: double-click `start.bat`, then open http://127.0.0.1:5000

Trigger phrase from the planning chat: **charge robot**

## How we work

- Share thinking. Give choices. Do not guess.
- Confirm before any real charge (wrong apartment = real money).
- Never send NovaSys passwords in chat. Login stays on the laptop.
- Never type a NovaSys password from chat. Saved login on the PC only.

## What we are building

One page on the laptop: apartment + T1/T2 + money → Confirm → robot clicks NovaSys.

| Building type | v1 |
|---|---|
| Novasys (this folder) | Robot does the clicks we taught |
| Website apartments | Later — not taught yet |
| SAP | Out of v1 |

About 35 charges/day. Receipt is paper **and** on-screen Invoice preview. Receipt handling after maximize = later.

## Locked in

- Request ID **RU-#####** is unique and never repeats. Save it when opening a request. After Nova, find that same RU (search box, confirm the Buy line matches). Same apartment can have more than one open request.
- Spoken “close the request” = **SET PIN** only. Never tap the Close request button.
- System chosen by building (some website, some Novasys) — list still needed
- App: **NovaSys EnergySale** (leave it open; login not part of the robot)
- T1 = national electricity (default). T2 = generator. Price change ignored.
- Robot fields only: **Payment for tariff** and **Payment amount** (delete `0.00`, then type money)
- Nova Create payment often opens on **T2**. Tariff is a **dropdown only** — never type T1/T2. Click the list, then **read** the box. Also read amount (and apartment). If anything is wrong, **stop — do not Pay**.
- Pay dropdown: **Automatic** only (Manual is locked)
- After Pay: Invoice / PAYMENT RECEIPT → Maximize (button next to X)
- Confirm step required. Practice mode stops before Pay.

## Novasys click list

1. NovaSys EnergySale already open
2. Double-click **Payments (TOU Tariff)** (skip if Payment management is already open)
3. Under **Personal account**, type apartment → Enter
4. One-click the result row
5. Pay down-arrow → **Automatic**
6. Create payment: set T1 or T2; clear amount; type money
7. Click **Pay**
8. Maximize Invoice
9. Receipt after that = later

If a login box appears while NovaSys is already open, do **not** type a password. Click this order:

1. **Login to the NovaSyS** (User filled, password empty) → **Cancel**
2. **Logging in to NovaSyS** (password already filled, Remember my password checked) → **OK**
3. **Attention!** "The data base version … is obsolete! Continue anyway?" → **Yes**
4. Home page is normal — continue the charge (Payments TOU Tariff)

## Tested 7 Sep 2026

Worked: find NovaSys, search `es-3-11-10`, select row.

Blocked: Pay looked disabled after a login popup. Do not type the password from chat.

## Still open

- Website charge video / click list
- Building list (which buildings are website vs Novasys)
- What to do with the receipt after it is full screen
- Login popup while NovaSys is open: Cancel → OK (saved password) → Yes on obsolete database — locked 8 Sep 2026

## Files

- `app.py` — local page at port 5000
- `robot.py` — NovaSys clicks
- `templates/index.html` — confirm UI
- `start.bat` — install deps and run
- `logs/` — charge log + screenshots (not committed)
