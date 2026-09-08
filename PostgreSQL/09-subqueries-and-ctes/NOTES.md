# 09 — Subqueries and CTEs 
**Project:** BookEasy — PostgreSQL + raw SQL (Phase 1, Module 4 of backend roadmap)
**Stage:** C — Relationships

---

## The Core Problem Both of These Solve

Some questions need **two steps**, where the second step depends on the answer to the first.

Example: *"Which venues cost more than the average venue price?"*

You cannot answer this in one plain `SELECT`, because you don't know what the average IS until you calculate it first. And you can't just drop the aggregate into `WHERE`:

```sql
SELECT name FROM venues WHERE price_per_day > AVG(price_per_day);
-- ERROR: aggregate functions are not allowed in WHERE
```

Same reason as the `HAVING` lesson: when `WHERE` runs, aggregation hasn't happened yet. But `HAVING` doesn't help here either — you're not filtering *groups*, you're comparing each row against a single number computed from the whole table.

**The solution: compute that number with a separate query, and feed it into the main query.** That embedded query is a **subquery**.

---

## Why Not Just Run Two Queries By Hand?

A fair question: why not run `SELECT AVG(...)`, read the number with your eyes, then type it into a second query? It works in `psql` — but it fails as real application code, for three reasons:

1. **Your Express app can't "read with its eyes."** It would need two round trips to the database (run query 1, extract the number in JS, build and send query 2) — slower, more code, more to break.

2. **Data changes between the two queries (the serious one).** You read the average as 58,700. In the milliseconds before query 2 runs, someone inserts an expensive venue — the real average is now higher. Query 2 is filtering against a stale number. A subquery computes both parts as one atomic operation, so this can't happen.

3. **Hardcoded numbers rot.** `WHERE price_per_day > 58700` is only correct for today's data. A subquery recalculates every time it runs — always correct, no maintenance.

**Proof (verified live):** started with avg = 58,700, and 4 venues above it. Inserted one venue at 500,000 (new real avg = 98,818). The hardcoded `> 58700` query then wrongly said **5** venues above average — with no error, silently lying. The subquery version recalculated and correctly said **2**. The hardcoded number became a silent bug the instant the data changed.

---

## SUBQUERIES

**Definition:** a complete `SELECT` statement written inside parentheses, placed inside another query. The inner query runs first, produces a result, and the outer query uses that result. The parentheses are mandatory — they tell Postgres "this is a self-contained query, run it separately."

There are **three shapes**, and which one you use is NOT a free style choice — **the question determines which shape is even possible.**

### Shape 1 — Subquery returns ONE value

Used with comparison operators: `>`, `<`, `=`, `>=`, `<=`. For "compare each row against a single computed value."

```sql
SELECT name, price_per_day
FROM venues
WHERE price_per_day > (SELECT AVG(price_per_day) FROM venues)
ORDER BY price_per_day DESC;
```
Postgres runs the inner query first (→ 58,700), then effectively rewrites the outer as `WHERE price_per_day > 58700`.

Another one-value example — the most expensive venue:
```sql
SELECT name, city, price_per_day
FROM venues
WHERE price_per_day = (SELECT MAX(price_per_day) FROM venues);
```
Note: this differs from `ORDER BY price_per_day DESC LIMIT 1` — if two venues *tied* for highest, `LIMIT 1` shows one arbitrarily, while this subquery shows BOTH tied rows.

**Rule:** the subquery must return exactly one row, one column. Multiple rows → Postgres doesn't know which to compare → error.

### Shape 2 — Subquery returns MANY values

Used with `IN` or `NOT IN`. For "check each row against a list."

Users who have never booked anything:
```sql
SELECT full_name, email
FROM users
WHERE id NOT IN (SELECT user_id FROM bookings)
ORDER BY full_name;
```
The inner query produces a list of user ids that appear in bookings; `NOT IN` keeps only users whose id isn't in that list. Cleanest way to express "find things with no related records."

### Shape 3 — Subquery in the FROM clause

Here the subquery produces a whole **temporary result table**, and the outer query treats it like a real table. For "filter or work with an already-grouped/aggregated result."

```sql
SELECT city, venue_count
FROM (
  SELECT city, COUNT(*) AS venue_count
  FROM venues
  GROUP BY city
) AS city_totals
WHERE venue_count > 1
ORDER BY venue_count DESC;
```
The inner query computes counts per city; the outer filters that result with a plain `WHERE venue_count > 1` — the alias works here because to the outer query, `city_totals` is just a table with a `venue_count` column.

**Requirement:** a subquery in `FROM` MUST be given an alias (`AS city_totals`). Postgres requires a name for it.

### Which shape to use — decided by the question, not by preference

| The question is... | Shape | Used with |
|---|---|---|
| Compare rows against ONE computed value | 1 | `>`, `<`, `=` in WHERE |
| Check rows against a LIST of values | 2 | `IN` / `NOT IN` in WHERE |
| Filter/work with a GROUPED or aggregated result | 3 (or `HAVING`) | subquery in FROM |

Important realization: a "filter grouped results" question (like cities with more than 1 venue) **cannot** be forced into Shape 1 or 2. Those shapes exist to compare individual rows against a value/list — not to filter aggregated groups. That kind of question needs Shape 3 or `HAVING`. The shape isn't chosen freely; the question dictates it.

---

## CTEs (Common Table Expressions)

**Full name:** Common Table Expression. Written with the `WITH` keyword.

**The problem it solves:** subqueries work, but they get unreadable fast. When logic needs 3+ steps, you end up with queries nested inside queries inside queries — you have to read inside-out, and the reading order fights the execution order. Hard to debug, hard to modify.

**What a CTE does:** takes that same inner query, moves it *above* the main query, gives it a name, and lets you reference it by name. Same result, but read top-to-bottom as a sequence of named steps.

### Syntax

```sql
WITH name_you_choose AS (
  ... a complete SELECT query ...
)
SELECT ... FROM name_you_choose ...;
```

The named block behaves like a real table for the duration of the query — it's temporary and disappears when the query finishes.

### Same logic, subquery vs CTE

Subquery (read inside-out — find the innermost part first):
```sql
SELECT city, venue_count
FROM (
  SELECT city, COUNT(*) AS venue_count
  FROM venues
  GROUP BY city
) AS city_totals
WHERE venue_count > 1;
```

CTE (read top-to-bottom, like a recipe):
```sql
WITH city_totals AS (
  SELECT city, COUNT(*) AS venue_count
  FROM venues
  GROUP BY city
)
SELECT city, venue_count
FROM city_totals
WHERE venue_count > 1;
```
In plain English: *"First, build a temporary result called city_totals with each city and its venue count. Then select from it, keeping only cities with more than one venue."*

### Where CTEs genuinely win — multiple chained steps

```sql
WITH venue_bookings AS (
  SELECT venue_id, COUNT(*) AS booking_count, SUM(total_price) AS revenue
  FROM bookings
  GROUP BY venue_id
),
venue_details AS (
  SELECT v.name, v.city, vb.booking_count, vb.revenue
  FROM venues v
  INNER JOIN venue_bookings vb ON v.id = vb.venue_id
)
SELECT name, city, booking_count, revenue
FROM venue_details
WHERE revenue > 50000
ORDER BY revenue DESC;
```

Three key mechanics:
1. **Multiple CTEs are separated by commas** — write `WITH` once, then each named block, comma between them. `WITH` does NOT repeat.
2. **Later CTEs can use earlier ones** — `venue_details` joins to `venue_bookings` by name, as if it were a real table. This chaining is the real power.
3. **Reads like a recipe:** "count bookings/revenue per venue → attach names and cities → show only those over 50,000, sorted."

The same logic as nested subqueries requires two levels of nested parentheses, with the first-executed part (the bookings aggregation) buried deepest in the middle — you read inward while it executes outward. CTEs keep it flat and in execution order.

### Is a CTE a different concept, or just a prettier subquery?

**Mostly the same concept with better readability** — that's the 90% answer. Identical results, often similar execution. The 10% where they genuinely differ:
- A CTE can be **referenced multiple times** in one query (a subquery would have to be rewritten each time).
- CTEs enable **recursion** — a query referring to itself, for tree/hierarchy data. (Phase 2/3 topic.)

For now: treat a CTE as "a subquery with a name and better readability."

### When does WHERE run in a CTE? (important)

Each CTE is its own independent query with its own execution order. So the `WHERE`-runs-before-`GROUP BY` rule applies *separately inside each block*.

But the crucial insight: by the time the FINAL query's `WHERE` runs, the CTEs have **already finished** producing their results. So a column like `revenue` — which was computed by aggregation *inside* a CTE — already exists as a plain, finished column by the final step.

**This is a hidden superpower of CTEs:** you can use a simple `WHERE` on an aggregate result, because the aggregation completed in an earlier step. No `HAVING` gymnastics needed. (Confirmed in practice — a plain `WHERE customer_total_spend > 10000` worked on the final query because the CTE had already computed that sum.)

---

## COUNT(*) vs COUNT(column) — Solid Anchor

The rule:
- `COUNT(*)` = "how many ROWS" (counts every row, including ones with NULLs)
- `COUNT(column)` = "how many rows have a REAL VALUE in this column" (skips NULLs)

They only differ when NULLs can appear — and the classic case is **LEFT JOIN**.

```sql
SELECT v.name,
       COUNT(*) AS count_star,
       COUNT(b.id) AS count_bookingid
FROM venues v
LEFT JOIN bookings b ON v.id = b.venue_id
GROUP BY v.name;
```
For a venue with ZERO bookings (e.g. Riverside Lawn):
- `COUNT(*)` = **1** — WRONG. The LEFT JOIN made one row for it (booking columns all NULL), and `COUNT(*)` counts that row.
- `COUNT(b.id)` = **0** — CORRECT. `b.id` is NULL, and `COUNT(column)` skips NULLs.

**Rule to lock in:** whenever you `LEFT JOIN` and count the "many" side, use `COUNT(joined_table.column)`, never `COUNT(*)` — otherwise rows with zero matches wrongly show 1 instead of 0. With `INNER JOIN` (no NULLs) or a single table, `COUNT(*)` is fine and simpler.

**Memory hook:** `COUNT(*)` counts rows; `COUNT(column)` counts real values. The moment a LEFT JOIN can create empty (NULL) rows, the two disagree — and counting real values is almost always what you want.

---

## Mental Model Shift Worth Recording

A key realization from this stretch of learning: **stop computing the join in your head.**

The instinct (coming from JavaScript, which is imperative) was to mentally trace *how* the price gets pulled from one table and matched to the quantity in another — walking rows and matching them step by step. That's the database's job, not yours.

SQL is **declarative**: you describe *what* you want and *how the tables relate* (via foreign keys), and Postgres figures out the *how* — which table to scan first, how to match, how to combine efficiently.

**The rule for myself:** "I don't compute the join. I declare the relationship and describe the result. Postgres computes the join."

The four-table query that was hard earlier became easy not from getting better at mechanics, but from *stopping* thinking about mechanics — just reading foreign keys off the schema and stating the desired result.

---

## Module 7.5 — Complete

Subqueries (all three shapes, with the rule that the question dictates the shape), CTEs (single and chained, with the `WITH` syntax and the hidden `WHERE`-on-aggregate advantage), and a solid anchor for `COUNT(*)` vs `COUNT(column)`. Two practice tasks completed independently with no hints, including a four-table CTE with correct id+name grouping.

---

## Next Up
**Module 8 — Data Integrity Deep-Dive**: `UNIQUE`, `CHECK`, foreign-key actions (`ON DELETE CASCADE` / `SET NULL` / `RESTRICT`), and composite keys in practice. Several pieces already seen live in earlier modules — Module 8 consolidates them and adds the foreign-key actions not yet tried.