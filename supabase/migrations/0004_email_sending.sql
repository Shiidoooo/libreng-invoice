-- Libreng Invoice: limits for emails sent by the app (the send-document-email function).
-- Run once in Supabase → SQL Editor, after 0003. Safe to re-run.
--
-- The app can email a document to a customer through an email provider. Email is the
-- one feature that reaches people outside the app, so it is limited here, in the
-- database, where the limits cannot be skipped:
--   * each account may send a fixed number of emails per day;
--   * all accounts together stay under the provider's daily allowance;
--   * only accounts with a confirmed email address may send.
-- The function calls register_email_send() before every email. It raises PT429 when a
-- limit is reached and PT403 when the account's email is not confirmed.
-- Only the time of each send is recorded: no recipient, subject or content.

begin;

create table if not exists public.email_sends (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sent_at  timestamptz not null default now()
);

create index if not exists email_sends_user_sent_idx on public.email_sends (user_id, sent_at desc);
create index if not exists email_sends_sent_idx on public.email_sends (sent_at desc);

-- Users cannot read, add or remove rows themselves; only the function below writes.
alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

create or replace function public.register_email_send()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Keep the total under the email provider's free daily allowance (300), leaving room
  -- for sign-up and password emails that use the same provider.
  c_user_daily_limit   constant int := 20;
  c_global_daily_limit constant int := 250;
  v_user       uuid := auth.uid();
  v_confirmed  timestamptz;
  v_user_count int;
  v_all_count  int;
begin
  if v_user is null then
    raise exception 'Sign in to send email' using errcode = 'PT401';
  end if;

  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = v_user;
  if v_confirmed is null then
    raise exception 'Confirm your email address before sending email' using errcode = 'PT403';
  end if;

  -- One sender at a time, so two requests cannot both pass a limit that has one slot left.
  perform pg_advisory_xact_lock(hashtext('libreng-invoice.email-sends'));

  select count(*) into v_user_count
  from public.email_sends s
  where s.user_id = v_user and s.sent_at > now() - interval '24 hours';
  if v_user_count >= c_user_daily_limit then
    raise exception 'Daily email limit reached for this account' using errcode = 'PT429';
  end if;

  select count(*) into v_all_count
  from public.email_sends s
  where s.sent_at > now() - interval '24 hours';
  if v_all_count >= c_global_daily_limit then
    raise exception 'Daily email limit reached for the service' using errcode = 'PT429';
  end if;

  insert into public.email_sends (user_id) values (v_user);
end;
$$;

revoke all on function public.register_email_send() from public, anon;
grant execute on function public.register_email_send() to authenticated;

-- Old rows are only needed for the 24-hour counts. Schedule next to purge_old_error_logs:
--   select cron.schedule('purge-email-sends', '23 3 * * *', 'select public.purge_old_email_sends()');
create or replace function public.purge_old_email_sends()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.email_sends where sent_at < now() - interval '7 days';
$$;

revoke all on function public.purge_old_email_sends() from public, anon, authenticated;

commit;
