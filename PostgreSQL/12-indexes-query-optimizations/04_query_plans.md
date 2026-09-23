# Stage 12 — Database Performance
## 04 — Query Plans

Query plans help developers inspect how PostgreSQL plans or actually executes a query.

Main questions:

```text
Is PostgreSQL using an index?
Is it scanning the table?
Why is this query slow?
Did my optimization improve it?
```

---

## 1. `EXPLAIN`

`EXPLAIN` shows PostgreSQL's **planned execution strategy**.

```sql
EXPLAIN
SELECT *
FROM users
WHERE email = 'samad@gmail.com';
```

Possible output:

```text
Seq Scan on users
```

or:

```text
Index Scan using idx_users_email on users
```

`EXPLAIN` normally does **not execute the query**.

Important fields:

```text
cost
→ estimated work
→ not milliseconds

rows
→ estimated rows

width
→ estimated average row size in bytes
```

---

## 2. `EXPLAIN ANALYZE`

`EXPLAIN ANALYZE`:

1. shows the plan
2. actually executes the query
3. shows real execution statistics

```sql
EXPLAIN ANALYZE
SELECT *
FROM users
WHERE email = 'samad@gmail.com';
```

Important:

```text
actual time
→ timing for a specific plan node

rows
→ actual rows produced

loops
→ how many times that node ran

Execution Time
→ total time for the complete query plan
```

### Safety

`EXPLAIN ANALYZE` really executes the SQL.

So:

```sql
EXPLAIN ANALYZE DELETE ...
EXPLAIN ANALYZE UPDATE ...
EXPLAIN ANALYZE INSERT ...
```

can modify data.

---

## 3. `EXPLAIN (ANALYZE, BUFFERS)`

Provides:

```text
real execution
+ timing
+ page/buffer access information
```

Example:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM users
WHERE email = 'samad@gmail.com';
```

Common terms:

```text
shared hit
→ page already available in PostgreSQL buffer cache

shared read
→ page had to be read into the buffer cache
```

Useful for understanding I/O.

---

## 4. Sequential Scan

A **Sequential Scan (`Seq Scan`) means PostgreSQL reads the table rows directly and checks the query condition**.

Mental model:

```text
row 1 → check
row 2 → check
row 3 → check
...
```

A Seq Scan can be correct when:

- the table is small
- most rows match
- no useful index exists

It is not automatically bad.

---

## 5. Index Scan

An **Index Scan means PostgreSQL uses an index to locate matching rows, then fetches those rows from the table**.

```text
index
→ find matching entry
→ obtain row location
→ fetch table row
```

Often useful when relatively few rows match.

---

## 6. Bitmap Index Scan

A **Bitmap Index Scan uses an index to collect many matching row/page locations into a temporary in-memory bitmap**.

Example:

```text
Page 1 → rows 2, 4
Page 2 → row 7
Page 3 → rows 9, 10
```

Instead of fetching every row immediately, PostgreSQL first builds this location map.

---

## 7. Bitmap Heap Scan

A **Bitmap Heap Scan uses the bitmap to visit the actual table pages and retrieve matching rows efficiently**.

Important:

```text
heap
→ PostgreSQL table storage
```

Flow:

```text
Bitmap Index Scan
→ find matching locations
→ build bitmap

Bitmap Heap Scan
→ visit relevant table pages
→ retrieve rows
```

Simplified rule:

```text
few matches
→ Index Scan often fits

medium/many matches
→ Bitmap Index Scan + Bitmap Heap Scan may fit

most rows needed
→ Seq Scan may fit
```

---

## 8. Estimated Rows vs Actual Rows

```text
estimated rows
→ what PostgreSQL expected

actual rows
→ what actually happened
```

Example:

```text
estimated = 10
actual    = 12
```

Close estimate.

But:

```text
estimated = 10
actual    = 100000
```

Large mismatch.

Large estimation errors can sometimes lead to poor execution-plan choices.

---

## 9. Planning Time

**Planning Time is how long PostgreSQL spent deciding how to execute the query.**

It may decide:

```text
Seq Scan?
Index Scan?
Which index?
Which join strategy?
What execution order?
```

---

## 10. Execution Time

**Execution Time is the total time PostgreSQL spent actually executing the complete query plan.**

Difference:

```text
Planning Time
→ deciding how to run query

Execution Time
→ actually running query
```

If someone asks:

> How long did this query take to execute?

Use:

```text
Execution Time
```

---

## 11. `actual time` vs `Execution Time`

```text
actual time
→ timing for one specific plan node/operation

Execution Time
→ timing for the complete query execution
```

A query can contain multiple operations:

```text
scan
→ filter
→ join
→ sort
→ aggregate
```

Each plan node may have its own `actual time`.

---

## 12. Basic Query-Plan Interpretation

When reading:

```sql
EXPLAIN ANALYZE ...
```

check these in order:

1. What scan did PostgreSQL choose?
   - Seq Scan
   - Index Scan
   - Bitmap Scan

2. Which index did it use?

3. Estimated rows vs actual rows
   - Are they reasonably close?

4. Which operation has high actual time?

5. How many loops occurred?

6. What is the total Execution Time?

Mental model:

```text
EXPLAIN ANALYZE
        ↓
What strategy?
        ↓
How many rows?
        ↓
How much time/work?
        ↓
Is PostgreSQL doing unnecessary work?
```
