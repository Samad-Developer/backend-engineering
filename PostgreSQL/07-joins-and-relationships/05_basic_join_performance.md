# Basic JOIN Performance Considerations

## Topic 1: Efficient JOIN Matching

JOIN performance depends heavily on how efficiently PostgreSQL can locate matching rows and how many rows the query must process.

Consider:

```sql
SELECT
    c.name,
    o.total
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.id;
```

PostgreSQL must match:

```text
orders.customer_id → customers.id
```

With small tables this is inexpensive, but matching strategy becomes important when tables contain millions of rows.

## Topic 2: Indexes on JOIN Columns

Indexes can help PostgreSQL locate matching rows efficiently for many JOIN and filtering patterns.

Primary keys and unique constraints automatically receive supporting unique indexes in PostgreSQL. Therefore a typical referenced primary key such as `customers.id` is already indexed.

A PostgreSQL foreign key does not automatically create an index on the referencing column.

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

Frequently joined or filtered foreign-key columns are therefore strong index candidates, especially on larger tables.

Indexes should not be added blindly because they consume storage and add work to writes.

## Topic 3: Use the Correct Relationship Columns

JOIN conditions should follow the actual schema relationship.

Correct:

```sql
ON o.customer_id = c.id
```

Incorrect simply because both happen to be IDs:

```sql
ON o.id = c.id
```

The relationship, not the column name or data type alone, determines the correct JOIN condition.

## Topic 4: Filter Unnecessary Data in SQL

Queries should normally restrict unnecessary rows in SQL instead of returning a large result to the application and filtering it there.

```sql
SELECT
    c.name,
    o.total
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.id
WHERE c.id = 100;
```

PostgreSQL's optimizer decides the physical execution plan, so SQL's written order should not be interpreted as a literal guarantee that the database first materializes the entire JOIN and only then applies the filter.

## Topic 5: Select Only Required Columns

Production queries should normally request only the columns they need.

Prefer:

```sql
SELECT
    o.id,
    c.name,
    o.total
FROM orders AS o
JOIN customers AS c
    ON o.customer_id = c.id;
```

over habitually using:

```sql
SELECT *
```

Selecting only required columns can reduce result size, network transfer, and application memory usage, especially when tables contain wide `TEXT`, `JSONB`, or similar columns.

## Topic 6: Understand Cardinality and Row Multiplication

JOINs can multiply rows when one row matches multiple rows.

```text
1 order
   ↓
10 order_items
   ↓
10 result rows
```

Joining additional one-to-many or many-to-many relationships can multiply the result further. Understanding relationship cardinality helps prevent unexpectedly large query results.

## Topic 7: CROSS JOIN Cost

A cross join creates every possible combination.

```text
10,000 rows × 20,000 rows
= 200,000,000 combinations
```

Therefore cross joins and accidental Cartesian products should be used with particular care.

At the basic level, remember:

1. Join using actual relationship columns.
2. Treat frequently joined or filtered foreign-key columns as index candidates.
3. Filter unnecessary data in SQL.
4. Select only required columns.
5. Understand relationship cardinality and row multiplication.
6. Be careful with cross joins.
