# EXISTS, NOT EXISTS, and Correlated Subqueries

## Topic 1: EXISTS

`EXISTS` is a SQL condition that returns `TRUE` if its subquery returns at least one row and `FALSE` if the subquery returns no rows.

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

This asks whether at least one matching order row exists for the current customer.

## Topic 2: What SELECT 1 Means

`SELECT 1` does not itself return a Boolean.

If rows match, it returns rows containing the value `1`.

```text
1
1
1
```

If no rows match, it returns zero rows.

`EXISTS` then converts row existence into a Boolean:

```text
at least one row → TRUE
zero rows        → FALSE
```

These are logically equivalent for `EXISTS`:

```sql
SELECT 1
```

```sql
SELECT *
```

```sql
SELECT o.id
```

`SELECT 1` is commonly used because the actual returned values do not matter.

## Topic 3: Why WHERE EXISTS Needs No Column

`WHERE` needs a Boolean expression, not necessarily a column comparison.

```sql
WHERE EXISTS (...)
```

works because `EXISTS(...)` itself evaluates to `TRUE` or `FALSE`.

## Topic 4: NOT EXISTS

`NOT EXISTS` keeps the outer row only when the subquery finds no matching row.

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

This returns customers with no orders.

A different requirement:

```sql
SELECT
    c.id,
    c.name
FROM join_customers AS c
WHERE NOT EXISTS (
    SELECT 1
    FROM join_orders AS o
    WHERE o.customer_id = c.id
      AND o.total > 4000
);
```

means:

> Return customers who have no order greater than 4000.

This is different from checking whether at least one order is `<= 4000`.

## Topic 5: Correlated Subqueries

A correlated subquery is a subquery that references columns from the outer query, so its result depends on the current outer row.

```sql
SELECT
    p.name,
    p.category,
    p.price
FROM query_products AS p
WHERE p.price > (
    SELECT AVG(p2.price)
    FROM query_products AS p2
    WHERE p2.category = p.category
);
```

Here:

```text
p  → current outer product
p2 → inner rows used to calculate that category's average
```

## Topic 6: Normal vs Correlated Subquery

```text
Normal subquery
→ independent of outer row

Correlated subquery
→ depends on current outer row
```

For learning, it is useful to imagine the correlated query being checked for each outer row, although PostgreSQL may physically optimize it differently.
