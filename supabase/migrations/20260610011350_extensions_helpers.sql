-- Phase 2 · Migration 01 — extensions
-- BLUEPRINT.md §4
--
-- gen_random_uuid() is core in PG13+, but pgcrypto is ensured defensively so the
-- schema is portable to a fresh DB.
-- NOTE: the is_admin() helper lives in migration 02 (it must be created AFTER the
-- profiles table, since a `language sql` function validates its body — and thus
-- the profiles reference — at creation time).
create extension if not exists pgcrypto;
