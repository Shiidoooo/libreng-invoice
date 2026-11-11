-- Libreng Invoice: rate limits, a per-account document cap, and developer error logs.
-- Run once in Supabase → SQL Editor, after 0001. Safe to re-run.
--
-- Why in the database: the browser talks to Supabase directly, so there is no API
-- server of ours to rate-limit in. Triggers here apply to every client, including
-- scripts that skip the app. Errors use custom SQLSTATEs that PostgREST turns into
-- HTTP statuses, and the app maps them to friendly messages:
--   PT429 → "going too fast"      PT422 → "document limit reached"

begin;

-- ---------------------------------------------------------------------------
-- Rate limiting: a fixed one-minute window per user and bucket.
-- Users cannot read or change their own counters (no grants, no policies).
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_buckets (
  user_id       uuid not null references auth.users (id) on delete cascade,
  bucket        text not null check (char_length(bucket) <= 40),
  window_start  timestamptz not null,
  hits          int not null,
  primary key (user_id, bucket)
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

-- Counts one hit and raises PT429 when the limit is passed. When it raises, the whole
-- write (including this increment) is rolled back, so the counter rests at the limit
-- until the window passes. Writes made from the dashboard (no auth.uid()) are not limited.
create or replace function public.consume_rate_limit(p_bucket text, p_limit int, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hits int;
begin
  if v_user is null then
    return;
  end if;
  insert into public.rate_limit_buckets as b (user_id, bucket, window_start, hits)
  values (v_user, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set hits = case when b.window_start < now() - p_window then 1 else b.hits + 1 end,
        window_start = case when b.window_start < now() - p_window then now() else b.window_start end
  returning hits into v_hits;
  if v_hits > p_limit then
    raise exception 'Rate limit exceeded for %', p_bucket using errcode = 'PT429';
  end if;
end;
$$;

revoke all on function public.consume_rate_limit(text, int, interval) from public, anon, authenticated;

-- Statement-level, so one backup import of 200 rows counts as one write, not 200.
create or replace function public.limit_document_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_rate_limit('document_writes', 60, interval '1 minute');
  return null;
end;
$$;

create or replace function public.limit_profile_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_rate_limit('profile_writes', 20, interval '1 minute');
  return null;
end;
$$;

drop trigger if exists documents_rate_limit on public.documents;
create trigger documents_rate_limit
  before insert or update on public.documents
  for each statement execute function public.limit_document_writes();

drop trigger if exists business_profiles_rate_limit on public.business_profiles;
create trigger business_profiles_rate_limit
  before insert or update on public.business_profiles
  for each statement execute function public.limit_profile_writes();

-- ---------------------------------------------------------------------------
-- Per-account document cap (matches the app's loading limit with room to spare).
-- An upsert of an existing document is an edit, not a new document, so it is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_document_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.documents where id = new.id) then
    return new;
  end if;
  -- One user at a time, so parallel inserts cannot slip past the cap.
  perform pg_advisory_xact_lock(hashtext('documents:' || new.user_id::text));
  if (select count(*) from public.documents where user_id = new.user_id) >= 10000 then
    raise exception 'Document limit reached' using errcode = 'PT422';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_limit on public.documents;
create trigger documents_limit
  before insert on public.documents
  for each row execute function public.enforce_document_limit();

-- ---------------------------------------------------------------------------
-- Developer error log. The app writes one row per unexpected error, tagged with the
-- reference code the customer sees. Users can insert their own rows but never read
-- any; developers read them in the Supabase dashboard (Table Editor), which bypasses RLS.
-- No passwords, tokens or document contents are logged: see src/errors/reportError.ts.
-- ---------------------------------------------------------------------------
create table if not exists public.client_error_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reference   text not null check (reference ~ '^[A-Z2-9]{6}$'),
  kind        text not null check (char_length(kind) <= 30),
  context     text not null check (char_length(context) <= 120),
  detail      text not null check (char_length(detail) <= 500),
  page        text not null default '' check (char_length(page) <= 120),
  user_agent  text not null default '' check (char_length(user_agent) <= 500),
  created_at  timestamptz not null default now()
);

create index if not exists client_error_logs_created_idx on public.client_error_logs (created_at desc);
create index if not exists client_error_logs_reference_idx on public.client_error_logs (reference);

alter table public.client_error_logs enable row level security;
revoke all on public.client_error_logs from anon, authenticated;
grant insert on public.client_error_logs to authenticated;

drop policy if exists "Insert own error logs" on public.client_error_logs;
create policy "Insert own error logs" on public.client_error_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.limit_error_log_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_rate_limit('error_logs', 20, interval '1 minute');
  return new;
end;
$$;

drop trigger if exists client_error_logs_rate_limit on public.client_error_logs;
-- Per row (unlike the document limits): one request must not be able to insert thousands of log rows.
create trigger client_error_logs_rate_limit
  before insert on public.client_error_logs
  for each row execute function public.limit_error_log_writes();

-- Trigger functions are not meant to be called directly.
revoke all on function public.limit_document_writes() from public, anon, authenticated;
revoke all on function public.limit_profile_writes() from public, anon, authenticated;
revoke all on function public.enforce_document_limit() from public, anon, authenticated;
revoke all on function public.limit_error_log_writes() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Size limits on JSON columns. The app enforces field lengths, but a script could
-- otherwise store megabytes in an extra JSON key. Limits are in bytes (UTF-8 can
-- use up to 4 bytes per character), with headroom over the app's own limits.
-- ---------------------------------------------------------------------------
alter table public.documents drop constraint if exists documents_customer_size;
alter table public.documents add constraint documents_customer_size check (octet_length(customer::text) <= 4096);
alter table public.documents drop constraint if exists documents_items_size;
alter table public.documents add constraint documents_items_size check (octet_length(items::text) <= 100000);
alter table public.documents drop constraint if exists documents_discount_size;
alter table public.documents add constraint documents_discount_size check (octet_length(discount::text) <= 256);
alter table public.documents drop constraint if exists documents_other_charge_size;
alter table public.documents add constraint documents_other_charge_size check (octet_length(other_charge::text) <= 1024);
alter table public.business_profiles drop constraint if exists business_profiles_payment_methods_size;
alter table public.business_profiles add constraint business_profiles_payment_methods_size check (octet_length(payment_methods::text) <= 16384);

-- ---------------------------------------------------------------------------
-- Numbering counters: written only by the trigger, never directly by users.
-- The trigger now runs as the table owner and skips years the table cannot hold,
-- so an odd number like INV-1999-0001 saves instead of failing.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.document_counters from authenticated;

create or replace function public.advance_document_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text := case new.kind
    when 'invoice' then 'INV'
    when 'quotation' then 'QUO'
    when 'acknowledgement_receipt' then 'AR'
    when 'delivery_receipt' then 'DR'
  end;
  parts text[];
begin
  -- Only numbers in the automatic format (e.g. INV-2026-0007) move the counter.
  parts := regexp_match(new.number, '^' || prefix || '-(\d{4})-(\d{4,8})$');
  if parts is null or parts[1]::int not between 2000 and 9999 then
    return new;
  end if;
  insert into public.document_counters (user_id, kind, year, last_sequence)
  values (new.user_id, new.kind, parts[1]::int, parts[2]::int)
  on conflict (user_id, kind, year)
  do update set last_sequence = greatest(public.document_counters.last_sequence, excluded.last_sequence);
  return new;
end;
$$;

revoke all on function public.advance_document_counter() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Error log retention: keep 90 days. Run manually, or schedule it with the
-- pg_cron extension (Database → Extensions → pg_cron), for example:
--   select cron.schedule('purge-error-logs', '17 3 * * *', 'select public.purge_old_error_logs()');
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_error_logs()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.client_error_logs where created_at < now() - interval '90 days';
$$;

revoke all on function public.purge_old_error_logs() from public, anon, authenticated;

commit;
