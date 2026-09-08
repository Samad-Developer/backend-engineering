# 08 — Aggregation and Grouping
**Project:** BookEasy — PostgreSQL + raw SQL (Phase 1, Module 4 of backend roadmap)
**Stage:** C — Relationships

---

## The Problem Aggregation Solves

Without it, answering "how many bookings does each venue have?" means pulling every row into Node and looping in JavaScript. Fine for 7 rows, impossible at 700,000.

**Aggregation makes the database do the counting/summing and return just the answer**, not the raw rows.

---

## The Five Main Aggregate Functions

| Function | What it does |
|---|---|
| `COUNT()` | How many |
| `SUM()` | Add values together |
| `AVG()` | Average of values |
| `MIN()` | Smallest value |
| `MAX()` | Largest value |

(Postgres has more — `STRING_AGG`, `ARRAY_AGG`, `STDDEV`, `VARIANCE` — but these five cover the vast majority of backend work.)

**Every aggregate takes MANY rows and collapses them into ONE value.**

```sql
SELECT COUNT(*) FROM bookings;                              -- 7
SELECT COUNT(*) FROM venues WHERE city = 'Lahore';          -- 2 (respects WHERE)
SELECT SUM(total_price) FROM bookings;                      -- 450000.00
SELECT AVG(price_per_day) FROM venues;                      -- 58700.000000000000
SELECT MIN(price_per_day), MAX(price_per_day) FROM venues;  -- 30000.00 | 120000.00
```

Multiple aggregates in one query, with aliases and rounding:
```sql
SELECT
  COUNT(*) AS total_venues,
  MIN(price_per_day) AS cheapest,
  MAX(price_per_day) AS most_expensive,
  ROUND(AVG(price_per_day), 2) AS average_price
FROM venues;
```
```
 total_venues | cheapest | most_expensive | average_price
--------------+----------+----------------+---------------
           10 | 30000.00 |      120000.00 |      58700.00
```
`ROUND(value, 2)` trims AVG's long decimal tail — AVG returns full precision by default.

**Aggregates do NOT require `GROUP BY`.** Without it, the whole table is treated as one single group, returning one row.

---

## What Goes Inside the Parentheses

**A column name** — the column whose values to operate on: `SUM(total_price)`, `AVG(price_per_day)`.

**`COUNT` is the special case, with two forms:**
- `COUNT(*)` — counts ROWS, period
- `COUNT(column)` — counts only rows where that column **is not NULL**

Verified with a demo table containing 5 rows, 2 with NULL nicknames:
```
 all_rows | non_null_nicknames
----------+--------------------
        5 |                  3
```

**All other aggregates also ignore NULLs automatically.** `AVG` of `[10, NULL, 20]` = 15, not 10 — it divides by 2 (the non-null count), not 3.

### Why this matters in practice — LEFT JOIN + COUNT

With `LEFT JOIN`, a customer with zero orders still produces one row (with NULL order columns):
- `COUNT(*)` counts that row → wrongly says **1**
- `COUNT(orders.id)` sees NULL → correctly says **0**

```sql
SELECT customers.name, COUNT(orders.id) AS order_count
FROM customers
LEFT JOIN orders ON customers.id = orders.customer_id
GROUP BY customers.name
ORDER BY order_count DESC;
```
Hira Shah (no orders) correctly shows `0`. With `COUNT(*)` she'd wrongly show `1`.

With `INNER JOIN`, `COUNT(*)` and `COUNT(column)` behave identically — the distinction only matters when NULLs can appear.

---

## GROUP BY

**The problem:** `SELECT COUNT(*) FROM bookings` gives one total for the whole table. Usually you want a breakdown — per venue, per city, per customer.

**`GROUP BY` splits rows into groups, then runs the aggregate separately on each group.**

```sql
SELECT venue_id, COUNT(*) AS booking_count
FROM bookings
GROUP BY venue_id
ORDER BY venue_id;
```
```
 venue_id | booking_count
----------+---------------
        1 |             2
        2 |             1
        3 |             1
        5 |             2
        6 |             1
```

Combined with a JOIN for readable names:
```sql
SELECT venues.name, COUNT(*) AS booking_count
FROM bookings
JOIN venues ON bookings.venue_id = venues.id
GROUP BY venues.name
ORDER BY booking_count DESC;
```

Multiple aggregates per group:
```sql
SELECT city, COUNT(*) AS venue_count, ROUND(AVG(price_per_day), 2) AS avg_price
FROM venues
GROUP BY city
ORDER BY venue_count DESC;
```

### The rule that trips everyone up

**Every column in `SELECT` must either be inside an aggregate function, or listed in `GROUP BY`.** Nothing else is allowed.

```sql
SELECT city, name, COUNT(*) FROM venues GROUP BY city;
-- ERROR: column "venues.name" must appear in the GROUP BY clause or be used in an aggregate function
```

**Why, logically:** grouping by `city` makes Lahore ONE group containing 2 venues. Asking for `name` gives Postgres two possible answers but only one row to display — it can't choose, so it errors rather than guessing. `COUNT(*)` works because it collapses to one number; `city` works because it's identical across the group; `name` differs within the group.

**This rule applies ONLY when using `GROUP BY` or an aggregate.** A plain `SELECT city, name FROM venues` has no such restriction.

**To display both:** add `name` to the `GROUP BY` too — `GROUP BY city, name`. This groups by the *combination*, producing smaller/more specific groups.

### Reaching data two tables away

Confusion resolved: `bookings` has no `city` column — only `venue_id`. So how can you group bookings by city? The connection is two hops: `bookings.venue_id → venues.id → venues.city`.

**The JOIN runs FIRST, building a combined table; GROUP BY runs AFTER, on that combined result.** After joining, every booking row effectively "has" a city borrowed from its venue — and that's what GROUP BY operates on. You're never grouping bookings by city directly; you're grouping *joined booking+venue rows*.

---

## HAVING

**The problem:** `WHERE` can't filter on aggregate results:
```sql
SELECT city, COUNT(*) FROM customers WHERE COUNT(*) > 1 GROUP BY city;
-- ERROR: aggregate functions are not allowed in WHERE
```
When `WHERE` runs, grouping hasn't happened yet — the counts don't exist.

**`HAVING` filters GROUPS, after aggregation is calculated:**
```sql
SELECT city, COUNT(*) AS customer_count
FROM customers
GROUP BY city
HAVING COUNT(*) > 1
ORDER BY customer_count DESC;
```
```
  city   | customer_count
---------+----------------
 Lahore  |              3
 Karachi |              2
```
Islamabad (1 customer) filtered out — not for anything about its rows, but because its *group total* didn't meet the condition.

### WHERE and HAVING together — different jobs, they coexist

```sql
SELECT products_shop.category, SUM(order_items.quantity) AS total_qty
FROM products_shop
INNER JOIN order_items ON products_shop.id = order_items.product_id
WHERE products_shop.price > 400
GROUP BY products_shop.category
HAVING SUM(order_items.quantity) > 5;
```
- `WHERE price > 400` → drops cheap individual products BEFORE grouping
- `HAVING SUM(quantity) > 5` → drops entire categories with low totals AFTER grouping

### Execution order — the key to understanding all of this

```
FROM / JOIN   →  gather and combine rows
WHERE         →  filter individual rows
GROUP BY      →  bundle surviving rows into groups
HAVING        →  filter the groups
SELECT        →  pick what to display
ORDER BY      →  sort the final result
```

**Practical consequence discovered by hitting the error:** `HAVING total_revenue > 10000` (using a SELECT alias) FAILS, but `ORDER BY total_revenue DESC` works. Reason: `HAVING` runs BEFORE `SELECT`, so the alias doesn't exist yet. `ORDER BY` runs AFTER `SELECT`, so it does. Must repeat the full `SUM(...)` expression in `HAVING`.

**When to use which:** filter on a raw column value → `WHERE`. Filter on a computed group total → `HAVING`.

---

## Method: Building Multi-Table JOIN Chains

This was the biggest sticking point of the module. The systematic approach:

### Step 1 — The question decides WHICH tables
List what data you need; each piece lives in a specific table. **Any column you reference anywhere** — SELECT, WHERE, GROUP BY, ON, ORDER BY, or inside an aggregate — brings its table into play.

Important: a column doesn't need to be in `SELECT` to require its table. In the August task, `orders.order_date` appeared only in `WHERE`, yet `orders` was mandatory.

**Bridge tables:** sometimes a table is needed purely to connect two others, even if none of its columns are used. `customers` and `order_items` share no direct link — the only path runs through `orders`.

### Step 2 — The schema decides HOW they connect
Foreign keys are fixed facts, not choices. Read them with `\d tablename`:
- "Foreign-key constraints" — which columns in THIS table point elsewhere
- "Referenced by" — which other tables point AT this one

### Step 3 — Grouping decides WHERE to start
Start `FROM` the table holding what you're grouping by. Then chain each JOIN so it **always connects to a table already in the query** — you can't join `products_shop` before `order_items` is present, since nothing else touches it.

### Practice schema used
```
customers ──< orders ──< order_items >── products_shop
```
| Link | ON clause |
|---|---|
| customers ↔ orders | `customers.id = orders.customer_id` |
| orders ↔ order_items | `orders.id = order_items.order_id` |
| order_items ↔ products_shop | `order_items.product_id = products_shop.id` |

**Number of JOINs = number of tables − 1.**

### Proof the method works
- "Revenue per category" → needed only **2 tables** (category and price both in `products_shop`, quantity in `order_items`; `customers` and `orders` add nothing)
- "August revenue per city" → needed **all 4** (city from `customers`, date filter from `orders`, quantity from `order_items`, price from `products_shop`)

Same schema both times — the *question* is what changed the answer.

---

## COUNT(DISTINCT column)

Counts unique values only, ignoring repeats:
```sql
COUNT(DISTINCT customers.id)
```
Necessary when joins duplicate rows — Karachi has 2 customers, but Fatima appears across multiple item rows. Without `DISTINCT` she'd be counted repeatedly and inflate the number. Use `customers.id` not `customers.name`, since ids are guaranteed unique while names theoretically aren't.

---

## Capstone Query Written Independently

Four tables, three aggregates (one with `DISTINCT`, one with inline multiplication), date filter, grouping, group-level filtering, and sorting:

```sql
SELECT
  customers.city,
  SUM(products_shop.price * order_items.quantity) AS total_revenue,
  COUNT(DISTINCT customers.id) AS distinct_customers
FROM customers
INNER JOIN orders ON customers.id = orders.customer_id
INNER JOIN order_items ON orders.id = order_items.order_id
INNER JOIN products_shop ON order_items.product_id = products_shop.id
WHERE orders.order_date BETWEEN '2026-08-01' AND '2026-08-31'
GROUP BY customers.city
HAVING COUNT(DISTINCT customers.id) > 1
ORDER BY total_revenue DESC;
```
```
  city   | total_revenue | distinct_customers
---------+---------------+--------------------
 Karachi |      26200.00 |                  2
 Lahore  |      10350.00 |                  2
```

Real insight from the data: Lahore sold far more *items* (19) but generated the *least* revenue — cheap stationery bulk orders — while Karachi's 7 items were expensive electronics.

---

## Module 7 — Complete

`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`; `COUNT(*)` vs `COUNT(column)` and NULL handling; `GROUP BY` with its SELECT-column rule; `HAVING` vs `WHERE`; execution order; `COUNT(DISTINCT)`; and a repeatable method for building multi-table JOIN chains.

---

## Next Up
**Module 7.5 — Subqueries and CTEs**: queries nested inside queries (e.g. "users who have never booked anything"), and `WITH ... AS` for writing multi-step logic readably instead of nested and tangled.