-- +goose Up
create extension if not exists pgcrypto;
create extension if not exists citext;

create type user_role as enum ('student', 'admin');

create table programs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  username citext unique not null,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  role user_role not null default 'student',
  program_id uuid references programs(id),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash bytea unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on refresh_tokens (user_id);

create table password_resets (
  token_hash bytea primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table events (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete cascade,
  card_id uuid,
  type text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events (user_id, created_at);

-- +goose Down
drop table events;
drop table password_resets;
drop table refresh_tokens;
drop table users;
drop table programs;
drop type user_role;
