-- Libreng Invoice: initial schema.
-- Run once in Supabase → SQL Editor. Safe to re-run: every statement is idempotent.
--
-- Security model: the browser talks to the database directly with the public
-- (publishable) key, so Row Level Security is the authorization layer.
-- Every table is locked to the signed-in user's own rows; anonymous visitors get nothing.

begin;

-- ---------------------------------------------------------------------------
-- Business profile: one row per user.
-- ---------------------------------------------------------------------------
create table if not exists public.business_profiles (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name             text not null default '' check (char_length(name) <= 120),
  address          text not null default '' check (char_length(address) <= 300),
  phone            text not null default '' check (char_length(phone) <= 120),
  email            text not null default '' check (char_length(email) <= 120),
  tin              text not null default '' check (char_length(tin) <= 40),
  -- PNG/JPEG/WebP data URL, max ~300 KB of image data.
  logo_data_url    text check (
    logo_data_url is null
    or (char_length(logo_data_url) <= 409664 and logo_data_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')
  ),
  payment_methods  jsonb not null default '[]'::jsonb check (
    jsonb_typeof(payment_methods) = 'array' and jsonb_array_length(payment_methods) <= 10
  ),
  default_currency text not null default 'PHP' check (
    default_currency in ('PHP', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'HKD', 'AED', 'SAR')
  ),
  default_notes    text not null default '' check (char_length(default_notes) <= 1000),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documents: invoices, quotations and receipts.
-- Items, discount and customer are JSON because they are always read and
-- written together with the document; the app validates their shape.
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id                                uuid primary key,
  user_id                           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                              text not null check (kind in ('invoice', 'quotation', 'acknowledgement_receipt', 'delivery_receipt')),
  number                            text not null check (char_length(number) between 1 and 40),
  issue_date                        date not null,
  due_date                          date,
  customer                          jsonb not null check (jsonb_typeof(customer) = 'object'),
  items                             jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50
  ),
  discount                          jsonb not null check (jsonb_typeof(discount) = 'object'),
  other_charge                      jsonb not null check (jsonb_typeof(other_charge) = 'object'),
  amount_paid_centavos              bigint not null default 0 check (amount_paid_centavos between 0 and 999999999999),
  currency                          text not null check (currency in ('PHP', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'HKD', 'AED', 'SAR')),
  notes                             text not null default '' check (char_length(notes) <= 1000),
  show_not_official_receipt_notice  boolean not null default true,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),
  -- One INV-2026-0001 per user per document type, even across devices.
  constraint documents_user_kind_number_key unique (user_id, kind, number)
);

create index if not exists documents_user_updated_idx on public.documents (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Numbering counters: last used sequence per user, kind and year.
-- Maintained by a trigger so the counter moves in the same transaction as the save.
-- ---------------------------------------------------------------------------
create table if not exists public.document_counters (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('invoice', 'quotation', 'acknowledgement_receipt', 'delivery_receipt')),
  year           int  not null check (year between 2000 and 9999),
  last_sequence  int  not null check (last_sequence between 0 and 99999999),
  primary key (user_id, kind, year)
);

create or replace function public.advance_document_counter()
returns trigger
language plpgsql
security invoker
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
  if parts is not null then
    insert into public.document_counters (user_id, kind, year, last_sequence)
    values (new.user_id, new.kind, parts[1]::int, parts[2]::int)
    on conflict (user_id, kind, year)
    do update set last_sequence = greatest(public.document_counters.last_sequence, excluded.last_sequence);
  end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Owners cannot move a row to another account.
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_advance_counter on public.documents;
create trigger documents_advance_counter
  after insert or update of number, kind on public.documents
  for each row execute function public.advance_document_counter();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before insert or update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at
  before insert or update on public.business_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists documents_prevent_owner_change on public.documents;
create trigger documents_prevent_owner_change
  before update on public.documents
  for each row execute function public.prevent_owner_change();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user sees and changes only their own rows.
-- ---------------------------------------------------------------------------
alter table public.business_profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_counters enable row level security;

-- Anonymous (signed-out) visitors get no access at all.
revoke all on public.business_profiles, public.documents, public.document_counters from anon;
grant select, insert, update, delete on public.business_profiles, public.documents to authenticated;
-- Counters are written only by the trigger (running as the signed-in user); the app just reads them.
grant select, insert, update on public.document_counters to authenticated;

drop policy if exists "Own profile" on public.business_profiles;
create policy "Own profile" on public.business_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own documents" on public.documents;
create policy "Own documents" on public.documents
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own counters" on public.document_counters;
create policy "Own counters" on public.document_counters
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Account deletion (Data Privacy Act: users can erase their data).
-- Deleting the auth user cascades to every table above.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Trigger functions are not meant to be called directly.
revoke all on function public.advance_document_counter() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_owner_change() from public, anon, authenticated;

commit;
