-- 0003: per-account email template for sending documents from the seller's own email app.
-- Blank means "use the built-in template". Safe to re-run.

alter table public.business_profiles add column if not exists email_subject text not null default '';
alter table public.business_profiles add column if not exists email_message text not null default '';

alter table public.business_profiles drop constraint if exists business_profiles_email_subject_length;
alter table public.business_profiles add constraint business_profiles_email_subject_length
  check (char_length(email_subject) <= 200);

alter table public.business_profiles drop constraint if exists business_profiles_email_message_length;
alter table public.business_profiles add constraint business_profiles_email_message_length
  check (char_length(email_message) <= 2000);
