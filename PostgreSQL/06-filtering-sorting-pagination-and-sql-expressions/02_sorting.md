# Sorting Data in PostgreSQL

## Topic 1: ORDER BY

`ORDER BY` is a SQL clause used to sort the rows returned by a query according to one or more columns or expressions.

Without `ORDER BY`, SQL does not guarantee that rows will be returned in any particular order. If an application requires a specific order, it should request that order explicitly.

Basic syntax:

```sql
SELECT column1, column2
FROM table_name
ORDER BY column1;
```

For example, suppose a `products` table contains product names and prices:

```sql
SELECT name, price
FROM products
ORDER BY price;
```

This sorts the result by `price`. Because no direction is specified, PostgreSQL uses ascending order by default.

`WHERE` and `ORDER BY` are commonly used together. `WHERE` first determines which rows belong in the result, and `ORDER BY` determines how those resulting rows are ordered.

```sql
SELECT name, category, price
FROM products
WHERE category = 'Electronics'
ORDER BY price DESC;
```

This returns only Electronics products and then sorts those products from the highest price to the lowest price.

---

## Topic 2: ASC

`ASC` means ascending order and sorts values from lower to higher according to the data type and applicable comparison/collation rules.

For numbers, ascending order means smallest to largest:

```text
100
500
2500
5000
20000
```

Example:

```sql
SELECT name, price
FROM products
ORDER BY price ASC;
```

For text, ascending order follows the database's text comparison and collation rules and is commonly thought of as A to Z.

```sql
SELECT name
FROM products
ORDER BY name ASC;
```

For dates and timestamps, ascending order means earlier values before later values.

```sql
SELECT id, created_at
FROM orders
ORDER BY created_at ASC;
```

`ASC` is the default sorting direction, so these two queries are equivalent:

```sql
SELECT name, price
FROM products
ORDER BY price;
```

```sql
SELECT name, price
FROM products
ORDER BY price ASC;
```

---

## Topic 3: DESC

`DESC` means descending order and sorts values from higher to lower according to the data type and applicable comparison/collation rules.

For numbers:

```text
20000
5000
2500
500
100
```

Example:

```sql
SELECT name, price
FROM products
ORDER BY price DESC;
```

This is useful for cases such as showing the most expensive products first.

For text, descending order reverses the ascending text order:

```sql
SELECT name
FROM products
ORDER BY name DESC;
```

For dates and timestamps, descending order is commonly used to show the newest records first:

```sql
SELECT id, created_at
FROM orders
ORDER BY created_at DESC;
```

A useful mental model is:

```text
ASC  → small to large, earlier to later
DESC → large to small, later to earlier
```

---

## Topic 4: Multiple-Column Sorting

Multiple-column sorting uses more than one expression in `ORDER BY`, with each later expression acting as a tie-breaker when all earlier sorting expressions are equal.

Example:

```sql
SELECT name, category, price
FROM products
ORDER BY category ASC, price DESC;
```

The sorting priority is determined from left to right:

```text
1st priority → category ASC
2nd priority → price DESC
```

PostgreSQL first sorts rows by `category`. When multiple rows have the same category, `price DESC` determines their order within that category.

For example:

```text
Accessories
  Watch       20000
  Backpack     6000

Electronics
  Laptop     120000
  Monitor     45000
  Keyboard     5000

Furniture
  Desk         15000
  Chair        10000
  Lamp          3000
```

The second sorting column does not conflict with or override the first column. It only sorts rows that are tied on the first sorting expression.

### Three-column sorting

```sql
SELECT name, category, price, rating
FROM products
ORDER BY category ASC, price DESC, rating DESC;
```

The priority is:

```text
1st → category ASC
2nd → price DESC
3rd → rating DESC
```

Suppose these rows exist:

```text
name             category       price    rating
Gaming Mouse A   Electronics    5000     4.2
Gaming Mouse B   Electronics    5000     4.8
Gaming Mouse C   Electronics    5000     4.5
```

All three rows have the same `category` and `price`, so the first two sorting expressions cannot decide their relative order. PostgreSQL then uses `rating DESC`:

```text
Gaming Mouse B   Electronics    5000    4.8
Gaming Mouse C   Electronics    5000    4.5
Gaming Mouse A   Electronics    5000    4.2
```

If two rows have different prices, the price expression decides their order before PostgreSQL needs to consider rating.

For example:

```text
Headphones       Electronics    8000    4.1
Gaming Mouse B   Electronics    5000    4.8
```

Even though `Gaming Mouse B` has the higher rating, `Headphones` remains first because `price DESC` has higher priority than `rating DESC`.

### Important Rule: Sorting Priority and Tie-Breaking

> **In a multiple-column `ORDER BY`, PostgreSQL evaluates sorting expressions from left to right. A later expression is used only when all earlier expressions are tied. A later sorting column never overrides an earlier sorting column.**

For:

```sql
ORDER BY category ASC, price DESC, rating DESC;
```

The decision process can be understood as:

```text
Are the categories different?
    YES → category decides the order.
    NO  ↓

Are the prices different?
    YES → price decides the order.
    NO  ↓

Use rating to break the remaining tie.
```

This same rule continues for any additional sorting expressions:

```sql
ORDER BY category ASC, price DESC, rating DESC, name ASC;
```

Priority:

```text
category → price → rating → name
   1st       2nd      3rd      4th
```

Each later expression only resolves ties left by everything before it.
