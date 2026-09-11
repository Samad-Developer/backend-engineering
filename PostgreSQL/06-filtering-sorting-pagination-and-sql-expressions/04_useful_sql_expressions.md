# Useful SQL Expressions

## Topic 1: SQL Expressions

An SQL expression is a piece of SQL that evaluates to and produces a value.

Expressions can be simple values, calculations, comparisons, function calls, or conditional logic. For example, `price * 2` produces a numeric value and `price > 5000` produces a Boolean result.

```sql
SELECT
    name,
    price,
    price * 2 AS doubled_price,
    price > 5000 AS costs_more_than_5000
FROM query_products;
```

`CASE` is called an expression because the complete `CASE ... END` evaluates to one resulting value for each row.

## Topic 2: CASE

`CASE` is a conditional SQL expression that evaluates conditions in order and returns a value for the first condition that is true.

It solves the problem of producing different values from a query depending on the data in each row. Without `CASE`, this conditional transformation would often need to be performed later in application code.

### Searched CASE Syntax

```sql
CASE
    WHEN condition1 THEN value1
    WHEN condition2 THEN value2
    ELSE default_value
END
```

PostgreSQL checks the `WHEN` conditions from top to bottom. When it finds the first true condition, it returns that condition's `THEN` value and stops checking later conditions. If no condition is true, `ELSE` is returned. If `ELSE` is omitted and no condition matches, the result is `NULL`.

```sql
SELECT
    name,
    price,
    CASE
        WHEN price < 5000 THEN 'Low'
        WHEN price <= 15000 THEN 'Medium'
        ELSE 'High'
    END AS price_level
FROM query_products;
```

Conceptually, searched `CASE` is similar to JavaScript `if / else if / else`:

```javascript
if (price < 5000) {
  priceLevel = "Low";
} else if (price <= 15000) {
  priceLevel = "Medium";
} else {
  priceLevel = "High";
}
```

### Simple CASE

SQL also provides a form that is closer to a JavaScript `switch` statement.

```sql
SELECT
    name,
    category,
    CASE category
        WHEN 'Electronics' THEN 'Tech Product'
        WHEN 'Furniture' THEN 'Home Product'
        WHEN 'Stationery' THEN 'Office Product'
        ELSE 'Other'
    END AS category_label
FROM query_products;
```

The searched form, `CASE WHEN condition`, is more flexible because each `WHEN` can contain a different condition.

## Topic 3: COALESCE

`COALESCE` returns the first non-NULL value from a list of values, checking the arguments from left to right.

Its main purpose is to handle missing values by providing one or more fallback values.

### Syntax

```sql
COALESCE(value1, value2, value3, ...)
```

For example:

```sql
SELECT
    name,
    COALESCE(rating, 0) AS rating
FROM query_products;
```

If `rating` is `4.9`, PostgreSQL returns `4.9`. If `rating` is `NULL`, PostgreSQL continues to the next argument and returns `0`.

```text
COALESCE(4.9, 0)  -> 4.9
COALESCE(NULL, 0) -> 0
```

"First non-NULL" means the first value encountered from left to right that is not `NULL`. Once PostgreSQL finds one, later arguments are not needed for the result.

```sql
SELECT COALESCE(NULL, NULL, 'Samad', 'Fallback');
```

The result is:

```text
Samad
```

If every supplied value is `NULL`, the result is also `NULL`.

```sql
SELECT COALESCE(NULL, NULL, NULL);
```

A useful mental model is:

```text
COALESCE(actual_value, fallback_value)
```

For multiple fallback levels:

```sql
COALESCE(nickname, username, email, 'Unknown')
```

This means: use `nickname`; if it is NULL, try `username`; then `email`; finally use `'Unknown'`.

## Topic 4: Basic String Functions

PostgreSQL provides string functions for transforming, cleaning, combining, and inspecting text values.

### UPPER

`UPPER()` converts text to uppercase.

```sql
SELECT name, UPPER(name) AS upper_case
FROM query_products;
```

### LOWER

`LOWER()` converts text to lowercase.

```sql
SELECT name, LOWER(name) AS lower_case
FROM query_products;
```

### LENGTH

`LENGTH()` returns the number of characters in a string.

```sql
SELECT name, LENGTH(name) AS name_length
FROM query_products;
```

### TRIM

`TRIM()` removes leading and trailing spaces from text.

```sql
SELECT TRIM(name) AS trimmed_name
FROM query_products;
```

PostgreSQL may display the unaliased result of `TRIM()` with the internal function-style heading `btrim`, so using a clear alias is useful.

### CONCAT

`CONCAT()` combines values into one text value.

```sql
SELECT
    CONCAT(category, ' - ', name) AS product_info
FROM query_products;
```

PostgreSQL also supports the `||` concatenation operator:

```sql
SELECT
    category || ' - ' || name AS product_info
FROM query_products;
```

The correct PostgreSQL function names are `UPPER()` and `LOWER()`, not `UPPERCASE()` or `LOWERCASE()`.

A combined example:

```sql
SELECT
    TRIM(name) AS trimmed_name,
    UPPER(name) AS upper_case,
    LOWER(name) AS lower_case,
    LENGTH(name) AS name_length,
    CONCAT(category, '-', name) AS product_info
FROM query_products;
```

## Topic 5: Basic Date and Time Expressions

PostgreSQL provides expressions and functions for retrieving the current date/time, extracting individual components, and performing date/time arithmetic.

### CURRENT_DATE

`CURRENT_DATE` returns the current calendar date as a `DATE` value.

```sql
SELECT CURRENT_DATE;
```

Example result:

```text
2026-09-11
```

### CURRENT_TIME

`CURRENT_TIME` returns the current time with time-zone information.

```sql
SELECT CURRENT_TIME;
```

Example result:

```text
20:15:32.123456+05
```

### CURRENT_TIMESTAMP

`CURRENT_TIMESTAMP` returns the current date and time as a `TIMESTAMPTZ` value.

```sql
SELECT CURRENT_TIMESTAMP;
```

It is commonly used as a default for creation timestamps:

```sql
CREATE TABLE example_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### EXTRACT

`EXTRACT()` retrieves one component from a date/time value.

### Syntax

```sql
EXTRACT(part FROM date_time_value)
```

Example:

```sql
SELECT
    EXTRACT(YEAR FROM CURRENT_TIMESTAMP) AS year,
    EXTRACT(MONTH FROM CURRENT_TIMESTAMP) AS month,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP) AS day,
    EXTRACT(HOUR FROM CURRENT_TIMESTAMP) AS hour;
```

It can also be used with table columns:

```sql
SELECT *
FROM example_orders
WHERE EXTRACT(YEAR FROM created_at) = 2026;
```

### Date and Time Arithmetic with INTERVAL

An `INTERVAL` represents a duration and can be added to or subtracted from date/time values.

```sql
SELECT CURRENT_TIMESTAMP + INTERVAL '7 days';
```

```sql
SELECT CURRENT_TIMESTAMP - INTERVAL '2 hours';
```

## Topic 6: Combining SQL Expressions

SQL expressions can be combined in a single query. For example, a query can handle NULL values, classify prices, transform text, and sort the final result together.

```sql
SELECT
    name,
    price,
    COALESCE(rating, 0) AS rating,
    CASE
        WHEN price < 5000 THEN 'Low'
        WHEN price <= 15000 THEN 'Medium'
        ELSE 'High'
    END AS price_level,
    UPPER(category) AS category
FROM query_products
ORDER BY price DESC;
```

In this query:

- `COALESCE` provides a fallback when `rating` is NULL.
- `CASE` produces a conditional `price_level` value for each row.
- `UPPER` transforms the category text.
- `ORDER BY` sorts the final rows by price.
