# JOIN Conditions, Filtering, and Multiple Tables

## Topic 1: ON vs WHERE

The `ON` clause defines which rows from joined tables match, while the `WHERE` clause filters rows from the query result.

Basic example:

```sql
SELECT
    c.name,
    o.total
FROM customers AS c
INNER JOIN orders AS o
    ON c.id = o.customer_id
WHERE o.total > 3000;
```

A useful mental model is:

```text
ON    → controls matching
WHERE → controls final filtering
```

This distinction is especially important with outer joins.

Consider:

```sql
SELECT
    c.name,
    o.total
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id
WHERE o.total > 3000;
```

A customer without an order has `o.total = NULL`. Since `NULL > 3000` is not `TRUE`, the `WHERE` clause removes that row.

If the requirement is to keep all customers but attach only orders above 3000, place that condition in `ON`:

```sql
SELECT
    c.name,
    o.total
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id
   AND o.total > 3000;
```

Now all customers remain, while only qualifying orders match.

## Topic 2: Joining Multiple Tables

Multiple-table JOINs are built by adding JOIN clauses one at a time and connecting each new table through a real relationship to a table already in the query.

Suppose the schema is:

```text
customers
    ↑
    │ customer_id
orders
    ↑
    │ order_id
order_items
    │ product_id
    ↓
products
```

A four-table query can be written as:

```sql
SELECT
    o.id AS order_id,
    c.name AS customer_name,
    p.name AS product_name,
    oi.quantity
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.id
INNER JOIN order_items AS oi
    ON oi.order_id = o.id
INNER JOIN products AS p
    ON oi.product_id = p.id;
```

When adding a table, ask:

1. What data is needed from the new table?
2. Which table already in the query is related to it?
3. Which columns represent that relationship?

The JOIN path comes from the schema rather than from arbitrary ID columns.

## Topic 3: Joining Through a Junction Table

A many-to-many relationship is queried by joining from one entity through the junction table to the other entity.

```text
orders → order_items → products
```

```sql
SELECT
    o.id AS order_id,
    p.name AS product_name,
    oi.quantity
FROM orders AS o
INNER JOIN order_items AS oi
    ON o.id = oi.order_id
INNER JOIN products AS p
    ON oi.product_id = p.id;
```

The two JOIN conditions follow the two foreign-key relationships in the junction table.

## Topic 4: Duplicate Rows Caused by JOINs

A JOIN can legitimately produce repeated values from one table when one row matches multiple rows in another table.

For example:

```text
Order 1 → Keyboard
Order 1 → Mouse
```

A query joining orders to order items returns order 1 twice because there are two different matching order-item rows.

This is not necessarily incorrect duplication. It reflects relationship cardinality.

```text
1 order → many order_items
```

When a query joins several one-to-many or many-to-many relationships, the number of result rows can grow substantially. Always understand the cardinality of each relationship before interpreting repeated values.
