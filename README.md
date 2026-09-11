# Mesa — Restaurant Management System

Tablet-based ordering, a live kitchen display, and counter billing for
independent restaurants in Portugal.

Guests order from the table without an account. Orders appear on the
kitchen screen instantly over the local network. The counter looks a
table up by its number, splits the bill if asked, and closes it against
a certified invoicing provider.

---

## What is here

Three client applications over one backend, all in this repository:

| App | Route | Who uses it |
|---|---|---|
| Table tablet | `/mesa/:n` | The guest — menu, allergen filters, cart, live order status, running bill, waiter call |
| Kitchen display | `/cozinha` | The kitchen — tickets by station, three lanes, colour-coded waiting times |
| Counter & management | `/balcao` | Staff — floor plan, bills, splits, payment, sales calendar, day close-out, audit trail |

The backend is a Fastify API with a WebSocket channel, designed to run
on a mini-PC on the restaurant's own LAN so the core loop keeps working
when the internet does not.

## Requirements

- Node.js 20 or newer (developed on 24)
- PostgreSQL 14 or newer (developed on 18)

## Setup

```bash
npm install
cp .env.example .env      # then fill in your PostgreSQL credentials
npm run db:reset          # creates the schema and seeds the menu
node scripts/make-icons.mjs
npm run dev
```

`npm run dev` starts both processes:

- API: <http://localhost:3001>
- Web: <http://localhost:5173>

Open <http://localhost:5173> and pick a device role.

### Demo staff PINs

| PIN | Who | Role |
|---|---|---|
| 1234 | Ana Sousa | Manager |
| 2345 | Bruno Costa | Cashier |
| 3456 | Rui Alves | Kitchen |
| 4567 | Inês Martins | Waiter |

## Layout

```
db/
  schema.sql        Tables, indexes, the running-bill view
  seed.sql          Portuguese menu in 4 locales, floor plan, 60 days of history
apps/api/
  src/core.ts       Pool, money maths, tokens, event bus, audit trail
  src/fiscal.ts     Certified-invoicing adapter (see Compliance below)
  src/routes/       menu, floor, orders, billing, auth, reports
apps/web/
  src/lib/          API client, live socket, Portuguese formatting, illustrations
  src/i18n/         pt · en · es · fr
  src/ui/           Design system
  src/screens/      The three applications
scripts/            Database, dev runner, icon generation
```

## Design decisions worth knowing

**Money is integer cents, everywhere.** No floats touch a price.

**IVA is computed per invoice line, not per rate total.** Menu prices
are IVA-inclusive, as Portuguese retail advertises them, so the net
figure is derived by dividing by `1 + rate`. Catering food and coffee
carry 13%; alcohol, soft drinks, juices and sparkling water carry 23%.
Both the SQL view the guest's tablet reads and the TypeScript the
cashier's finalize uses round the same way, so the two screens can never
disagree about the total.

**Prices are read server-side when an order is placed.** A tablet never
tells the kitchen what something costs.

**Order lines snapshot name, price and VAT rate.** Editing the menu
later never rewrites a bill that has already been printed.

**Split shares never lose a cent.** The remainder is distributed one
cent at a time across the first shares.

**The illustration system is drawn, not photographed.** Six vessel
forms — plate, bowl, cup, glass, bottle, board — plus a colour scheme
per dish, varied deterministically from each item's SKU. Fifty dishes
read as one designed set, with no image host in the ordering loop.

## Compliance

Software issuing invoices in Portugal must be certified by the
Autoridade Tributária — RSA signing, hash-chain integrity, SAF-T export,
ATCUD allocation and the fiscal QR code.

**This project does not implement any of that, deliberately.**
`apps/api/src/fiscal.ts` is the seam where a certified provider is
called. The bundled development driver emits clearly-marked
`NAO-FISCAL/…` placeholders with `certified: false`, and the interface
prints a non-fiscal banner across any receipt carrying that flag.

Wire a real provider and remove that banner before the system takes
live money.

## Security

- Staff PINs are bcrypt-hashed; sign-in is rate-limited per client and
  every candidate hash is checked so response time reveals nothing.
- Money and kitchen-queue routes require a staff token; guest ordering
  deliberately does not, which is the point of table-linked ordering.
- Every order and bill mutation is written to `audit_log` with the
  staff member, the action and the device address.
- `AUTH_SECRET` in `.env` signs session tokens. Replace it before any
  real deployment.

## Offline behaviour

The web app is an installable PWA. The menu is cached
stale-while-revalidate so a tablet keeps serving guests through a
network blip; live state is network-first with a four-second timeout and
a cached fallback. The WebSocket reconnects with backoff and re-checks
itself whenever a sleeping tablet wakes.

## Not built yet

Cloud sync worker, analytics beyond the sales calendar, prep-time
estimates for guests, loyalty, reservations, and inventory-linked
sold-out hiding. See the project plan for the full phase-2 backlog.
