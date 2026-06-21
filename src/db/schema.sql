-- DueTrack database schema (PostgreSQL)
-- Run this once against your database to create all tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------
-- shop_owners: one row per registered shop / business account
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_owners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- customers: due records, scoped to a shop owner
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_owner_id   UUID NOT NULL REFERENCES shop_owners(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  service         TEXT NOT NULL DEFAULT '',
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          VARCHAR(10) NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Paid'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_shop_owner ON customers(shop_owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(shop_owner_id, status);

-- ---------------------------------------------------------------
-- payments: full history of every payment made against a customer
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  shop_owner_id   UUID NOT NULL REFERENCES shop_owners(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_owner_date ON payments(shop_owner_id, paid_at);
