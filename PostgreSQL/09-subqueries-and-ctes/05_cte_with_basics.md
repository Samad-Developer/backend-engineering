# CTE Basics with WITH

## Topic 1: What a CTE Is

A CTE (Common Table Expression) is a temporary named result set defined using `WITH` that can be referenced by the SQL statement that follows it.

```sql
WITH cte_name AS (
    SELECT ...
)
SELECT ...
FROM cte_name;
```

The CTE exists only for that SQL statement and is not a permanent table.

## Topic 2: Why CTEs Are Useful

CTEs help break larger SQL statements into clear logical steps.

```sql
WITH customer_spending AS (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
)
SELECT
    customer_id,
    total_spent
FROM customer_spending
WHERE total_spent > 5000;
```

Conceptually:

```text
Step 1:
Build customer_spending

Step 2:
Query that named result

Step 3:
Filter total_spent > 5000
```

## Topic 3: CTE Result Columns

A CTE result behaves like a temporary table-like result inside the statement.

```sql
WITH category_stats AS (
    SELECT
        category,
        COUNT(*) AS total_products,
        AVG(price) AS average_price
    FROM query_products
    GROUP BY category
)
SELECT *
FROM category_stats
WHERE average_price > 5000;
```

The main query can directly reference:

```text
category
total_products
average_price
```

because those are columns produced by the CTE.

## Topic 4: CTE vs Subquery

A subquery is nested inside another query:

```sql
SELECT *
FROM (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
) AS customer_spending;
```

A CTE defines the result first and gives it a name:

```sql
WITH customer_spending AS (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
)
SELECT *
FROM customer_spending;
```

Mental model:

```text
Subquery
→ nested query result

CTE
→ named query result defined with WITH
```

A useful starting idea is:

> A CTE is like pulling a complex subquery out, giving it a name, and placing it at the top of the SQL statement.
