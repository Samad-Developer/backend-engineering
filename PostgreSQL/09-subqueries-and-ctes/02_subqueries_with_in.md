# Subqueries with IN

## Topic 1: IN with a Subquery

A subquery used with `IN` returns a set of values, and the outer query checks whether its value belongs to that returned set.

```sql
SELECT
    id,
    name
FROM join_customers
WHERE id IN (
    SELECT customer_id
    FROM join_orders
    WHERE total >= 5000
);
```

Mental model:

```text
Scalar subquery → ONE value
IN subquery     → SET of values
```

## Topic 2: IN Works with More Than IDs

`IN` works with comparable values such as integers, text, UUIDs, dates, and enums.

```sql
SELECT
    id,
    name,
    category,
    price
FROM query_products
WHERE category IN (
    SELECT category
    FROM query_products
    WHERE price > 40000
);
```

The inner query returns category values, and the outer query compares its `category` against that returned set.

## Topic 3: Match the Outer Expression to the Inner Values

The subquery should return values that are comparable to the outer expression.

If the outer query uses:

```sql
WHERE category IN (...)
```

the inner query should normally return category values:

```sql
SELECT category
```

not unrelated values such as product IDs.

## Topic 4: Duplicate Values

Duplicate values returned by an `IN` subquery do not cause duplicate outer rows.

```text
id IN (1, 1, 1, 2)
```

is still a membership check.
