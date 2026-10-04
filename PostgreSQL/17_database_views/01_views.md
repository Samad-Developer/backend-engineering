# Module 17 — Database Views

Notes on saving queries as reusable named objects, their limits, when to use them, and the performance-focused variant (materialized views).

---

## 1. The problem, before any syntax

Imagine three different places in `bookeasy` need the same "venue with its booking count" shape — a dashboard, a report, an admin screen. Without views, you'd either copy-paste the same JOIN+GROUP BY query everywhere, or wrap it in an app-code function. Both are fragile: if the logic needs to change later (e.g. excluding cancelled bookings from the count), you have to find and fix every copy.

**A view saves a query under a name**, so the logic lives in exactly one place, and everywhere else just does `SELECT * FROM that_name`.

---

## 2. What a view is

A **view** is a stored query with a name. It holds no data of its own — every time you query it, Postgres re-runs the underlying query fresh, against the real tables, right then. It's a saved, reusable `SELECT` wearing a table's clothing.

This means a view is always **live** — if the real tables change the instant after you query the view, the next query against the view reflects that immediately, because there's no stored copy to go stale.

---

## 3. CREATE VIEW and querying it

```sql
CREATE VIEW venue_booking_summary AS
SELECT v.id, v.name, v.city, COUNT(b.id) AS total_bookings
FROM venues v
LEFT JOIN bookings b ON b.venue_id = v.id
GROUP BY v.id, v.name, v.city;
```

Once created, query it exactly like a table — including filtering, sorting, whatever:

```sql
SELECT * FROM venue_booking_summary;
SELECT * FROM venue_booking_summary WHERE total_bookings > 0;
```

---

## 4. View vs CTE — a question worth being precise about

Both give a name to an intermediate result and make complex queries more readable. The real difference is **lifetime and reuse scope**, not readability:

- **CTE** (`WITH name AS (...)`) exists only for the one query it's written inside. The moment that statement finishes, it's gone — referencing it from a different query, or a new session, fails with `relation "name" does not exist`.
- **View** is a permanent schema object, saved once with `CREATE VIEW`, reusable forever by any query, any session, any user, any app connection, without ever re-typing the underlying logic.

Rule of thumb: CTE = "I need this named result just for the query I'm writing right now." View = "I need this repeatedly, from many places, possibly forever." Also, because a view is a real schema object, you can `GRANT`/`REVOKE` permissions directly on it (same as a table) — something that makes no sense for a CTE, since it never outlives its own query.

---

## 5. View limitations — can you write through a view?

**Short answer:** for a view built from a JOIN, `GROUP BY`, an aggregate function (`COUNT`/`SUM`/`AVG`/etc.), `DISTINCT`, or `UNION` — no, you cannot `INSERT`, `UPDATE`, or `DELETE` through it at all. Only `SELECT` works. A view built from a plain `SELECT columns FROM one_table WHERE ...` (no JOIN, no aggregate) is usually still writable.

**Why, mechanically — this is the part that isn't obvious.** A view has no storage of its own. When you write through a *simple* writable view, Postgres doesn't insert "into the view" in any literal sense — it quietly **rewrites your statement into the equivalent operation on the real underlying table**, because for a simple one-table view it can figure out exactly which real row that corresponds to.

Verified directly: created `cheap_venues AS SELECT id, name, city, price_per_day FROM venues WHERE price_per_day < 50000`, then ran:

```sql
INSERT INTO cheap_venues (name, city, price_per_day) VALUES ('Test Via View', 'Multan', 20000);
```

This succeeded (`INSERT 0 1`), and checking the real `venues` table directly afterward showed the new row sitting there with a real `id` assigned by `venues`' own sequence — proof that Postgres translated the statement into `INSERT INTO venues (...)` behind the scenes. Nothing was ever "inserted into the view's result"; the view was just the named filter Postgres used to identify which real table and mapping to use.

**Why this breaks for a complex view.** Tried the same thing against `venue_booking_summary` (JOIN + `GROUP BY` + `COUNT`):

```sql
INSERT INTO venue_booking_summary (id, name, city, total_bookings)
VALUES (999, 'Fake Venue', 'Nowhere', 0);
```

Result:
```
ERROR:  cannot insert into view "venue_booking_summary"
DETAIL:  Views containing GROUP BY are not automatically updatable.
HINT:  To enable inserting into the view, provide an INSTEAD OF INSERT trigger or an unconditional ON INSERT DO INSTEAD rule.
```

The reason: `total_bookings` isn't a real stored column anywhere — it's a number *computed* by `COUNT()` fresh each time, with no real place to write a value back into. And since the view joins two tables, there's no unambiguous single table/row for a new row to belong to. Postgres refuses rather than guess.

The HINT mentions `INSTEAD OF INSERT` triggers — a way to manually teach Postgres what a write through a complex view should actually do. Genuinely advanced, rarely needed, not something to build now — just worth knowing "not automatically updatable" doesn't mean "impossible," only "not without extra custom work."

| View is built from... | Writable? | Why |
|---|---|---|
| `SELECT columns FROM one_table WHERE ...` | Usually yes, automatically | Unambiguous: one row in, one real row out |
| JOIN across multiple tables | No (by default) | Ambiguous which table a write should touch |
| `GROUP BY` / aggregates (`COUNT`, `SUM`, ...) | No | Computed columns have no real storage to write into |
| `DISTINCT`, `UNION`, `LIMIT` | No | Same root issue |

---

## 6. When views are useful

**1. Hiding complexity behind a simple name.** Wrap a reused JOIN/GROUP BY query once; every place that needs it just does `SELECT * FROM view_name`. Change the logic once, in the view's definition, and every caller picks up the fix automatically.

**2. A safer slice of sensitive data, without touching table-level GRANT.** `GRANT` (Module 16) only works at the table or column level. A view can combine and expose only specific columns across a JOIN, then you `GRANT SELECT` on the *view* instead of the raw tables:

```sql
CREATE VIEW public_venue_listings AS
SELECT v.id, v.name, v.city, v.price_per_day, u.full_name AS owner_name
FROM venues v
JOIN users u ON v.owner_id = u.id;
```

A role granted `SELECT` only on `public_venue_listings` can never see `users.email` directly, even though the view's own query touches `users` internally — it only ever sees the columns the view's definition exposes.

**3. Making reporting/analytics queries readable.** A gnarly multi-join, multi-subquery report query, saved once under a clear name like `monthly_revenue_by_city`, is far easier to trust and reuse than re-deriving the same logic from scratch inside a script.

**The common thread:** views are a readability/reuse tool, and in the "safer slice" case, a mild access-control tool — **never a performance tool.** Every `SELECT` from a view re-runs the full underlying query live. A view over an expensive query is exactly as slow, every time, as running that raw query directly — convenience, not speed.

---

## 7. Materialized views — awareness

A **materialized view** closes the performance gap above by actually **storing** its result, like a snapshot, instead of recomputing it every query.

```sql
CREATE MATERIALIZED VIEW venue_booking_summary_fast AS
SELECT v.id, v.name, v.city, COUNT(b.id) AS total_bookings
FROM venues v
LEFT JOIN bookings b ON b.venue_id = v.id
GROUP BY v.id, v.name, v.city;
```

Same syntax as `CREATE VIEW` plus the word `MATERIALIZED`, but the behavior is different: Postgres runs the query once, right then, and physically stores the result on disk — the same way a table's rows are stored. From then on, `SELECT * FROM venue_booking_summary_fast` just reads that stored snapshot directly: fast, no JOIN/COUNT recomputation.

**The trade-off:** that stored snapshot goes **stale**. A new booking added a minute later won't show up in the materialized view's results — unlike a regular view (which would reflect it instantly), the materialized view has no idea anything changed, because it stopped running its query live the moment it was created.

---

## 8. Refreshing materialized views

Catching the snapshot back up to current data is manual (or scheduled):

```sql
REFRESH MATERIALIZED VIEW venue_booking_summary_fast;
```

This re-runs the underlying query from scratch and replaces the stored snapshot. Until this runs, data stays frozen at whenever it was last refreshed (or created).

**When this trade-off makes sense:** a materialized view fits expensive queries that don't need to be perfectly up-to-the-second — e.g. "total revenue per city, last 30 days" on an admin dashboard, refreshed nightly or hourly. It's the wrong choice for anything that needs to reflect a change the instant it happens — like a live "bookings remaining" counter a customer is actively watching.

**Caveat worth knowing (not building yet):** by default, `REFRESH MATERIALIZED VIEW` locks the view for reads while refreshing — anyone querying it during that moment waits. `REFRESH MATERIALIZED VIEW CONCURRENTLY` avoids that lock but requires a unique index on the materialized view first, and is more advanced setup for later.

---

## Summary — regular view vs materialized view

| | Regular view | Materialized view |
|---|---|---|
| Stores data? | No — just a saved query | Yes — a real stored snapshot |
| Always up to date? | Yes, re-runs live every time | No — stale until refreshed |
| Speed on expensive queries | Same as running the raw query | Fast — reads stored rows |
| How to update | Nothing to do — automatic | `REFRESH MATERIALIZED VIEW name;` |
| Writable (INSERT/UPDATE/DELETE)? | Only if built from a plain single-table SELECT | No — always read-only |
