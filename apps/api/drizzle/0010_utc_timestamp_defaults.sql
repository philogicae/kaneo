-- Postgres-only change: normalizes timestamp defaults to UTC. The fork stores
-- integer `timestamp_ms` columns with its own defaults, so there is nothing to
-- alter.
SELECT 1;
