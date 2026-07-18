-- Asteriq billing schema (Supabase / PostgreSQL)
-- Run once in the Supabase SQL editor.

create table if not exists users (
  id            text primary key,                -- Firebase uid
  email         text unique not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

create table if not exists subscriptions (
  id          bigserial primary key,
  user_id     text not null references users(id) on delete cascade,
  plan_id     text not null default 'free',
  status      text not null default 'active',
  started_at  timestamptz not null default now(),
  renews_at   timestamptz
);
create index if not exists subscriptions_user_idx on subscriptions(user_id);

create table if not exists credit_wallets (
  user_id       text primary key references users(id) on delete cascade,
  plan_id       text not null default 'free',
  purchased     integer not null default 0,      -- one-off packs, never reset
  lifetime_used integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists daily_credit_usage (
  id         bigserial primary key,
  user_id    text not null references users(id) on delete cascade,
  usage_date date not null,
  used       integer not null default 0,
  allowance  integer not null default 66,
  unique (user_id, usage_date)
);
create index if not exists daily_usage_user_date_idx on daily_credit_usage(user_id, usage_date desc);

create table if not exists credit_transactions (
  id         bigserial primary key,
  user_id    text not null references users(id) on delete cascade,
  amount     integer not null,                   -- negative = spent
  kind       text not null,                      -- debit | purchase | plan | admin
  label      text not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_txn_user_idx on credit_transactions(user_id, created_at desc);

create table if not exists payments (
  id                 bigserial primary key,
  user_id            text not null references users(id) on delete cascade,
  gateway            text not null default 'razorpay',
  gateway_order_id   text,
  gateway_payment_id text,
  amount_paise       bigint not null,
  currency           text not null default 'INR',
  status             text not null default 'created',
  created_at         timestamptz not null default now()
);
create index if not exists payments_user_idx on payments(user_id, created_at desc);

-- Row level security: users see only their own rows. The API writes with the
-- service role key, which bypasses these policies.
alter table credit_wallets      enable row level security;
alter table daily_credit_usage  enable row level security;
alter table credit_transactions enable row level security;
alter table payments            enable row level security;
