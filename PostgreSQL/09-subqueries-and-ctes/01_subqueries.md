# Stage 9 — Subqueries

## 1. Problem subqueries solve

Sometimes one SQL statement depends on the result of another query.

Examples:
- products above the overall average price
- customers whose IDs appear in qualifying orders
- customers who have at least one order
- customers who have no order above a threshold
- products above the average price of their own category

## 2. Definition

A **subquery** is a SQL query nested inside another SQL statement, whose result is used by the outer query to complete its operation.

```text
inner query
→ produces a value, set, or matching rows

outer query
→ uses that result
```

## 3. Scalar subqueries

A **scalar subquery** returns one column and at most one row, so it can be used like a single value.

```sql
SELECT name, price
FROM query_products
WHERE price > (
    SELECT AVG(price)
    FROM query_products
);
```

Mental model:

```text
inner query → one average value
outer query → compare each product against it
```

Behavior:
- one row → use the value
- zero rows → result is `NULL`
- more than one row → error

## 4. `IN`

`IN` checks whether a value belongs to a set of values returned by another query.

```sql
SELECT id, name
FROM join_customers
WHERE id IN (
    SELECT customer_id
    FROM join_orders
    WHERE total >= 5000
);
```

Mental model:

```text
inner query → set such as (1, 2)
outer query → keep rows whose id is in that set
```

Duplicate values returned by the inner query do not duplicate outer rows.

## 5. `EXISTS`

`EXISTS` returns:
- `TRUE` if the subquery returns at least one row
- `FALSE` if it returns zero rows

```sql
SELECT id, name
FROM join_customers AS c
WHERE EXISTS (
    SELECT 1
    FROM join_orders AS o
    WHERE o.customer_id = c.id
);
```

### Why `SELECT 1`?

`SELECT 1` does not mean boolean true. It simply returns the literal value `1` for matching rows. `EXISTS` ignores the selected value and only checks whether any row exists.

These are logically equivalent inside `EXISTS`:

```sql
SELECT 1
SELECT *
SELECT o.id
```

## 6. `NOT EXISTS`

```sql
SELECT id, name
FROM join_customers AS c
WHERE NOT EXISTS (
    SELECT 1
    FROM join_orders AS o
    WHERE o.customer_id = c.id
      AND o.total > 4000
);
```

Meaning:

> Return customers for whom no order above 4000 exists.

This is different from asking whether at least one order less than or equal to 4000 exists.

## 7. Correlated subqueries

A **correlated subquery** references a column from the outer query, so its result depends on the current outer row.

```sql
SELECT
    p1.name,
    p1.category,
    p1.price
FROM query_products AS p1
WHERE p1.price > (
    SELECT AVG(p2.price)
    FROM query_products AS p2
    WHERE p2.category = p1.category
);
```

Logical mental model:

```text
take one outer product
→ read its category
→ calculate that category's average
→ compare price
→ continue with next product
```

Aliases are especially important when the same table is used in both outer and inner queries.

## 8. `IN` vs `EXISTS`

Use `IN` when the idea is:

```text
Is this value in the returned set?
```

Use `EXISTS` when the idea is:

```text
Does at least one matching row exist?
```

Do not assume one is always faster. PostgreSQL can optimize both; performance should later be checked with `EXPLAIN ANALYZE`.

### `NOT IN` and `NULL`

`NOT IN` can behave unexpectedly if the inner result contains `NULL`, because SQL uses three-valued logic. For anti-match logic, `NOT EXISTS` is often clearer and safer.

## 9. Derived tables

A **derived table** is a subquery placed in `FROM` or `JOIN`. Its result behaves like a temporary table for that statement.

```sql
SELECT
    c.name,
    s.total_spent
FROM join_customers AS c
JOIN (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
) AS s
    ON c.id = s.customer_id
WHERE s.total_spent > 5000;
```

## 10. Final mental model

```text
Scalar subquery
→ one value

IN
→ set membership

EXISTS
→ at least one matching row?

NOT EXISTS
→ no matching row?

Correlated subquery
→ inner query depends on current outer row

Derived table
→ subquery result behaves like a table in FROM/JOIN
```
