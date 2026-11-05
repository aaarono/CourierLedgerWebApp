-- Courier Ledger Foundation migration: personal profiles and default personal workspace ONLY.
-- Financial transaction tables and team memberships are intentionally NOT exposed in Sprint 01.
-- Apply in Supabase SQL Editor or with Supabase CLI. Review before applying to shared projects.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 40),
  preferred_locale text not null default 'ru' check (preferred_locale in ('ru','cs','en')),
  preferred_currency_code text not null default 'CZK' check (preferred_currency_code in ('CZK','EUR','USD','UAH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'personal' check (kind in ('personal','team')),
  currency_code text not null check (currency_code in ('CZK','EUR','USD','UAH')),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);
create index if not exists workspaces_owner_user_idx on public.workspaces (owner_user_id);
-- Multiple personal workspaces may be created later for different accounting currencies.

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;

-- No direct inserts/deletes from client. Account signup inserts these via trusted trigger.
revoke all on public.profiles from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, preferred_locale, preferred_currency_code) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;

create policy "profile_read_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profile_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "personal_workspaces_read_own" on public.workspaces for select to authenticated
  using (owner_user_id = (select auth.uid()));

-- Trigger only runs at user creation. SECURITY DEFINER must have fixed search_path.
create or replace function public.bootstrap_courier_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_currency text;
  v_locale text;
  v_nickname text;
begin
  v_currency := case when new.raw_user_meta_data ->> 'preferred_currency_code' in ('CZK','EUR','USD','UAH')
    then new.raw_user_meta_data ->> 'preferred_currency_code' else 'CZK' end;
  v_locale := case when new.raw_user_meta_data ->> 'preferred_locale' in ('ru','cs','en')
    then new.raw_user_meta_data ->> 'preferred_locale' else 'ru' end;
  v_nickname := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nickname'),''), split_part(new.email,'@',1), 'Courier'),40);
  if char_length(v_nickname) < 2 then v_nickname := 'Courier'; end if;
  insert into public.profiles (id,nickname,preferred_locale,preferred_currency_code)
    values (new.id,v_nickname,v_locale,v_currency);
  insert into public.workspaces (owner_user_id,name,kind,currency_code)
    values (new.id,'Personal','personal',v_currency);
  return new;
end;
$$;
revoke all on function public.bootstrap_courier_user() from public;
drop trigger if exists courier_user_bootstrap on auth.users;
create trigger courier_user_bootstrap after insert on auth.users
for each row execute function public.bootstrap_courier_user();

-- Currency remains immutable for each created workspace in Sprint 01: no update GRANT.
-- Future team workspace creation must go through secured RPC + membership checks.
