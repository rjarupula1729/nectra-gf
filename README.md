# 🌱 GrowFresh — Home Gardening Commerce

Mobile-first e-commerce app for seeds, saplings, tools, compost and garden
accessories — with OTP login, cart, UPI payments, order fulfilment and a
live ops dashboard.

**Live web app:** https://rjarupula1729.github.io/nectra-gf/growfresh-app.html
**Ops dashboard:** https://rjarupula1729.github.io/nectra-gf/admin.html

**Stack:** Static web SPA (GitHub Pages) · React Native/Expo app ·
Node/Express API · PostgreSQL (Knex).

---

## System overview

```
 Customer phone/browser                 Backend (Render/local)            Ops team
┌──────────────────────┐          ┌─────────────────────────┐      ┌──────────────────┐
│ growfresh-app.html   │  HTTPS   │  Express API :5000      │      │  admin.html      │
│  (GitHub Pages)      ├─────────▶│  Postgres (Knex)        │◀─────┤  (GitHub Pages)  │
│  shop/cart/garden/   │  /api/*  │  users·products·orders  │ poll │  ADMIN_TOKEN     │
│  profile (5 pages)   │          │  otps·transactions      │ 15s  │  status updates  │
└──────────────────────┘          └───────────┬─────────────┘      └──────────────────┘
                                              │ NOTIFY_WEBHOOK_URL
                                              ▼
                                       Slack/Discord alert
                                       on every new order
```

The web app is static files on GitHub Pages; all state lives in Postgres
via the API. `shared/gf-config.js` is the single place that points the app
at the backend (`window.GF_API`). With no reachable backend the app
silently falls back to demo mode (local-only, OTP `1234`, mock payments).

---

## User flow — login to delivered

| # | Step | What happens |
|---|------|--------------|
| 1 | **Login (mobile + OTP)** | `POST /api/auth/send-otp` issues a 4-digit OTP (hashed, 5-min TTL, max 5 attempts) sent via the configured `SMS_PROVIDER`. Customer enters it → `POST /api/auth/verify-otp` → JWT stored in `localStorage`. |
| 2 | **Browse / search** | 200+ product catalog, category chips, search. Every `product_view`, `add_to_cart`, `screen_view` is logged to `activity_events` and feeds the Smart-Picks rail. |
| 3 | **Cart → checkout** | Cart badge + summary → "Proceed to Pay" opens the UPI screen with total (free delivery ≥ ₹499). |
| 4 | **Pay** | Three modes, picked automatically: **(a)** `RAZORPAY_KEY_*` set → real Razorpay Checkout, order placed only after server-side signature verify; **(b)** `GF_UPI_VPA` set → PhonePe/GPay deep link opens with amount prefilled, customer confirms after paying; **(c)** neither → mock animation (demo). |
| 5 | **Order created** | `POST /api/orders` — transactional: locks products, validates stock, writes order + line items + transaction, decrements stock, uses the customer's saved profile address. `payment_status` = `Paid` only for a verified gateway ref; COD/UPI-link orders = `Pending`. |
| 6 | **Ops notified** | `NOTIFY_WEBHOOK_URL` POSTs the order (items, total, customer, address) to Slack/Discord instantly; the admin dashboard polls every 15s regardless. |
| 7 | **Fulfilment** | Ops moves the order through the status machine: `Confirmed → Packed → Out for Delivery → Delivered` (or `Cancelled` from early states). Skips are rejected. |
| 8 | **Customer tracks** | Orders list in Profile → status reflects what ops set. |
| 9 | **Plant it** | Garden screen logs `user_plants` rows for grow tracking. |

---

## Ops dashboard (`admin.html`)

1. Open the link, paste the **`ADMIN_TOKEN`** (set in the backend env), Connect.
2. Stats bar: open orders · orders today · revenue today.
3. Order cards show id, total, **status badge**, customer name + mobile,
   payment method/status, item lines, and the delivery address.
4. Buttons move the order to the next state(s); invalid jumps are blocked
   server-side. `Pending` payment on UPI-link orders = **verify the credit
   in your UPI app first**, then pack.
5. New orders highlight green + flash the tab title; board refreshes
   every 15 s.

---

## Configuration (`shared/gf-config.js` + backend env)

| Setting | Where | Purpose |
|---|---|---|
| `GF_API` | `gf-config.js` | Deployed API base URL, e.g. `https://growfresh-api.onrender.com`. Blank → tries `localhost:5000` → demo mode. `?api=` URL param overrides. |
| `GF_UPI_VPA` / `GF_UPI_NAME` | `gf-config.js` | Your business UPI ID → enables PhonePe/GPay deep-link payments (no gateway, no fees). Blank → mock payments. |
| `JWT_SECRET` | backend env | Signs customer tokens (auto-generated on Render). |
| `ADMIN_TOKEN` | backend env | Guards `/api/admin/*` + order-status endpoint. Generate: `openssl rand -hex 24`. |
| `SMS_PROVIDER` | backend env | `console` (dev, OTP returned in API response) · `msg91` · `fast2sms` · `twilio`. Fill matching `*_KEY` vars. |
| `DEMO_OTP` | backend env | Fallback demo code (`1234` in dev). **Unset in production** to disable it. |
| `RAZORPAY_KEY_ID` / `_SECRET` | backend env | Enables real Razorpay Checkout; `/api/config` advertises it to the client. |
| `NOTIFY_WEBHOOK_URL` | backend env | Slack/Discord incoming webhook → instant new-order alert. |
| `DATABASE_URL` / `PG*` | backend env | Postgres connection (Render injects `DATABASE_URL`). |
| `CORS_ORIGIN` | backend env | Allowed origins; `*` for dev, lock down in prod. |

---

## Local development

```bash
# 1. database (Homebrew postgres@16 or Docker)
psql -d postgres -c "CREATE DATABASE growfresh"

# 2. backend
cd backend
cp .env.example .env          # fill PG* / JWT_SECRET / ADMIN_TOKEN
npm install
npx knex migrate:latest       # schema (users, products, orders, otps, …)
npx knex seed:run             # 171 products
npm start                     # → http://localhost:5000  (/api/health)

# 3. web app (static — any server)
cd ..
python3 -m http.server 8090   # → http://localhost:8090/growfresh-app.html
                              # → http://localhost:8090/admin.html
```

Quick end-to-end check: login → the OTP hint shows `Dev OTP: XXXX`
(console provider) → order → see it on `admin.html` with `ADMIN_TOKEN`.

## Deploy

- **Web app** — already on GitHub Pages (`Settings → Pages → main / root`).
- **API + DB** — Render Blueprint: `render.com → New → Blueprint →` connect
  this repo. `render.yaml` provisions the web service (Docker, `backend/`)
  + free Postgres and wires `DATABASE_URL`. Then set `ADMIN_TOKEN`,
  `SMS_PROVIDER` keys, `RAZORPAY_*`/`NOTIFY_WEBHOOK_URL` as needed in the
  Render dashboard, and point `GF_API` in `gf-config.js` at the service URL.
- Note: Render free tier sleeps after ~15 min idle (first request ~30 s).

---

## Feature flags (hidden-layer system)

Phase-2 features are **preserved in code, hidden behind flags** — flip to
`true` to re-enable. Web: `shared/gf-features.js` · Native:
`src/config/features.js`.

`COMMUNITY` · `WELLNESS` · `EXPERTS` · `REWARDS` · `FUTURE_PLANTS` ·
`EXTRAS` (AI Coach, Analyzer, Calendar, Learn, Kids, Subscriptions, R&D).

## Key API routes

```
POST /api/auth/send-otp|verify-otp     OTP login (JWT)
GET  /api/products                   catalog
POST /api/orders                     create order (TX: items+stock+txn)
GET  /api/orders · GET /api/orders/:id
POST /api/payments/razorpay/order|verify
GET  /api/config                     public client config
GET  /api/admin/orders · stats       ops queue      [x-admin-token]
PUT  /api/admin/orders/:id/status    status machine [x-admin-token]
PUT  /api/orders/:id/status          (legacy)       [x-admin-token]
GET  /api/health                     liveness
```

## Repo layout

```
growfresh-app.html + shop/garden/community/profile/admin.html   web app (Pages)
shared/          gf-app.js (UI logic+API bridge) · gf-config.js (API/UPI)
                 gf-features.js (flags) · gf-analytics.js (events)
                 gf-plants.js (recommendations) · gf-db-bundle.js (catalog)
backend/         Express API · routes/ · middleware/ · db/migrations+seeds
src/             React Native (Expo) app — same feature set
render.yaml      Render Blueprint (API + Postgres)
```

## More docs

- [`backend/MIGRATION_TO_POSTGRES.md`](backend/MIGRATION_TO_POSTGRES.md) — DB schema & migration notes
- [`PLAY_STORE_RELEASE.md`](PLAY_STORE_RELEASE.md) — shipping the Android build
- [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) — privacy policy
- [`COMPLETE_PROJECT_GUIDE.md`](COMPLETE_PROJECT_GUIDE.md) — full project guide
- `scripts/dev-up.sh` — one-command local dev setup
