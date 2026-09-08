# Filtering in PostgreSQL

## Topic 1: WHERE

`WHERE` is a SQL clause that filters rows by returning only the rows whose specified condition evaluates to `TRUE`.

PostgreSQL evaluates the `WHERE` condition for each row. Rows for which the condition is `TRUE` are included in the result; rows for which it is `FALSE` or `UNKNOWN` are filtered out.

```sql
SELECT name, price
FROM products
WHERE price > 5000;
```

This returns only products whose `price` is greater than `5000`.

## Topic 2: Comparison Operators

Comparison operators compare two values and produce a Boolean result that can be used by `WHERE` to decide whether a row should be returned.

The common comparison operators are:

| Operator | Meaning |
|---|---|
| `=` | Equal to |
| `<>` | Not equal to |
| `!=` | Not equal to; also supported by PostgreSQL |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal to |
| `<=` | Less than or equal to |

```sql
-- Exactly 5000
SELECT name, price FROM products WHERE price = 5000;

-- Anything except 5000
SELECT name, price FROM products WHERE price <> 5000;

-- PostgreSQL also accepts != for not equal
SELECT name, price FROM products WHERE price != 5000;

-- Greater than 5000
SELECT name, price FROM products WHERE price > 5000;

-- Less than 5000
SELECT name, price FROM products WHERE price < 5000;

-- 5000 or greater
SELECT name, price FROM products WHERE price >= 5000;

-- 5000 or less
SELECT name, price FROM products WHERE price <= 5000;
```

`>` and `<` exclude the boundary value, while `>=` and `<=` include it.

## Topic 3: AND, OR, and NOT

`AND`, `OR`, and `NOT` are logical operators used to combine or reverse conditions in a SQL expression.

### AND

`AND` requires all connected conditions to be `TRUE` for a row to be returned.

```sql
SELECT name, category, price
FROM products
WHERE category = 'Electronics'
  AND price > 5000;
```

A product must satisfy both conditions.

### OR

`OR` requires at least one connected condition to be `TRUE` for a row to be returned.

```sql
SELECT name, category
FROM products
WHERE category = 'Furniture'
   OR category = 'Stationery';
```

A product may satisfy either condition.

### NOT

`NOT` reverses the truth value of a condition.

```sql
SELECT name, category
FROM products
WHERE NOT category = 'Electronics';
```

This returns products that do not satisfy `category = 'Electronics'`.

### Important: Logical Operator Precedence

> **Precedence rule: `( )` → `NOT` → `AND` → `OR`**

Parenthesized expressions are evaluated first. Without parentheses, `NOT` has higher precedence than `AND`, and `AND` has higher precedence than `OR`.

```sql
SELECT name, category, price, rating
FROM products
WHERE category = 'Electronics'
  AND (price > 10000 OR rating >= 4.5);
```

The expression inside the parentheses is evaluated as one logical group before it is combined with the `AND` condition.

> **Practical rule:** When mixing `AND` and `OR`, use parentheses to make the intended logic explicit instead of relying on implicit operator precedence.

For example, this query:

```sql
WHERE category = 'Electronics'
  AND price > 10000
  OR rating >= 4.5
```

is interpreted as:

```sql
WHERE (category = 'Electronics' AND price > 10000)
   OR rating >= 4.5
```

That can return highly rated products from other categories. Parentheses prevent this kind of logical mistake.

## Topic 4: IN and NOT IN

`IN` checks whether a value matches any value in a specified list, while `NOT IN` checks that it matches none of the values in that list.

Instead of repeating several `OR` conditions:

```sql
SELECT name, category
FROM products
WHERE category = 'Electronics'
   OR category = 'Furniture'
   OR category = 'Accessories';
```

use `IN`:

```sql
SELECT name, category
FROM products
WHERE category IN ('Electronics', 'Furniture', 'Accessories');
```

`IN` also works with numbers:

```sql
SELECT id, name
FROM products
WHERE id IN (1, 3, 5, 8);
```

`NOT IN` excludes all listed values:

```sql
SELECT name, category
FROM products
WHERE category NOT IN ('Electronics', 'Furniture');
```

Be careful with `NULL` inside a `NOT IN` list because comparisons involving `NULL` can evaluate to `UNKNOWN` and produce unexpected filtering behavior.

## Topic 5: BETWEEN and NOT BETWEEN

`BETWEEN` checks whether a value falls inside an inclusive range, meaning both the lower and upper boundaries are included.

```sql
SELECT name, price
FROM products
WHERE price BETWEEN 5000 AND 20000;
```

This is equivalent to:

```sql
SELECT name, price
FROM products
WHERE price >= 5000
  AND price <= 20000;
```

Therefore:

```text
5000   -> included
10000  -> included
20000  -> included
```

`NOT BETWEEN` returns values outside the range:

```sql
SELECT name, price
FROM products
WHERE price NOT BETWEEN 5000 AND 20000;
```

This is conceptually equivalent to:

```sql
WHERE price < 5000
   OR price > 20000;
```

For timestamp ranges, explicit half-open boundaries are often safer when the intention is to include an entire final day:

```sql
WHERE created_at >= '2026-09-01'
  AND created_at <  '2026-09-08';
```

## Topic 6: LIKE and ILIKE

`LIKE` performs text pattern matching using wildcard characters. In PostgreSQL, `LIKE` is case-sensitive, while `ILIKE` performs case-insensitive pattern matching.

Two important wildcard characters are:

| Wildcard | Meaning |
|---|---|
| `%` | Zero or more characters |
| `_` | Exactly one character |

### Starts With

```sql
SELECT name
FROM products
WHERE name LIKE 'Key%';
```

This matches values that begin with `Key`, such as `Keyboard`.

### Ends With

```sql
SELECT name
FROM products
WHERE name LIKE '%top';
```

This matches values ending in `top`, such as `Laptop`.

### Contains

```sql
SELECT name
FROM products
WHERE name LIKE '%o%';
```

This matches values containing lowercase `o` anywhere in the text.

### Exactly One Character

```sql
SELECT name
FROM products
WHERE name LIKE 'M_use';
```

The `_` wildcard represents exactly one character, so this can match `Mouse`.

### Case-Insensitive Matching

```sql
SELECT name
FROM products
WHERE name ILIKE 'key%';
```

This can match `Keyboard` even though the letter case differs. `ILIKE` is a PostgreSQL extension.

The conditions can also be reversed:

```sql
SELECT name
FROM products
WHERE name NOT ILIKE '%o%';
```

## Topic 7: NULL Behavior

`NULL` represents a missing, unknown, or unavailable value in SQL; it is not the same as zero, an empty string, `FALSE`, or the text `'NULL'`.

These values are different:

| Value | Is SQL NULL? | Meaning |
|---|---|---|
| `NULL` | Yes | Missing or unknown value |
| `0` | No | Known numeric value zero |
| `''` | No | Known empty text value |
| `' '` | No | Text containing a space |
| `FALSE` | No | Known Boolean false value |
| `'NULL'` | No | Text containing the letters NULL |

If a nullable column is omitted from an `INSERT` and it has no applicable default, PostgreSQL stores `NULL` for that column.

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT
);

INSERT INTO users (name)
VALUES ('Ali');
```

The `phone` value for that row is `NULL`, not an empty string.

If the column has a `DEFAULT`, omitting the column causes PostgreSQL to use the default instead.

### Three-Valued Logic

SQL conditions can evaluate to three logical states:

```text
TRUE
FALSE
UNKNOWN
```

Comparisons involving an unknown `NULL` value generally produce `UNKNOWN` rather than `TRUE` or `FALSE`.

For example:

```text
NULL = 4.5   -> UNKNOWN
NULL > 4.5   -> UNKNOWN
NULL < 4.5   -> UNKNOWN
NULL = NULL  -> UNKNOWN
```

A `WHERE` clause returns only rows whose condition evaluates to `TRUE`:

```text
TRUE     -> returned
FALSE    -> filtered out
UNKNOWN  -> filtered out
```

This is why normal equality and inequality comparisons should not be used to test whether a value is `NULL`.

## Topic 8: IS NULL and IS NOT NULL

`IS NULL` checks whether a value is `NULL`, while `IS NOT NULL` checks whether a value is present rather than `NULL`.

Do not write:

```sql
WHERE rating = NULL;
WHERE rating != NULL;
WHERE rating <> NULL;
```

Use:

```sql
SELECT name, rating
FROM products
WHERE rating IS NULL;
```

This returns rows with a missing rating.

To return rows that have a rating:

```sql
SELECT name, rating
FROM products
WHERE rating IS NOT NULL;
```

The practical rule is:

```text
Checking for a missing value     -> IS NULL
Checking for a non-missing value -> IS NOT NULL
```

A common real-world example is an order delivery timestamp:

```sql
SELECT *
FROM orders
WHERE delivered_at IS NULL;
```

This can represent orders that have not yet been delivered.

```sql
SELECT *
FROM orders
WHERE delivered_at IS NOT NULL;
```

This returns orders for which a delivery timestamp exists.
