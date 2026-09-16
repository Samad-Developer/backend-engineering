# IN vs EXISTS and Derived Tables

## Topic 1: IN vs EXISTS

`IN` compares a value against a set of values returned by a subquery, while `EXISTS` checks only whether at least one matching row exists.

```text
IN
→ care about returned VALUES

EXISTS
→ care about whether a matching ROW exists
```

`IN` example:

```sql
SELECT
    id,
    name
FROM join_customers
WHERE id IN (
    SELECT customer_id
    FROM join_orders
);
```

`EXISTS` example:

```sql
SELECT
    c.id,
    c.name
FROM join_customers AS c
WHERE EXISTS (
    SELECT 1
    FROM join_orders AS o
    WHERE o.customer_id = c.id
);
```

## Topic 2: NOT IN and NULL

`NOT IN` can behave unexpectedly if the subquery returns `NULL`.

For anti-matching requirements, `NOT EXISTS` is often clearer and safer.

```sql
SELECT
    c.id,
    c.name
FROM join_customers AS c
WHERE NOT EXISTS (
    SELECT 1
    FROM join_orders AS o
    WHERE o.customer_id = c.id
);
```

## Topic 3: Same Requirement, Different SQL Forms

Customers with at least one order can be found with `EXISTS`:

```sql
SELECT
    c.id,
    c.name
FROM join_customers AS c
WHERE EXISTS (
    SELECT 1
    FROM join_orders AS o
    WHERE o.customer_id = c.id
);
```

with `IN`:

```sql
SELECT
    id,
    name
FROM join_customers
WHERE id IN (
    SELECT customer_id
    FROM join_orders
);
```

or with `JOIN` + `DISTINCT`:

```sql
SELECT DISTINCT
    c.id,
    c.name
FROM join_customers AS c
INNER JOIN join_orders AS o
    ON c.id = o.customer_id;
```

## Topic 4: Subqueries in FROM or JOIN

A subquery used in `FROM` or `JOIN` produces a table-like result set and is commonly called a **derived table**.

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

The subquery result can be treated like a temporary table:

```text
customer_id | total_spent
------------+------------
1           | 8500
2           | 8000
3           | 3000
```

The alias:

```sql
AS s
```

gives that derived result a name so its columns can be referenced.

Also:

```sql
JOIN
```

without another qualifier means:

```sql
INNER JOIN
```
