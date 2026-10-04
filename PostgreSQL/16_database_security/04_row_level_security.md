# Module 16 — Row-Level Security (RLS)

Notes on the last piece of PostgreSQL Security: making the database itself guarantee that one user/tenant can never see or touch another's rows — even if the application code forgets to filter.

---

## 1. The problem this exists to solve (before any syntax)

Everything else in Module 16 (roles, GRANT/REVOKE, least privilege) controls access at the **whole table** level — "can this role see `bookings` at all, yes or no." That's not fine-grained enough for a real app. In `bookeasy`, a venue owner should see bookings for *their own* venues only, not every booking on the platform. `GRANT SELECT ON bookings` can't express that distinction — it's all-or-nothing.

The obvious fix is filtering in application code:

```js
app.get('/my-venue-bookings', async (req, res) => {
  const ownerId = req.user.id;
  const result = await pool.query(
    `SELECT b.* FROM bookings b
     JOIN venues v ON b.venue_id = v.id
     WHERE v.owner_id = $1`,
    [ownerId]
  );
  res.json(result.rows);
});
```

This works — **until someone forgets.** Picture a second route added months later, in a rush:

```js
// added later, filter forgotten — no error, no crash, just wrong
app.get('/export-bookings', async (req, res) => {
  const result = await pool.query('SELECT * FROM bookings'); // no WHERE at all
  res.send(convertToCSV(result.rows));
});
```

Nothing throws an exception. It just quietly leaks every venue owner's bookings to whoever hits that endpoint — a perfectly valid query from the database's point of view, just a mistake no error message will ever flag. **App-level filtering is only as safe as "every query, written by every developer, forever, remembers the right WHERE clause."** One missed route breaks it for everyone, and the mistake is usually only discovered when someone notices they can see data that isn't theirs.

**Row-Level Security (RLS) moves this guarantee into the database itself**, so even a query that forgot the filter still can't see rows it shouldn't — the database refuses to hand over disallowed rows, no matter how the SQL was written or who wrote it.

**Why this doesn't replace app-level filtering:** you keep both. App-level filters give better error messages and better performance. RLS is the backstop for the mistake app code can't protect against — the mistake of a filter simply not being written yet.

---

## 2. RLS concept

RLS is a Postgres feature that attaches a filtering rule directly to a table. Once enabled, Postgres automatically applies that rule to every query against the table — like a `WHERE` clause you never wrote, applied every time, impossible to forget.

It's "row-level" because it governs individual rows, layered on top of what GRANT already governs at the table level:

- `GRANT SELECT ON bookings TO bookeasy_app` → table-level: can this role see this table at all?
- RLS → row-level: given it *can* see the table, which specific rows is it actually allowed to see?

**Turning it on:**

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
```

**Critical behavior, verified hands-on:** the moment RLS is enabled with zero policies defined, the default is **deny everything** — not "no filtering," but "show zero rows" — for every role except the table owner and superusers. Confirmed directly: `bookeasy_app` still had `SELECT` granted, but `SELECT * FROM bookings;` returned an empty result, not an error.

This same default-deny applies **per operation**, not just "per table with no policies at all." A policy written `FOR SELECT` only governs `SELECT` — `INSERT`/`UPDATE`/`DELETE` with no matching policy are still denied by default, exactly as if no policy existed for that operation. Verified: with only a `SELECT` policy in place, an `INSERT` still failed with `new row violates row-level security policy` — not because of that policy's condition, but because no policy at all applied to `INSERT`.

---

## 3. Policies

A **policy** is the named rule that says "actually, allow rows matching *this*."

```sql
CREATE POLICY policy_name
ON table_name
FOR operation
USING (condition);
```

- `policy_name` — a label you choose, for reference only.
- `ON table_name` — which table.
- `FOR operation` — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `ALL`. Each operation needs its own policy (or an `ALL` policy) — they don't share automatically.
- `USING (condition)` — the filter itself, a SQL boolean expression, same kind of thing as a `WHERE` clause.

---

## 4. The missing piece: how does Postgres know who's asking?

This is a genuinely new concept, not just syntax. Your whole Node app connects as **one single database role**, `bookeasy_app`, for every end user. Postgres has no built-in idea of "this particular request is on behalf of user 7" — every query from the app looks identical at the role level.

**Solution: a custom session variable.** The app tells Postgres, at the start of handling a request, "for this one connection, remember this value" — the policy then reads that value back.

```sql
SET app.current_user_id = '7';
```

Breaking it down:
- `SET` — sets a configuration value for the current connection only; lives in memory, temporary, not written to any table.
- `app.current_user_id` — the setting's name. `app.` is not special Postgres syntax — it's a convention: custom settings must be dot-namespaced (`something.somethingelse`) so they can't collide with Postgres's own built-in settings. Any name like this works; `app.current_user_id` is simply what we picked.
- `'7'` — the value, always passed as text in `SET`, even for something conceptually numeric.

Reading it back:

```sql
SELECT current_setting('app.current_user_id');
```

`current_setting(...)` always returns **text**. Since policy conditions usually compare against an integer column, a cast is needed:

```sql
current_setting('app.current_user_id')::int
```

`::int` is Postgres's cast syntax — "convert the value on the left into this type." So this reads: "get the setting's text value, convert it to an integer, so it can be compared against an integer column."

---

## 5. A full worked example — the `notes` practice table

Built and verified hands-on with two pgAdmin tabs: one connected as `postgres`, one as `bookeasy_app`.

**Step 1 — create a simple table (as `postgres`):**

```sql
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  content TEXT NOT NULL
);
```

**Step 2 — seed rows for two different owners (as `postgres`):**

```sql
INSERT INTO notes (owner_id, content) VALUES
  (7, 'Note belonging to user 7 - first'),
  (7, 'Note belonging to user 7 - second'),
  (8, 'Note belonging to user 8 - first');
```

**Step 3 — grant table + sequence access to the app role (as `postgres`):**

```sql
GRANT SELECT, INSERT, UPDATE ON notes TO bookeasy_app;
GRANT USAGE, SELECT ON SEQUENCE notes_id_seq TO bookeasy_app;
```

Confirmed: as `bookeasy_app`, `SELECT * FROM notes;` returns all 3 rows (no RLS yet).

**Step 4 — enable RLS (as `postgres`):**

```sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
```

Confirmed: same `SELECT * FROM notes;` as `bookeasy_app` now returns **zero rows** — default-deny, no policy yet.

**Step 5 — SELECT policy with USING (as `postgres`):**

```sql
CREATE POLICY notes_select_own
ON notes
FOR SELECT
USING (owner_id = current_setting('app.current_user_id')::int);
```

Confirmed:
```sql
SET app.current_user_id = '7';
SELECT * FROM notes;   -- returns only the 2 rows for owner_id = 7

SET app.current_user_id = '8';
SELECT * FROM notes;   -- returns only the 1 row for owner_id = 8
```

**Step 6 — proving USING alone doesn't cover INSERT.** With only the `SELECT` policy in place, as `bookeasy_app` (session var = `'7'`):

```sql
INSERT INTO notes (owner_id, content) VALUES (8, 'Sneaky note pretending to belong to user 8');
```

Result: `ERROR: new row violates row-level security policy for table "notes"`. Not because the condition was checked and failed — because **no policy at all applies to INSERT** yet, so it's denied by the same default-deny rule as an un-policied table.

**Step 7 — INSERT policy with WITH CHECK (as `postgres`):**

```sql
CREATE POLICY notes_insert_own
ON notes
FOR INSERT
WITH CHECK (owner_id = current_setting('app.current_user_id')::int);
```

Tested as `bookeasy_app` (session var = `'7'`):
```sql
INSERT INTO notes (owner_id, content) VALUES (7, 'A real note from user 7');
-- succeeds: new row's owner_id matches the session variable

INSERT INTO notes (owner_id, content) VALUES (8, 'Sneaky note pretending to belong to user 8');
-- fails: WITH CHECK rejects it — now specifically because the condition fails, not because no policy applies
```

**Step 8 — UPDATE: where USING and WITH CHECK do genuinely different jobs.**

```sql
CREATE POLICY notes_update_own
ON notes
FOR UPDATE
USING (owner_id = current_setting('app.current_user_id')::int)
WITH CHECK (owner_id = current_setting('app.current_user_id')::int);
```

For `UPDATE`, Postgres checks both, at two different moments:
- `USING` → checked against the **existing row** first: "is this row even in the set I'm allowed to update?"
- `WITH CHECK` → checked against the **resulting row** after the `SET` clause: "is what I'm trying to save still allowed?"

Three tests (as `bookeasy_app`, session var = `'7'`):

```sql
-- Test A: update a row you own, normally
UPDATE notes SET content = 'Updated by its real owner'
WHERE owner_id = 7 AND content = 'A real note from user 7';
-- succeeds: USING passes (owner_id matches), WITH CHECK passes (still owner_id 7)

-- Test B: try to touch a row that isn't yours
UPDATE notes SET content = 'Trying to edit someone elses note' WHERE owner_id = 8;
-- "UPDATE 0" — not an error. USING filters the row out before the update can even begin;
-- it's invisible, same as it is to SELECT.

-- Test C: try to "steal" your own row by reassigning its owner
UPDATE notes SET owner_id = 8
WHERE owner_id = 7 AND content = 'Updated by its real owner';
-- fails with the RLS violation error. USING allows starting the update
-- (the existing row's owner_id = 7 matches), but WITH CHECK rejects the
-- result (the new row would have owner_id = 8, which fails the check).
```

Test C is the cleanest proof that the two clauses are genuinely separate checks: one governs which existing rows you may begin touching, the other governs whether the row you end up with is still allowed.

---

## 6. Multi-tenant data isolation

**What "tenant" means:** borrowed from real estate — many tenants share one building (same app, same database) but each tenant's own space (their own rows) should stay private from the others, even though everything lives in the same structure.

**In `bookeasy`:** every venue owner is a tenant. They all share the same Node app, the same `bookeasy` database, the same `venues`/`bookings` tables — distinguished only by `owner_id`. That's multi-tenancy, as opposed to giving every venue owner a fully separate, isolated database (simpler to secure, but far more expensive to run at scale).

**Why it's filed under Security:** multi-tenancy itself is a business/scaling decision, not a security feature. But choosing it *creates* a security obligation: once many tenants' rows sit in the same tables, the whole job becomes making sure tenant A's queries can never return or modify tenant B's rows. That guarantee is **multi-tenant data isolation** — and RLS (policies + `USING` + `WITH CHECK` + the session-variable pattern) is the concrete mechanism that delivers it. It isn't a separate fourth concept — it's the name for the outcome once RLS is set up correctly on tables holding multiple tenants' data.

**Worth knowing for later:** the session-variable approach here is one common pattern (and is literally how Supabase implements its own RLS product). At larger scale, some teams instead give each tenant a separate Postgres *schema*, or even a separate database per large tenant, trading simplicity for stronger physical separation — a scaling decision for well beyond where `bookeasy` is now.

---

## Summary table

| Concept | What it is | Where it lives |
|---|---|---|
| RLS (concept) | Table-level switch making Postgres filter rows automatically | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| Policy | A named rule attached to a table, for a specific operation | `CREATE POLICY name ON table FOR op ...` |
| `USING` | Filters which existing rows can be read/touched | Inside `CREATE POLICY ... USING (...)` |
| `WITH CHECK` | Validates new/changed row data on INSERT/UPDATE | Inside `CREATE POLICY ... WITH CHECK (...)` |
| Session variable | Per-connection "who's asking" value the app sets each request | `SET app.xxx = $1`, read via `current_setting('app.xxx')` |
| Multi-tenant isolation | The guarantee that sharing one database doesn't mean sharing data | The outcome of RLS + policies set up correctly |

---

## Running this from Node/Express

The session variable only exists for the lifetime of one specific connection — so `SET` and the query that depends on it must run on the *same* connection. Plain `pool.query()` grabs any available connection each time, with no guarantee it's the same one twice. This requires the `pool.connect()` / `client.query()` / `client.release()` pattern from the transactions lesson:

```js
app.get('/my-venue-bookings', async (req, res) => {
  const ownerId = req.user.id;
  const client = await pool.connect(); // check out ONE specific connection
  try {
    // SET must run on the same connection as the query below
    await client.query('SET app.current_user_id = $1', [String(ownerId)]);
    const result = await client.query('SELECT * FROM bookings');
    res.json(result.rows);
  } finally {
    client.release(); // always release, even on error
  }
});
```

Note `SET` itself is safely parameterized with `$1` — no string concatenation needed even here. Because connections are reused across different requests, always `SET` this value fresh at the top of every request that needs it — never assume a reused connection "remembers" the right user from a previous request.
