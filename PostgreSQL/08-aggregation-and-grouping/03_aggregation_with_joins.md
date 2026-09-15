# Aggregation with JOINs

## Topic 1: Aggregating Related Data

Aggregation with JOINs combines rows from related tables and then applies aggregate functions to the joined result.

```sql
SELECT
    c.name AS customer_name,
    SUM(o.total) AS total_spent
FROM customers AS c
INNER JOIN orders AS o
    ON c.id = o.customer_id
GROUP BY c.id, c.name;
```

Conceptually:

```text
Ali   → 5000
Ali   → 2500
Ali   → 1000
Samad → 8000
Ahmed → 3000
```

After grouping:

```text
Ali   → 8500
Samad → 8000
Ahmed → 3000
```

The JOIN connects related rows; `GROUP BY` then creates one group per customer.

## Topic 2: Counting Related Rows

```sql
SELECT
    c.name AS customer_name,
    COUNT(o.id) AS total_orders
FROM customers AS c
INNER JOIN orders AS o
    ON c.id = o.customer_id
GROUP BY c.id, c.name;
```

To include customers with zero orders:

```sql
SELECT
    c.name AS customer_name,
    COUNT(o.id) AS total_orders
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id
GROUP BY c.id, c.name;
```

A customer without matching orders can then correctly return:

```text
Hamza | 0
```

## Topic 3: COUNT(*) vs COUNT(right_table.column) with LEFT JOIN

A left join preserves a row for the left-side record even when the right side has no match:

```text
Hamza | NULL
```

Therefore `COUNT(*)` counts that joined row, while:

```sql
COUNT(o.id)
```

counts only non-NULL order IDs.

For the question:

> How many matching orders does each customer have?

`COUNT(o.id)` is normally the correct pattern.

## Topic 4: SUM with LEFT JOIN and NULL

When a customer has no matching orders:

```sql
SUM(o.total)
```

returns `NULL`, not `0`.

Use `COALESCE` when the application should display zero:

```sql
SELECT
    c.name AS customer_name,
    COALESCE(SUM(o.total), 0) AS total_spent
FROM customers AS c
LEFT JOIN orders AS o
    ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY total_spent DESC;
```

## Topic 5: NULL Ordering

In PostgreSQL:

```sql
ORDER BY expression DESC
```

places `NULL` values first by default.

To place them last:

```sql
ORDER BY SUM(o.total) DESC NULLS LAST;
```

Another common approach is to use `COALESCE` and sort by the resulting alias.
