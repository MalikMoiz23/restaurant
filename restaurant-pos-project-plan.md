# Restaurant Management System — Project Plan (v1)

## 1. Vision

A tablet-based restaurant ordering and management system where customers order directly from the table, orders go live to the kitchen, staff track order status in real time, and billing is finalized at the counter against the table number. Built to be **best in class**: reliable even when the internet isn't, secure by design, and genuinely pleasant to use for customers, kitchen staff, and cashiers.

Target market: independent restaurants/cafés in Portugal, starting with a single-location pilot.

---

## 2. Feature Set

### 2.1 Core Features (v1, non-negotiable)

- Digital menu with categories, photos, descriptions, prices
- Table-linked ordering — order tied to table number, no customer login required
- Live order push from tablet to kitchen display
- Mid-meal reordering — add drinks/dessert to the same open table session
- Kitchen order status tracking (received → preparing → ready → served)
- Counter/cashier lookup by table number → full itemized running bill
- Bill finalization → hand-off to certified invoicing (legal requirement, see §4)

### 2.2 Differentiator Features (v1 — what makes this best-in-class)

- **Offline-first / local-server architecture** — system keeps working through Wi-Fi/internet drops; syncs to cloud when back online
- **Security hardening** — PIN-based staff roles, network segmentation (VLANs), audit logging on every order/bill change, pentested before launch
- **Waiter-call button** — customer taps "need help," nearest waiter's device is alerted instantly
- **Live table-status dashboard (manager view)** — occupied / ordering / eating / awaiting bill / needs cleaning, at a glance
- **Split-bill support** — by item, by person, or evenly split
- **Allergen/dietary filters** — filter menu by allergen or vegan/vegetarian/gluten-free
- **Multi-language menu switch** — important for tourists/Erasmus students
- **End-of-day sales close-out** — when the restaurant closes, system totals the day's sales and automatically registers/logs it against that date in a calendar view
- **Calendar-based sales reporting** — owner opens a calendar to check sales per day, per week, per month, or a custom filter (e.g. "last 3 days"), with totals shown for the selected range
- **Anonymous cash payment option** — customer can pay cash without providing NIF (tax number); system issues a valid simplified invoice to "Consumidor Final" as permitted under Portuguese tax rules

### 2.3 Phase 2 Backlog (not in v1, but on the roadmap)

- Analytics dashboard for owner (best-sellers, peak hours, table turnover time)
- Kitchen prep-time estimates shown to customer (e.g. "~12 min")
- Loyalty / repeat-customer tracking
- Post-meal customer feedback/rating per dish
- Inventory-linked auto "sold out" hiding of menu items
- Reservation integration
- Tip suggestion at bill time
- QR-code-only menu access as fallback if tablets are down

### 2.4 Explicitly Out of Scope for v1

- Online ordering / delivery (separate product)
- In-house payment processing (use existing terminals / MB Way / Stripe integration instead of building a PCI-DSS stack)
- Multi-restaurant / franchise management (single location first)

---

## 3. System Architecture

Three client apps, one shared backend:

1. **Customer Tablet App** — menu browsing, cart, order submission, live bill view, waiter-call, allergen filters, language switch
2. **Kitchen Display System (KDS)** — real-time incoming orders grouped by table, status updates
3. **Counter/Cashier App** — table lookup, itemized bill, split-bill, bill finalization, manager table-status dashboard

**Backend**: runs on a local server (e.g. mini-PC/Raspberry Pi) on the restaurant's own LAN, so the core loop (order → kitchen → bill) keeps working without internet. A sync worker pushes data to the cloud for backup and future analytics when connectivity is available.

**Real-time layer**: WebSockets for LAN-speed order push (avoids depending on external cloud services for core operation).

---

## 4. Legal / Compliance Note (Portugal)

Any software issuing invoices/receipts in Portugal must be certified by the Autoridade Tributária (AT) — this includes RSA signing, hash-chain integrity, SAF-T export, ATCUD codes, and QR codes, with penalties of €1,500–€18,750 for non-compliance.

**Decision for v1**: we do not build our own certified invoicing engine. The Billing service calls out to an existing certified invoicing provider/API (or is built on an already-certified open-source base) purely to issue the final fiscal document. Everything else (menu, ordering, kitchen, tables) is ours.

---

## 5. Team Ownership (proposed)

| Part | Owner | Scope |
|---|---|---|
| Frontend | Frontend dev | Tablet app, KDS, Counter app, shared design system |
| Backend | Backend dev | API, database, real-time layer, local-first sync |
| Security | Security dev | Auth, network segmentation, audit logging, pentesting |
| Compliance/Billing | Shared | Certified invoicing integration |
| Product/Coordination | You | Data model, feature scope, pilot restaurant, integration syncs |

---

*Next: once features are confirmed, this doc will be followed by a detailed data model and API contract.*
