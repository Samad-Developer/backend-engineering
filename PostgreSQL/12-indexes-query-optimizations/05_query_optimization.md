
# Stage 12 — Database Performance
## 05 — Query Optimization

Query optimization means reducing unnecessary database work so queries and application database interactions are more efficient.

The goal is not to make every query as short as possible. The goal is to avoid unnecessary work and measure whether an optimization actually helps.

---

## 1. Avoid Unnecessary Queries

Each query sent from the backend to PostgreSQL has overhead.

```text
Node.js
→ send query
→ PostgreSQL plans query
→ PostgreSQL executes query
→ result travels back
→ Node.js receives result
```

If related data can be retrieved cleanly with fewer queries, reduce unnecessary calls.

Example:

```sql
SELECT
    c.id,
    c.name,
    o.id AS order_id,
    o.total
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id
WHERE c.id = $1;
```

Rule:

> Keep necessary queries. Remove unnecessary ones. Do not force everything into one giant query.

---

## 2. Avoid Unnecessary `SELECT *`

`SELECT *` returns every column.

```sql
SELECT *
FROM users
WHERE id = 10;
```

If the application only needs:

```text
id
name
email
```

prefer:

```sql
SELECT id, name, email
FROM users
WHERE id = 10;
```

Benefits:

```text
less data read
less data transferred
less application memory
clearer query intent
```

Rule:

> Select only the columns the application actually needs.

---

## 3. Avoid Unnecessary `JOIN`s

A `JOIN` should have a reason to exist.

Necessary example:

```sql
SELECT
    o.id,
    o.total,
    c.name
FROM orders o
JOIN customers c
    ON c.id = o.customer_id;
```

The customer table is needed because `c.name` is returned.

If the query does not select from, filter by, or otherwise require the joined table, the join may be unnecessary.

Rule:

> Every joined table should have a clear purpose.

---

## 4. Avoid Unnecessary `DISTINCT`

`DISTINCT` removes duplicate result rows.

Valid example:

```sql
SELECT DISTINCT customer_id
FROM orders;
```

Do not use it merely to hide duplicates caused by another part of the query.

Example:

```sql
SELECT DISTINCT c.id, c.name
FROM customers c
JOIN orders o
    ON o.customer_id = c.id;
```

If the real requirement is “customers who have at least one order,” this may be clearer:

```sql
SELECT c.id, c.name
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
);
```

This is a **correlated subquery** because the inner query references `c.id` from the outer query.

Rule:

> Use `DISTINCT` when uniqueness is the actual requirement, not as a generic duplicate-removal fix.

---

## 5. Avoid Unnecessary Sorting

Sorting requires PostgreSQL to arrange rows.

```sql
SELECT *
FROM orders
ORDER BY created_at DESC;
```

If the application does not care about order, this can be unnecessary work.

Useful example:

```sql
SELECT *
FROM orders
ORDER BY created_at DESC
LIMIT 20;
```

This clearly means:

```text
return the latest 20 orders
```

Rule:

```text
Need a specific order?
→ use ORDER BY

Order does not matter?
→ avoid unnecessary sorting
```

---

## 6. Reduce Database Round Trips

A **database round trip** is one request from the backend to PostgreSQL and the response coming back.

```text
Node.js → PostgreSQL
PostgreSQL → Node.js
```

Repeated calls:

```js
await db.query(...);
await db.query(...);
await db.query(...);
```

can add repeated:

```text
network latency
query planning
query execution
result transfer
```

Rule:

> Reduce unnecessary round trips, but do not create one huge unreadable query just to reduce query count.

---

## 7. N+1 Query Problem

The **N+1 query problem** happens when the application first retrieves `N` parent rows and then executes one additional query for every parent row.

Example:

```sql
SELECT id, name
FROM customers;
```

Suppose it returns:

```text
100 customers
```

Then the backend runs this once for every customer:

```sql
SELECT *
FROM orders
WHERE customer_id = $1;
```

Total:

```text
1 customer query
+
100 order queries
=
101 queries
```

Mental model:

```text
1 initial query
+
N additional queries
```

### Solution 1 — `JOIN`

```sql
SELECT
    c.id,
    c.name,
    o.id AS order_id,
    o.total
FROM customers c
LEFT JOIN orders o
    ON o.customer_id = c.id;
```

### Solution 2 — Bulk Fetch

```sql
SELECT *
FROM orders
WHERE customer_id IN (1, 2, 3, 4, 5);
```

This can reduce:

```text
1 + N queries
```

to:

```text
1 parent query
+
1 related-data query
=
2 queries
```

Rule:

> Avoid one additional database query per returned row when related data can be fetched in bulk.

---

## 8. Batch Operations

Batching means doing several similar operations together instead of one query per item.

### Multiple Inserts

Instead of:

```text
INSERT product 1
INSERT product 2
INSERT product 3
```

use:

```sql
INSERT INTO products (name, price)
VALUES
    ('Keyboard', 5000),
    ('Mouse', 2500),
    ('Monitor', 45000);
```

### Multiple Reads

Instead of:

```text
query product 1
query product 2
query product 3
```

use:

```sql
SELECT *
FROM products
WHERE id IN (1, 2, 3);
```

Benefits:

```text
fewer round trips
less repeated overhead
database can process work together
```

Rule:

> When the same kind of operation must be performed for many rows, consider batching it.

---

## 9. Measure Before and After Optimization

Do not assume an optimization helped. Measure it.

Before:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM orders
WHERE customer_id = 100;
```

Example:

```text
Seq Scan
Execution Time: 80 ms
```

Then make a change:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

Measure again:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM orders
WHERE customer_id = 100;
```

Possible result:

```text
Index Scan
Execution Time: 2 ms
```

Optimization workflow:

```text
1. Identify slow query
2. Measure it
3. Inspect the execution plan
4. Identify unnecessary work or bottleneck
5. Make one useful change
6. Measure again
7. Compare
```

Rule:

> Database optimization should be based on measurements, not guesses.

---

## 10. Query Optimization Mental Map

```text
Slow or expensive database behavior
              ↓
       Find unnecessary work
              ↓
 ┌────────────┼─────────────┐
 ↓            ↓             ↓
Too many    Too much      Bad query
queries     data          behavior
 ↓            ↓             ↓
N+1        SELECT *       unnecessary JOIN
round trips               DISTINCT
batching                  sorting
              ↓
        measure performance
              ↓
 EXPLAIN (ANALYZE, BUFFERS)
              ↓
          optimize
              ↓
        measure again
```

---

## 11. Developer Checklist

```text
Am I sending unnecessary queries?

Am I selecting columns I do not need?

Does every JOIN have a purpose?

Am I using DISTINCT to hide another problem?

Do I really need ORDER BY?

Am I making too many database round trips?

Is there an N+1 query pattern?

Can repeated operations be batched?

Did I measure before and after optimization?
```

These are the main practical query-optimization habits needed in normal backend development.
