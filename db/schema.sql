-- =====================================================================
-- Mesa POS - Restaurant Management System
-- PostgreSQL schema (v1)
-- Money is stored as integer cents. Never floats.
-- =====================================================================

create extension if not exists pgcrypto;

drop view if exists session_totals cascade;
drop table if exists audit_log cascade;
drop table if exists daily_closeout cascade;
drop table if exists bill_split_item cascade;
drop table if exists bill_split cascade;
drop table if exists bill cascade;
drop table if exists waiter_call cascade;
drop table if exists order_item cascade;
drop table if exists customer_order cascade;
drop table if exists table_session cascade;
drop table if exists restaurant_table cascade;
drop table if exists zone cascade;
drop table if exists menu_item_diet cascade;
drop table if exists menu_item_allergen cascade;
drop table if exists menu_item_i18n cascade;
drop table if exists menu_item cascade;
drop table if exists menu_category_i18n cascade;
drop table if exists menu_category cascade;
drop table if exists diet_tag cascade;
drop table if exists allergen cascade;
drop table if exists staff cascade;

-- ---------------------------------------------------------------------
-- Staff and roles (PIN-based auth)
-- ---------------------------------------------------------------------
create table staff (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  role        text        not null check (role in ('waiter','kitchen','cashier','manager')),
  pin_hash    text        not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);
create index staff_role_idx on staff (role) where active;

-- ---------------------------------------------------------------------
-- The 14 EU declarable allergens (Reg. UE 1169/2011)
-- ---------------------------------------------------------------------
create table allergen (
  code    text primary key,
  name_pt text not null,
  name_en text not null,
  name_es text not null,
  name_fr text not null,
  icon    text not null
);

create table diet_tag (
  code    text primary key,
  name_pt text not null,
  name_en text not null,
  name_es text not null,
  name_fr text not null,
  icon    text not null
);

-- ---------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------
create table menu_category (
  id          serial primary key,
  code        text    not null unique,
  icon        text    not null default 'utensils',
  sort_order  int     not null default 0,
  active      boolean not null default true
);

create table menu_category_i18n (
  category_id int  not null references menu_category(id) on delete cascade,
  locale      text not null check (locale in ('pt','en','es','fr')),
  name        text not null,
  primary key (category_id, locale)
);

create table menu_item (
  id              serial primary key,
  category_id     int     not null references menu_category(id) on delete restrict,
  sku             text    not null unique,
  price_cents     int     not null check (price_cents >= 0),
  -- Portuguese IVA: 13% intermediate rate on catering food and coffee,
  -- 23% standard rate on alcohol, soft drinks, juices, sparkling water.
  vat_rate        numeric(4,2) not null default 13.00
                  check (vat_rate in (6.00, 13.00, 23.00)),
  photo_url       text,
  -- Illustration glyph used by the menu tiles. Keeps the menu fully
  -- offline: no external image host in the core ordering loop.
  glyph           text    not null default 'UTENSILS',
  available       boolean not null default true,
  is_alcoholic    boolean not null default false,
  prep_minutes    int     not null default 10,
  kitchen_station text    not null default 'cozinha'
                  check (kitchen_station in ('cozinha','grelha','bar','pastelaria')),
  sort_order      int     not null default 0
);
create index menu_item_category_idx on menu_item (category_id) where available;

create table menu_item_i18n (
  item_id     int  not null references menu_item(id) on delete cascade,
  locale      text not null check (locale in ('pt','en','es','fr')),
  name        text not null,
  description text not null default '',
  primary key (item_id, locale)
);

create table menu_item_allergen (
  item_id       int  not null references menu_item(id) on delete cascade,
  allergen_code text not null references allergen(code) on delete cascade,
  primary key (item_id, allergen_code)
);

create table menu_item_diet (
  item_id   int  not null references menu_item(id) on delete cascade,
  diet_code text not null references diet_tag(code) on delete cascade,
  primary key (item_id, diet_code)
);

-- ---------------------------------------------------------------------
-- Floor plan
-- ---------------------------------------------------------------------
create table zone (
  id          serial primary key,
  code        text not null unique,
  name_pt     text not null,
  name_en     text not null,
  sort_order  int  not null default 0
);

create table restaurant_table (
  id          serial primary key,
  zone_id     int  not null references zone(id) on delete restrict,
  number      int  not null unique,
  seats       int  not null default 4,
  -- live status driving the manager dashboard
  status      text not null default 'free'
              check (status in ('free','occupied','ordering','eating','awaiting_bill','needs_cleaning')),
  grid_x      int  not null default 0,
  grid_y      int  not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Sessions - one open meal per table, survives mid-meal reordering
-- ---------------------------------------------------------------------
create table table_session (
  id           uuid primary key default gen_random_uuid(),
  table_id     int  not null references restaurant_table(id) on delete restrict,
  guest_count  int  not null default 2 check (guest_count > 0),
  locale       text not null default 'pt' check (locale in ('pt','en','es','fr')),
  status       text not null default 'open'
               check (status in ('open','awaiting_bill','closed')),
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  opened_by    uuid references staff(id)
);
-- At most one non-closed session per table.
create unique index table_session_one_open_idx
  on table_session (table_id) where status <> 'closed';

-- ---------------------------------------------------------------------
-- Orders: a session has 1..n orders - the first plus every reorder
-- ---------------------------------------------------------------------
create table customer_order (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references table_session(id) on delete cascade,
  seq           int  not null,
  status        text not null default 'received'
                check (status in ('received','preparing','ready','served','cancelled')),
  note          text not null default '',
  placed_at     timestamptz not null default now(),
  preparing_at  timestamptz,
  ready_at      timestamptz,
  served_at     timestamptz,
  unique (session_id, seq)
);
create index customer_order_active_idx on customer_order (status, placed_at);

create table order_item (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references customer_order(id) on delete cascade,
  menu_item_id     int  not null references menu_item(id) on delete restrict,
  -- price, VAT and name snapshotted so a later menu edit never rewrites history
  name_snapshot    text not null,
  unit_price_cents int  not null check (unit_price_cents >= 0),
  vat_rate         numeric(4,2) not null,
  qty              int  not null check (qty > 0),
  seat_no          int,                    -- supports split-by-person
  note             text not null default '',
  station          text not null default 'cozinha'
);
create index order_item_order_idx on order_item (order_id);

-- ---------------------------------------------------------------------
-- Waiter-call button
-- ---------------------------------------------------------------------
create table waiter_call (
  id              uuid primary key default gen_random_uuid(),
  table_id        int  not null references restaurant_table(id) on delete cascade,
  session_id      uuid references table_session(id) on delete cascade,
  reason          text not null default 'help'
                  check (reason in ('help','water','bill','cleaning','cutlery')),
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references staff(id)
);
create index waiter_call_open_idx on waiter_call (created_at);

-- ---------------------------------------------------------------------
-- Billing. The fiscal document itself is issued by a certified AT
-- provider - we persist only the reference it hands back.
-- ---------------------------------------------------------------------
create table bill (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null unique references table_session(id) on delete cascade,
  subtotal_cents  int  not null default 0,   -- net, excluding IVA
  vat_13_cents    int  not null default 0,
  vat_23_cents    int  not null default 0,
  discount_cents  int  not null default 0,
  total_cents     int  not null default 0,   -- gross, payable
  status          text not null default 'open'
                  check (status in ('open','finalized','void')),
  split_mode      text not null default 'none'
                  check (split_mode in ('none','by_item','by_person','even')),
  nif             text,                     -- null => "Consumidor Final"
  payment_method  text check (payment_method in ('cash','mbway','multibanco','card')),
  -- supplied by the certified invoicing provider, never generated here
  invoice_no      text,
  atcud           text,
  qr_payload      text,
  finalized_at    timestamptz,
  finalized_by    uuid references staff(id),
  business_date   date
);
create index bill_business_date_idx on bill (business_date);

create table bill_split (
  id             uuid primary key default gen_random_uuid(),
  bill_id        uuid not null references bill(id) on delete cascade,
  label          text not null,
  total_cents    int  not null default 0,
  payment_method text check (payment_method in ('cash','mbway','multibanco','card')),
  paid_at        timestamptz
);

create table bill_split_item (
  split_id      uuid not null references bill_split(id) on delete cascade,
  order_item_id uuid not null references order_item(id) on delete cascade,
  qty           int  not null check (qty > 0),
  primary key (split_id, order_item_id)
);

-- ---------------------------------------------------------------------
-- End-of-day close-out feeding the sales calendar
-- ---------------------------------------------------------------------
create table daily_closeout (
  business_date date primary key,
  gross_cents   int   not null default 0,
  vat_cents     int   not null default 0,
  net_cents     int   not null default 0,
  bills_count   int   not null default 0,
  covers_count  int   not null default 0,
  by_payment    jsonb not null default '{}'::jsonb,
  closed_at     timestamptz not null default now(),
  closed_by     uuid references staff(id)
);

-- ---------------------------------------------------------------------
-- Audit log - every order and bill mutation
-- ---------------------------------------------------------------------
create table audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  staff_id   uuid references staff(id),
  entity     text  not null,
  entity_id  text  not null,
  action     text  not null,
  detail     jsonb not null default '{}'::jsonb,
  ip         text
);
create index audit_log_at_idx on audit_log (at desc);
create index audit_log_entity_idx on audit_log (entity, entity_id);

-- ---------------------------------------------------------------------
-- Running bill per session, IVA split by rate.
-- Menu prices are IVA-inclusive (Portuguese retail convention), so the
-- net figure is derived by dividing the gross by (1 + rate).
-- ---------------------------------------------------------------------
create view session_totals as
select
  s.id                                              as session_id,
  s.table_id,
  t.number                                          as table_number,
  coalesce(sum(round(oi.unit_price_cents * oi.qty / (1 + oi.vat_rate / 100))), 0)::int
                                                    as net_cents,
  coalesce(sum(case when oi.vat_rate = 13.00
    then oi.unit_price_cents * oi.qty - round(oi.unit_price_cents * oi.qty / 1.13)
    else 0 end), 0)::int                            as vat_13_cents,
  coalesce(sum(case when oi.vat_rate = 23.00
    then oi.unit_price_cents * oi.qty - round(oi.unit_price_cents * oi.qty / 1.23)
    else 0 end), 0)::int                            as vat_23_cents,
  coalesce(sum(oi.unit_price_cents * oi.qty), 0)::int as gross_cents,
  count(oi.id)::int                                 as line_count
from table_session s
join restaurant_table t on t.id = s.table_id
left join customer_order o on o.session_id = s.id and o.status <> 'cancelled'
left join order_item oi on oi.order_id = o.id
group by s.id, s.table_id, t.number;
