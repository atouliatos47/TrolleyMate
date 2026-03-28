# 🛒 BasketMate

**Aisle-sorted household shopping list PWA for UK supermarkets**

Live app → [trolleymate.onrender.com](https://trolleymate.onrender.com)  
Privacy Policy → [trolleymate.onrender.com/privacy](https://trolleymate.onrender.com/privacy)

---

## What It Does

BasketMate is a real-time shared shopping list app built for UK families. Items are sorted by supermarket aisle so you shop in order — no backtracking. Multiple family members share the same list live using a household code.

**Key features:**
- Aisle-sorted lists for all major UK supermarkets
- Real-time sync across all household devices (SSE)
- Push notifications when a family member adds an item
- Shopping mode — tap to check off items as you go
- Favourites, drag-to-reorder aisles, barcode scanner support
- 13 languages (EN, PL, RO, EL, UR, PA, BN, ZH, AR, GU, HI, PT, RU)
- PWA — installable on Android and iOS
- Available on Google Play as a TWA (Trusted Web Activity)
- Freemium model — 15-day trial, £2.99 one-time family upgrade

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, HTML, CSS (PWA) |
| Backend | Node.js (no framework, raw `http`) |
| Database | Neon (PostgreSQL, serverless) |
| Hosting | Render (Starter plan) |
| Push Notifications | web-push (VAPID) |
| Real-time | Server-Sent Events (SSE) |
| Payments | Google Play Billing (Digital Goods API) |
| Monitoring | UptimeRobot |
| Source control | GitHub (auto-deploy to Render on push) |

---

## Project Structure

```
BasketMate/
├── server.js              # Main server — routing, DB init, SSE
├── routes/
│   ├── households.js      # Create & join households
│   ├── stores.js          # Store management
│   ├── aisles.js          # Aisles & products
│   ├── items.js           # Shopping list items + push
│   ├── favourites.js      # Favourites
│   └── push.js            # Push subscription & shopping status
├── js/
│   ├── app.js             # Core init, splash, household setup
│   ├── api.js             # SSE, all API calls, trial logic
│   ├── ui.js              # Rendering — home, aisles, list
│   ├── stores.js          # Store add/delete/select
│   ├── shopping.js        # Shopping mode
│   ├── settings.js        # Settings panel
│   ├── utils.js           # Toast, modal, helpers
│   └── i18n/
│       ├── core.js        # Translation engine + aisle name map
│       ├── lang-en.js     # English
│       ├── lang-pl.js     # Polish
│       ├── lang-ro.js     # Romanian
│       ├── lang-el.js     # Greek
│       ├── lang-ur.js     # Urdu
│       ├── lang-pa.js     # Punjabi
│       ├── lang-bn.js     # Bengali
│       ├── lang-zh.js     # Chinese
│       ├── lang-ar.js     # Arabic
│       ├── lang-gu.js     # Gujarati
│       ├── lang-hi.js     # Hindi
│       ├── lang-pt.js     # Portuguese
│       └── lang-ru.js     # Russian
├── css/
│   └── style.css          # Full app stylesheet
├── sw.js                  # Service worker (network-only, push handler)
├── manifest.json          # PWA manifest
├── privacy.html           # Privacy policy (public, required for Play Store)
├── index.html             # App shell
├── package.json
└── start.bat              # Local development launcher (Windows)
```

---

## Environment Variables

Set these in Render → Environment before deploying:

```
DATABASE_URL        = postgresql://...   (Neon connection string)
VAPID_PUBLIC_KEY    = BML5gD46...        (generate with web-push)
VAPID_PRIVATE_KEY   = etwpXSq...         (generate with web-push)
VAPID_EMAIL         = mailto:you@email.com
PORT                = 10000              (Render sets this automatically)
```

To generate VAPID keys (run once locally):
```bash
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k);"
```

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/atouliatos47/BasketMate.git
cd BasketMate

# 2. Install dependencies
npm install

# 3. Set environment variables (edit start.bat or set manually)
set DATABASE_URL=your_neon_connection_string
set VAPID_PUBLIC_KEY=your_public_key
set VAPID_PRIVATE_KEY=your_private_key
set VAPID_EMAIL=mailto:you@email.com
set PORT=3001

# 4. Start the server
node server.js

# 5. Open in browser
# http://localhost:3001
```

On Windows, just edit and run `start.bat`.

---

## Deployment

Deployment is fully automatic via GitHub → Render:

1. Push to `main` branch
2. Render detects the push and redeploys automatically
3. Live at `https://trolleymate.onrender.com` within ~2 minutes

No manual steps required.

---

## Database

Neon PostgreSQL — tables are created automatically on first server start via `initDb()` in `server.js`. No migration files needed.

**Tables:** `households`, `stores`, `aisles`, `items`, `favourites`, `push_subscriptions`

---

## Freemium Model

| Feature | Free (after trial) | Premium (£2.99) |
|---|---|---|
| Stores | 3 (Tesco, Asda, Lidl) | Unlimited |
| Aisles per store | 3 | Unlimited |
| Products per aisle | 5 | Unlimited |
| Real-time sync | ❌ | ✅ |
| Push notifications | ❌ | ✅ |
| Family sharing | ✅ | ✅ |

One person upgrades → entire household goes premium instantly via SSE broadcast.

---

## Built By

**AtStudios** · Andreas Touliatos  
[atouliatos45@gmail.com](mailto:atouliatos45@gmail.com)
