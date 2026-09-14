# Core SQL JOIN Types

## Topic 1: JOIN Fundamentals

A JOIN combines related rows from two or more tables into one query result based on a matching condition.

The underlying tables remain separate. The JOIN only produces a combined query result.

```sql
SELECT
    o.id AS order_id,
    c.name AS customer_name,
    o.total
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.id;
```

The `ON` condition determines how rows match:

```text
orders.customer_id → customers.id
```

For an equality condition, the textual side of `=` does not matter:

```sql
ON o.customer_id = c.id
```

and:

```sql
ON c.id = o.customer_id
```

are equivalent.

The table before `JOIN` is the left table and the table after `JOIN` is the right table.

## Topic 2: INNER JOIN

An `INNER JOIN` returns only rows for which the JOIN condition finds a match on both sides.

```sql
SELECT
    o.id AS order_id,
    c.name AS customer_name,
    o.total
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.id;
```

`JOIN` without another qualifier normally means `INNER JOIN`.

A useful mental model is:

```text
INNER JOIN = matching rows only
```

## Topic 3: Table Aliases

A table alias is a temporary alternative name assigned to a table within a query to make references shorter, clearer, or distinguish multiple references to the same table.

```sql
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.id
```

Here:

```text
o → orders
c → customers
```

Aliases improve readability in multi-table queries and are essential for clearly distinguishing roles in self joins.

PostgreSQL also permits omission of `AS`:

```sql
FROM orders o
JOIN customers c
    ON o.customer_id = c.id;
```

## Topic 4: LEFT JOIN

A `LEFT JOIN` returns every row from the left table and matching rows from the right table. If a left-side row has no match, columns from the right side are returned as `NULL`.

```sql
SELECT
    c.name,
    o.id AS order_id,
    o.total
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id;
```

If a customer has no order:

```text
customer_name | order_id | total
--------------+----------+------
Hamza         | NULL     | NULL
```

The central question when choosing a `LEFT JOIN` is:

> Which table's rows must survive even when no match exists?

Put that table on the left.

A common unmatched-row pattern is:

```sql
SELECT c.id, c.name
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id
WHERE o.id IS NULL;
```

This finds customers with no orders.

## Topic 5: RIGHT JOIN

A `RIGHT JOIN` returns every row from the right table and matching rows from the left table. If a right-side row has no match, left-side columns become `NULL`.

```sql
SELECT
    c.name,
    o.total
FROM orders AS o
RIGHT JOIN customers AS c
    ON o.customer_id = c.id;
```

A right join can normally be expressed by swapping the table order and using a left join:

```text
A RIGHT JOIN B
```

has the same row-preservation idea as:

```text
B LEFT JOIN A
```

This is why many queries are written primarily with `LEFT JOIN`.

## Topic 6: FULL OUTER JOIN

A `FULL OUTER JOIN` returns all matching rows plus unmatched rows from both tables. Missing columns from either side are represented by `NULL`.

```sql
SELECT
    a.id AS a_id,
    b.id AS b_id
FROM table_a AS a
FULL OUTER JOIN table_b AS b
    ON a.id = b.a_id;
```

`FULL JOIN` and `FULL OUTER JOIN` are equivalent PostgreSQL syntax.

```text
INNER JOIN → matches only
LEFT JOIN  → matches + unmatched left
RIGHT JOIN → matches + unmatched right
FULL JOIN  → matches + unmatched both
```
