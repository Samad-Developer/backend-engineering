# Aggregate Functions and COUNT Patterns

## Topic 1: Aggregate Functions

An aggregate function processes multiple input rows and returns one summarized value for those rows.

Common PostgreSQL aggregate functions are:

- `COUNT` — counts rows or non-NULL values.
- `SUM` — adds numeric values.
- `AVG` — calculates the arithmetic average.
- `MIN` — returns the smallest value.
- `MAX` — returns the largest value.

```sql
SELECT
    COUNT(*) AS total_products,
    SUM(price) AS total_price,
    AVG(price) AS average_price,
    MIN(price) AS minimum_price,
    MAX(price) AS maximum_price
FROM products;
```

Without `GROUP BY`, aggregate functions summarize all matching rows into one result row.

```sql
SELECT AVG(price)
FROM products
WHERE category = 'Electronics';
```

This first keeps only Electronics rows and then calculates the average from those rows.

## Topic 2: COUNT(*)

`COUNT(*)` counts every row in the result set, regardless of whether individual columns contain `NULL`.

```sql
SELECT COUNT(*)
FROM products;
```

Mental model:

```text
COUNT(*) → count rows
```

## Topic 3: COUNT(column)

`COUNT(column)` counts only rows where the specified column is not `NULL`.

```sql
SELECT COUNT(rating)
FROM products;
```

If there are 18 rows and 2 ratings are `NULL`:

```text
COUNT(*)      = 18
COUNT(rating) = 16
```

Mental model:

```text
COUNT(*)      → count rows
COUNT(column) → count non-NULL values
```

## Topic 4: COUNT(DISTINCT column)

`COUNT(DISTINCT column)` counts the number of different non-NULL values in a column.

```sql
SELECT COUNT(DISTINCT category)
FROM products;
```

`DISTINCT` can also be used directly:

```sql
SELECT DISTINCT category
FROM products;
```

`DISTINCT` affects only the query result.

```text
UNIQUE   → prevents duplicate stored values
DISTINCT → removes duplicate values from a query result
```
