# Module 16 — PostgreSQL Security (Roles & Permissions)

Notes on controlling *who* can connect to your database and *what* they're allowed to do once connected — built and verified hands-on against a real `bookeasy` database in pgAdmin.

---

## 1. Users and Roles

**What it is, in plain words:** a **role** is an identity inside PostgreSQL that can own objects and be given permissions. A role that's also allowed to log in (has a password) is what people casually call a "user" — in modern Postgres, `CREATE USER` is really just shorthand for `CREATE ROLE ... WITH LOGIN`.

**Why this matters:** every connection made through `postgres` so far has used a **superuser** — an account with unrestricted power (read everything, delete everything, drop the whole database, create/delete other roles). That's fine while you're the only one touching the database while learning. It becomes dangerous the moment real application code connects, because any bug or vulnerability in that code (like SQL injection) doesn't just leak some data — it hands over the entire database.

**The fix:** create a separate, much weaker role specifically for the app:

```sql
CREATE ROLE bookeasy_app WITH LOGIN PASSWORD 'a_real_password';
```

A freshly created role like this starts with **zero** permissions on any table — not "read-only," literally nothing. Verified this directly: connecting as `bookeasy_app` and running

```sql
SELECT * FROM users;
```

fails with:

```
ERROR:  permission denied for table users
SQL state: 42501
```

(`42501` is Postgres's standard error code for "insufficient privilege" — worth recognizing that code specifically.)

---

## 2. GRANT

**What it is, in plain words:** `GRANT` gives a role permission to do one specific thing to one specific object. Nothing is implied — you list exactly the privileges you want to hand over.

```sql
GRANT privilege_name [, privilege_name ...] ON table_name TO role_name;
```

Common privilege names: `SELECT` (read), `INSERT` (create rows), `UPDATE` (edit rows), `DELETE` (remove rows).

**Worked example** — the app needs to read, create, and update users, but never delete them through normal app code:

```sql
GRANT SELECT, INSERT, UPDATE ON users TO bookeasy_app;
```

After this, `SELECT * FROM users;` as `bookeasy_app` succeeds. GRANT takes effect immediately — no reconnect or restart needed.

**The SERIAL/sequence gotcha:** a column like `users.id` defined as `SERIAL` isn't really one thing — it's an `INTEGER` column *plus* a separate hidden object called a **sequence**, which is a counter handing out the next id (1, 2, 3, ...). `GRANT INSERT ON users` only covers the table itself. If a fresh role tries to insert a row and the sequence hasn't separately had its usage granted, the insert can fail with something like:

```
ERROR:  permission denied for sequence users_id_seq
```

The fix, when this happens:

```sql
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO bookeasy_app;
```

**Worth remembering:** whenever you grant `INSERT` on a table that has a `SERIAL`/`GENERATED ALWAYS AS IDENTITY` primary key, check whether the sequence also needs its own grant — it's a separate object with separate permissions, not something bundled automatically into the table grant in every case.

---

## 3. REVOKE

**What it is, in plain words:** the exact mirror of `GRANT` — same object, same privilege names, opposite direction. Used any time you decide a role shouldn't be allowed to do something it currently can.

```sql
REVOKE privilege_name [, privilege_name ...] ON table_name FROM role_name;
```

**Worked example** — the app should be able to create new bookings, but shouldn't silently be able to rewrite an existing booking's date outside of some proper "reschedule" flow to be built later:

```sql
GRANT SELECT, INSERT, UPDATE ON bookings TO bookeasy_app;   -- start broad
REVOKE UPDATE ON bookings FROM bookeasy_app;                -- then pull back UPDATE
```

Verified: before the `REVOKE`, `UPDATE bookings SET booking_date = booking_date WHERE id = 1;` succeeded as `bookeasy_app`. After the `REVOKE`, the exact same statement failed with `permission denied for table bookings`. Like `GRANT`, this takes effect immediately, live — no need to drop and recreate the role, no downtime.

---

## 4. Checking what a role can actually do

Rather than relying on memory of every GRANT/REVOKE you've typed, you can ask Postgres directly:

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'bookeasy_app'
ORDER BY table_name, privilege_type;
```

(If working in a raw psql terminal instead of pgAdmin's Query Tool, `\dp table_name` does the same thing in a more compact form — but that's a psql-only shortcut and won't run inside pgAdmin's Query Tool box.)

This is the actual source of truth for "what can this role do" — always check it rather than trusting your own memory of past commands, especially once a role has had several rounds of GRANT and REVOKE applied.

---

## 5. Database-level permissions — CONNECT

**What it is, in plain words:** table-level permissions (Sections 2–3) answer "what can this role do *inside* a database it's already connected to." There's a layer above that: **can this role connect to the database at all?**

**The surprising default:** every database has a hidden pseudo-role called `PUBLIC`, meaning "everyone." By default, `CONNECT` on a newly created database is granted to `PUBLIC` — so *any* role on the server can connect to *any* database, unless this is explicitly locked down. Verified this directly: created a second, unrelated database, and `bookeasy_app` (a role that had never been granted anything on it) could still connect and run `SELECT 1;` successfully.

**The fix — two steps, always together:**

```sql
REVOKE CONNECT ON DATABASE bookeasy FROM PUBLIC;   -- close the door for everyone
GRANT CONNECT ON DATABASE bookeasy TO bookeasy_app; -- reopen it only for who needs it
```

**Why two steps and not one:** `PUBLIC` isn't a group that specific roles are separate from — it's the fallback bucket every role belongs to by default. So step 1 alone would lock out `bookeasy_app` too, until step 2 explicitly grants it back. Always run both together, in the same session, so you don't accidentally lock yourself out of a database you still need.

(`postgres`, being a superuser, bypasses all of this — superusers can always connect regardless of GRANT/REVOKE on `CONNECT`.)

**Why this matters in practice:** many real hosting setups run several projects' databases on one shared Postgres server. Without this REVOKE, a leaked password for *one* project's app role would expose every other database on that same server too — not just its own.

---

## 6. Least Privilege

**What it is, in plain words:** this isn't a SQL command — there's no `GRANT LEAST PRIVILEGE` statement. It's the *principle* behind every GRANT decision: give a role the minimum permissions it needs to do its actual job, and nothing more "just in case."

The common beginner mistake is the opposite: grant everything up front, restrict later if something breaks. That's backwards — it works fine until the day something does go wrong (a bug, a leaked credential, an injection flaw), at which point excess permissions turn a small incident into a catastrophic one.

**Where this was actually applied, concretely:**

- `venues` table: granted `SELECT` only, never `INSERT`/`UPDATE` — customers browse venues in the real app, they don't create them; only an admin process should add new venues.
- `bookings` table: granted `SELECT` + `INSERT`, then deliberately `REVOKE`d `UPDATE` — the app creates bookings but shouldn't silently be able to rewrite an existing one without a proper flow.
- Database `CONNECT`: revoked from `PUBLIC`, granted back only to `bookeasy_app` — don't leave every database reachable by every role "just in case."

**The test to apply before writing any GRANT:** *"Does this specific role need this specific permission, right now, for a feature that actually exists?"* "Might need it later" is not a reason to grant it now — it's much safer to add a permission later (instant, one line, no downtime, proven above with both GRANT and REVOKE) than to discover after a breach that access was handed out nobody was actually using.

---

## Summary — layers of permission control

| Layer | Question it answers | Command family |
|---|---|---|
| Database | Can this role connect to this database at all? | `GRANT/REVOKE CONNECT ON DATABASE ... [TO/FROM PUBLIC or role]` |
| Table | Can this role SELECT/INSERT/UPDATE/DELETE this table? | `GRANT/REVOKE privilege ON TABLE ... TO/FROM role` |
| Sequence | Can this role advance a SERIAL/IDENTITY counter? | `GRANT/REVOKE USAGE, SELECT ON SEQUENCE ... TO/FROM role` |
| (Policy, not a layer) | Least privilege | The judgment call behind every grant above |

**End state for `bookeasy_app`:** can connect to `bookeasy` only; SELECT/INSERT/UPDATE on `users`; SELECT/INSERT (no UPDATE) on `bookings`; SELECT on `venues` only; sequence usage granted where needed for inserts. This is the role the real Node app's `.env` should eventually use instead of `postgres`, so that even if something in the app goes wrong, the damage is capped by exactly this set of permissions.
