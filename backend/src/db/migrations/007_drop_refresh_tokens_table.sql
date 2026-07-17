-- 007_drop_refresh_tokens_table.sql
-- Removes the refresh_tokens table. The refresh-token flow was reverted in
-- favour of a longer-lived (7d) access token - the table and its endpoints are
-- no longer used. Migration 006 stays in history; this one undoes its table.

DROP TABLE IF EXISTS refresh_tokens;
