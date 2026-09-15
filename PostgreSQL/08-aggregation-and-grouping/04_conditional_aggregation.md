# Conditional Aggregation

## Topic 1: Conditional Aggregation

Conditional aggregation calculates an aggregate based on a condition, often by combining an aggregate function with `CASE`.

A common pattern is:

```sql
SUM(
    CASE
        WHEN condition THEN 1
        ELSE 0
    END
)
```

Each matching row contributes `1`, each non-matching row contributes `0`, and `SUM` counts the matches.

## Topic 2: Counting Available and Unavailable Rows

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
    SUM(
        CASE
            WHEN is_available = FALSE THEN 1
            ELSE 0
        END
    ) AS unavailable_products
FROM products
GROUP BY category;
```

Conceptually:

```text
Keyboard   TRUE  → 1
Mouse      FALSE → 0
Monitor    TRUE  → 1
Laptop     TRUE  → 1
```

For the available-products expression:

```text
1 + 0 + 1 + 1 = 3
```

The core idea is:

> `CASE` decides what value each row contributes, and the aggregate function combines those values.

## Topic 3: CASE + Aggregation

```sql
SELECT
    category,
    SUM(
        CASE
            WHEN price > 10000 THEN 1
            ELSE 0
        END
    ) AS expensive_products
FROM products
GROUP BY category;
```

This counts products above `10000` inside each category.

The same pattern can represent many business rules:

```text
paid vs unpaid orders
active vs inactive users
high-value vs low-value transactions
available vs unavailable products
successful vs failed jobs
```
