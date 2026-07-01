-- =============================================================================
-- Grant the trusted server role (service_role) full access to the public schema.
--
-- Root cause this fixes: this project's Data API is configured so Supabase does
-- NOT auto-grant table privileges on SQL-created tables (see the note in
-- 20260628000001_contests_spike.sql). Every migration hand-grants `anon` and
-- `authenticated` with tight row/column scoping, but `service_role` was never
-- granted anything. `service_role` is only ever used server-side (Edge Functions
-- with the service key) and bypasses RLS, so table GRANTs are all it needs --
-- without them the receipts Edge Function failed its very first query with
-- "permission denied for table receipts".
--
-- Granting broadly to service_role (and, via default privileges, to objects
-- created by future migrations) keeps every current and future Edge Function
-- working without another migration. This does NOT touch anon/authenticated, so
-- their careful column/row scoping and all RLS policies remain exactly as-is.
-- =============================================================================

grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Cover tables/sequences created by future migrations too (this runs as the
-- migration owner, so the defaults attach to objects that owner creates).
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
