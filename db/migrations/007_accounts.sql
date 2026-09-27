-- Real accounts (Google sign-in). Device-only users keep working; on first sign-in their notes move to the account.
alter table users add column image text;
alter table users add column last_sign_in timestamptz;
