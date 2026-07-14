-- =============================================
-- MI PORTAFOLIO — Supabase Schema
-- Pegá esto en SQL Editor → Run
-- =============================================

-- 1. Holdings (posiciones)
create table public.holdings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  type text not null check (type in ('stock_us','cedear','etf','crypto','cash')),
  shares numeric not null default 0,
  avg_cost numeric not null default 0,
  sector text default 'Otro',
  current_price numeric,
  day_change numeric default 0,
  cedear_ratio numeric,
  cedear_us text,
  date_added text,
  lots jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Snapshots (evolución rendimiento)
create table public.snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  rend_pct numeric,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- 3. Config (configuración por usuario)
create table public.configs (
  user_id uuid references auth.users(id) on delete cascade primary key,
  finnhub_key text default '',
  anthropic_key text default '',
  max_sector_pct numeric default 30,
  max_pos_pct numeric default 20,
  min_sectors integer default 3,
  momentum_warn_pct numeric default -10,
  updated_at timestamptz default now()
);

-- 4. RLS (Row Level Security) — cada usuario ve solo sus datos
alter table public.holdings enable row level security;
alter table public.snapshots enable row level security;
alter table public.configs enable row level security;

-- Policies: holdings
create policy "Users see own holdings" on public.holdings
  for select using (auth.uid() = user_id);
create policy "Users insert own holdings" on public.holdings
  for insert with check (auth.uid() = user_id);
create policy "Users update own holdings" on public.holdings
  for update using (auth.uid() = user_id);
create policy "Users delete own holdings" on public.holdings
  for delete using (auth.uid() = user_id);

-- Policies: snapshots
create policy "Users see own snapshots" on public.snapshots
  for select using (auth.uid() = user_id);
create policy "Users insert own snapshots" on public.snapshots
  for insert with check (auth.uid() = user_id);
create policy "Users update own snapshots" on public.snapshots
  for update using (auth.uid() = user_id);

-- Policies: configs
create policy "Users see own config" on public.configs
  for select using (auth.uid() = user_id);
create policy "Users insert own config" on public.configs
  for insert with check (auth.uid() = user_id);
create policy "Users update own config" on public.configs
  for update using (auth.uid() = user_id);

-- Index para performance
create index idx_holdings_user on public.holdings(user_id);
create index idx_snapshots_user_date on public.snapshots(user_id, date);
