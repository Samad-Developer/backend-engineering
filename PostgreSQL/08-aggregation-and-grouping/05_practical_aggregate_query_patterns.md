# Practical Aggregate Query Patterns

## Topic 1: Multiple Aggregates per Group

A grouped query can calculate several aggregate values at the same time.

```sql
SELECT
    category,
    COUNT(*) AS total_products,
    AVG(price) AS average_price,
    MIN(price) AS lowest_price,
    MAX(price) AS highest_price
FROM products
GROUP BY category;
```

## Topic 2: Filtering Groups with HAVING

```sql
SELECT
    category,
    COUNT(*) AS total_products
FROM products
GROUP BY category
HAVING COUNT(*) > 2;
```

`HAVING` is used because the condition depends on the grouped count.

## Topic 3: Sorting Aggregate Results

Aggregate expressions or their aliases can be used in `ORDER BY`.

```sql
SELECT
    category,
    COUNT(*) AS total_products
FROM products
GROUP BY category
ORDER BY total_products DESC;
```

Equivalent:

```sql
ORDER BY COUNT(*) DESC;
```

Using the alias is often clearer.

## Topic 4: Complete Aggregate Query

```sql
SELECT
    category,
    COUNT(*) AS total_products,
    SUM(
        CASE
            WHEN is_available = TRUE THEN 1
            ELSE 0
        END
    ) AS available_products,
    AVG(price) AS average_price,
    MAX(price) AS highest_price
FROM products
GROUP BY category
HAVING COUNT(*) > 2
ORDER BY total_products DESC;
```

This combines the major Module 8 concepts:

```text
1. Group rows by category
2. Count all products
3. Count available products conditionally
4. Calculate average price
5. Find highest price
6. Keep only groups with more than two rows
7. Sort groups by product count descending
```
