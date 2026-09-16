# Subquery Fundamentals and Scalar Subqueries

## Topic 1: What a Subquery Is

A subquery is a SQL query nested inside another SQL statement whose result is used by the surrounding query to complete its operation.

A subquery is not a different SQL language or a completely separate concept. It is a normal query placed inside another query because the outer query needs information produced by the inner query.

```sql
SELECT
    name,
    price
FROM query_products
WHERE price > (
    SELECT AVG(price)
    FROM query_products
);
```

Conceptually:

```text
Inner query:
SELECT AVG(price)
→ produces one value

Outer query:
compare each product price against that value
```

## Topic 2: Scalar Subqueries

A scalar subquery is a subquery that returns one column from at most one row, producing a single value that can be used where SQL expects a scalar value.

```sql
SELECT
    name,
    price
FROM query_products
WHERE price = (
    SELECT MIN(price)
    FROM query_products
);
```

## Topic 3: Scalar Subquery Result Rules

A scalar subquery must return one column and at most one row.

```text
1 row  → that value
0 rows → NULL
more than 1 row → error
```

Example of an invalid scalar subquery:

```sql
SELECT *
FROM query_products
WHERE price > (
    SELECT price
    FROM query_products
    WHERE category = 'Electronics'
);
```

The inner query can return many prices, so there is no single scalar value for `price > (...)`.

## Topic 4: Same Table or Different Tables

A subquery can use the same table as the outer query:

```sql
SELECT
    name,
    price
FROM query_products
WHERE price > (
    SELECT AVG(price)
    FROM query_products
);
```

or a different table:

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
