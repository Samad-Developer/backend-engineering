# Stage 19 — Production PostgreSQL

Notes on running a real database in production, not just building schema and writing queries: knowing who's connected, backing data up, and recovering it when something goes wrong.

---

## 1. Dev vs Production Database

**The distinction, in plain words:** a dev database is safe to break — drop tables, run messy test data, restart it, nothing real is at stake. A production database holds real user data; mistakes there have real consequences (lost bookings, leaked data, downtime for real people).

**The one rule that follows from this:** never point dev code at a production connection string, even "just to check something quickly." A typo'd `DELETE` or a dropped table during debugging is a non-event on dev and a disaster on prod. This is also *why* separate per-environment credentials (Application Security notes) matter — if dev and prod shared a password, a leaked dev `.env` would also compromise production.

---

## 2. Production Connection Configuration (recap)

Nothing new here conceptually — it's a checklist of things already learned, that specifically matter once an app is live and being hit by real traffic:

- **SSL/TLS** — most managed providers (Supabase, Railway, RDS) require it; connection is refused without it (Application Security notes).
- **Pool sizing vs server `max_connections`** — your app's `Pool` has a max client count; the Postgres server itself has a hard ceiling (`max_connections`) across *all* connected apps/roles combined. Size pools so multiple app instances together don't exceed the server's limit.
- **Per-environment credentials** — different password for dev/staging/production, read from environment variables, never hardcoded (Application Security notes).
- **`connectionTimeoutMillis` / `idleTimeoutMillis`** — how long to wait for a free connection before failing, and how long an idle connection sits open before the pool closes it. Matters more in production because traffic is unpredictable, unlike controlled dev testing.

---

## 3. Observability — `pg_stat_activity`

**The problem it solves:** once an app is live, you can't see what's happening inside the database just by looking at your own code — many things can be querying it at once (your app, admin tools, the hosting provider's own internals). `pg_stat_activity` is a built-in Postgres system view that shows **every current connection and what it's doing, right now.**

```sql
SELECT pid, usename, datname, state, query, query_start
FROM pg_stat_activity;
```

**Key columns:**

| Column | Meaning |
|---|---|
| `pid` | Process id for that connection — unique per connection |
| `usename` | Which role is connected (`postgres`, `bookeasy_app`, a provider-internal role, etc.) |
| `datname` | Which database that connection is using |
| `state` | `active` (running a query right now), `idle` (connected, not currently running anything), or `NULL` (a background worker, not a real client connection) |
| `query` | The most recent query text on that connection |
| `query_start` | When that most recent query *started* — **not** proof it's still running; an `idle` connection with an old `query_start` just means its last query began a while ago, then finished, and it's been sitting idle since |

**Reading real output (from a live Supabase project):** rows fell into three groups:

1. **Your own real activity** — the actual query you're running, state `active`.
2. **Provider-internal roles** — `supabase_admin`, `authenticator`, and similar. These are the managed platform's own infrastructure connections (handling auth, API routing, etc.) — not something you wrote, safe to recognize and mentally filter out as noise.
3. **Background workers** — rows with `NULL` `usename`/`state`. These are Postgres's own internal maintenance processes (autovacuum, etc.), not client connections at all.

Also seen in real traffic: `LISTEN`/`NOTIFY` queries — Postgres's built-in pub-sub mechanism (a connection "listens" for named events, another connection "notifies" them). Flagged as a feature that exists, not needed/covered yet.

**A practical filtered version**, useful once you know what noise to exclude:

```sql
SELECT pid, usename, state, query, query_start
FROM pg_stat_activity
WHERE usename NOT IN ('supabase_admin', 'authenticator')
  AND state IS NOT NULL;
```

---

## 4. Database Health Checks

**What it is:** not a Postgres feature — an app-code pattern. Hosting platforms (and your own monitoring) need a cheap, fast way to ask "is the database actually reachable and responsive right now?" so they know whether to restart a service or fire an alert.

```js
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'db unreachable' });
  }
});
```

`SELECT 1` does nothing except prove the connection works — no real table touched, minimal cost, run as often as needed.

---

## 5. Database Backups — `pg_dump`

**What it is:** a command-line tool that connects to a database and writes out everything needed to recreate it — schema (table definitions) plus data — into a single file.

```
pg_dump -h localhost -U postgres -d bookeasy -f bookeasy_backup.sql
```

**What the output file actually is — concretely verified by reading a real backup file:** plain SQL text, not JSON and not a visual table. It contains:

- `CREATE TABLE` statements (the schema) — one per table.
- `COPY tablename (col1, col2, ...) FROM stdin;` blocks for each table's actual data — raw rows, tab-separated, one row per line, ending with a lone `\.` line.

So the real data *is* in the file, just not formatted like a spreadsheet — it looks like plain rows of tab-separated values sitting under a `COPY ... FROM stdin;` line.

**What `pg_dump` does *not* capture:**

- Any **other database** on the same server — `pg_dump -d bookeasy` only touches `bookeasy`. A server with five databases needs five separate dumps (or `pg_dumpall` for everything server-wide, including roles — rarely needed in normal day-to-day use).
- **Roles and permissions** — these are server-level objects (Module 16), not part of any one database's contents. A restore recreates tables and data, but not the `bookeasy_app` role or its GRANTs — those would need to be recreated separately.

**Real troubleshooting story — password auth error:** running `pg_dump` on Windows initially failed with:

```
pg_dump: error: connection to server at "localhost" (::1), port 5432 failed:
FATAL: password authentication failed for user "postgres"
```

Resolved by the correct credentials/version matching up (there can be a PATH mismatch between an old `pg_dump.exe` and the actual running Postgres version — checking `pg_dump --version` vs `psql --version` is the way to catch that).

**Real troubleshooting story — "where's my data?":** after a successful dump, scrolling through the file seemed to show no real data — just confusing walls of text. The actual cause: the file was **502,534 lines long**, and the real tables (`venues`, `users`, `bookings`) were near the very end (lines ~501,663 onward). In between sat roughly **500,000 lines of leftover `index_test` data** — a practice table created earlier (Indexes module) via `generate_series(1, 500000)`, producing fake rows like:

```
499998	user499998@example.com	User 499998
499999	user499999@example.com	User 499999
500000	user500000@example.com	User 500000
```

This wasn't corruption or a tool bug — it was genuinely leftover practice data from an earlier lesson, still sitting in the database, getting backed up along with everything real every single time. Confirmed the real data was present and correct by reading the actual `venues` and `users` `COPY` blocks directly — real rows (e.g. a venue `Sunset Hall` owned by user id 7) were there, just buried.

**The fix/lesson:** `DROP TABLE index_test;` — remove leftover practice tables once you're done with a lesson that generated bulk fake data, so future backups don't carry around hundreds of thousands of meaningless rows.

---

## 6. Restore

Restoring means running the dump file's SQL back through `psql`, against a **different, empty** database — not overwriting a live database in place:

```
psql -U postgres -h localhost -d a_fresh_empty_database -f bookeasy_backup.sql
```

This re-creates every table (via the dump's `CREATE TABLE` statements) and re-inserts every row (via the `COPY ... FROM stdin` blocks) into that fresh target database.

---

## 7. Backup Verification

**The point:** a backup file existing on disk is not proof it's usable — the only real proof is actually restoring it somewhere and confirming the data comes back correctly. This is exactly what the troubleshooting above forced: confirming the backup wasn't "missing data," just that the real rows were deep in a huge file, by directly reading specific line ranges and finding genuine `venues`/`users` rows. A backup you've never test-restored is an *assumed* backup, not a *verified* one.

---

## 8. Disaster Recovery Basics — RPO and RTO

Two named concepts for thinking about how much failure your backup strategy can tolerate:

- **RPO (Recovery Point Objective):** how much data loss is acceptable, measured in time. If backups run nightly and the database dies right before the next backup, you lose everything since the last one — so "nightly backups" implies an RPO of up to 24 hours.
- **RTO (Recovery Time Objective):** how much downtime is acceptable while recovering. A restore that takes 3 hours gives an RTO of 3 hours.

Not implemented hands-on here — managed providers like Supabase largely absorb this concern automatically (next section).

---

## 9. Where to see this in Supabase

**Dashboard → Database → Backups** shows:

- **Automatic backup history** — Supabase takes scheduled backups on its own, without any `pg_dump` command from you.
- **Retention window** — how far back backups are kept (varies by plan).
- **Point-in-Time Recovery (PITR)** — a paid-tier feature letting you restore to almost any specific moment, not just a nightly snapshot (tighter RPO than daily backups alone).
- **A per-backup Restore button** — lets you trigger a restore directly from the dashboard, without manually running `psql`.

---

## Summary table

| Topic | Problem it solves | Key command / idea |
|---|---|---|
| Dev vs production | Dev mistakes are free; prod mistakes are real | Never point dev code at a prod connection string |
| Production connection config | Live traffic exposes config mistakes that dev never hits | SSL/TLS, pool sizing vs `max_connections`, per-env credentials, timeouts |
| `pg_stat_activity` | Can't see what's using the database right now | `SELECT ... FROM pg_stat_activity` — filter out provider-internal roles and NULL-state background workers |
| Health checks | Hosting platform needs to know if the DB is reachable | `SELECT 1` behind a `/health` route |
| Backups (`pg_dump`) | Data loss from crashes, mistakes, or corruption | `pg_dump -d dbname -f file.sql` — plain SQL text (CREATE TABLE + COPY blocks), one database only, no roles |
| Restore | Getting backed-up data back into a usable database | `psql -d fresh_db -f file.sql` — restore into a new/empty database |
| Backup verification | A backup file existing isn't proof it works | Actually test-restore it and confirm the data |
| RPO / RTO | How much loss/downtime is acceptable | RPO = data loss tolerance, RTO = downtime tolerance |
| Supabase Backups page | Seeing/managing all of this without manual `pg_dump` | Database → Backups — history, retention, PITR (paid), Restore button |
