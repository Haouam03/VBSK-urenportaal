-- Ping Pong Tournament Tables
-- Run this in Supabase SQL Editor

-- Enable realtime
alter publication supabase_realtime replica identity full;

-- Tournaments table
create table if not exists tournaments (
  id uuid default gen_random_uuid() primary key,
  room_code text not null unique,
  host_id uuid not null,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  bracket jsonb,
  champion text,
  created_at timestamptz default now()
);

-- Players table
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table tournaments enable row level security;
alter table players enable row level security;

-- RLS policies for tournaments
create policy "Anyone can read tournaments"
  on tournaments for select
  using (true);

create policy "Anyone can insert tournaments"
  on tournaments for insert
  with check (true);

create policy "Host can update tournament"
  on tournaments for update
  using (true);

-- RLS policies for players
create policy "Anyone can read players"
  on players for select
  using (true);

create policy "Anyone can insert players"
  on players for insert
  with check (true);

create policy "Anyone can delete players"
  on players for delete
  using (true);

-- Enable realtime on both tables
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table players;

-- Index for fast room code lookup
create index if not exists idx_tournaments_room_code on tournaments(room_code);
create index if not exists idx_players_tournament_id on players(tournament_id);
