# GROUP BY and HAVING

## Topic 1: GROUP BY

`GROUP BY` divides rows into groups based on equal values in one or more columns so aggregate functions can calculate one result for each group.

```sql
SELECT
    category,
    COUNT(*) AS total_products,
    AVG(price) AS average_price
FROM products
GROUP BY category;
```

Conceptually:

```text
Electronics → all Electronics rows
Furniture   → all Furniture rows
Stationery  → all Stationery rows
Accessories → all Accessories rows
```

Without `GROUP BY`, an aggregate normally summarizes the whole matching result set. With `GROUP BY`, the aggregate is calculated separately for each group.

## Topic 2: Why Selected Columns Must Usually Appear in GROUP BY

After grouping, PostgreSQL must produce one output row per group. A normal selected column must therefore have one unambiguous value for that group.

This is valid:

```sql
SELECT
    category,
    COUNT(*)
FROM products
GROUP BY category;
```

This is normally invalid:

```sql
SELECT
    category,
    name,
    COUNT(*)
FROM products
GROUP BY category;
```

If one category contains `Keyboard`, `Mouse`, and `Monitor`, PostgreSQL cannot choose one single `name` for that category group.

The practical rule is:

> When using `GROUP BY`, a selected expression should generally either be part of the grouping or be calculated with an aggregate function.

```sql
SELECT
    category,
    COUNT(*) AS total_products,
    AVG(price) AS average_price,
    MAX(price) AS highest_price
FROM products
GROUP BY category;
```

## Topic 3: Grouping by Multiple Columns

`GROUP BY` can use multiple columns. PostgreSQL then forms groups based on the unique combination of those values.

```sql
SELECT
    category,
    is_available,
    COUNT(*) AS total
FROM products
GROUP BY category, is_available;
```

Possible groups:

```text
Electronics + TRUE
Electronics + FALSE
Furniture   + TRUE
Furniture   + FALSE
```

## Topic 4: HAVING

`HAVING` filters grouped or aggregated results after grouping has occurred.

```sql
SELECT
    category,
    COUNT(*) AS total_products
FROM products
GROUP BY category
HAVING COUNT(*) > 3;
```

Meaning:

```text
1. Group rows by category
2. Count rows in each category
3. Keep only groups where count > 3
```

`HAVING` is used when the filter depends on aggregate results such as `COUNT`, `SUM`, or `AVG`.

## Topic 5: WHERE vs HAVING

`WHERE` filters individual rows before grouping and aggregation.

`HAVING` filters groups after grouping and aggregation.

```sql
SELECT
    category,
    AVG(price) AS average_price
FROM products
WHERE is_available = TRUE
GROUP BY category
HAVING AVG(price) > 5000;
```

Mental model:

```text
WHERE    → row filter
GROUP BY → create groups
HAVING   → group filter
```

This is invalid:

```sql
SELECT
    category,
    COUNT(*)
FROM products
WHERE COUNT(*) > 3
GROUP BY category;
```

because aggregate results are not available at the `WHERE` stage.
