# Stage 9 — CTEs and Data Modification

## 1. Problem CTEs solve

CTEs help when SQL logic has several steps, nested queries become difficult to read, or an intermediate result must be reused by a final `SELECT`, `INSERT`, `UPDATE`, or `DELETE`.

## 2. Definition

A **Common Table Expression (CTE)** is a temporary named result set defined with `WITH` and available only to the SQL statement that follows it.

```sql
WITH cte_name AS (
    SELECT ...
)
SELECT ...
FROM cte_name;
```

Mental model:

```text
WITH
→ prepare a named result set

main statement
→ use that result
```

## 3. Basic CTE

```sql
WITH category_stats AS (
    SELECT
        category,
        COUNT(*) AS total_products,
        AVG(price) AS average_price
    FROM query_products
    GROUP BY category
)
SELECT *
FROM category_stats
WHERE average_price > 5000;
```

The CTE result behaves like a temporary table for that statement.

## 4. Scope

Defining a CTE does not automatically make its columns directly available everywhere. The main query normally has to reference the CTE through `FROM`, `JOIN`, or another valid construct.

## 5. Multiple CTEs

```sql
WITH category_counts AS (
    SELECT
        category,
        COUNT(*) AS total_products
    FROM query_products
    GROUP BY category
),
average_count AS (
    SELECT
        AVG(total_products) AS overall_avg
    FROM category_counts
)
SELECT
    cc.category,
    cc.total_products
FROM category_counts AS cc
CROSS JOIN average_count AS ac
WHERE cc.total_products > ac.overall_avg;
```

A later CTE can use an earlier CTE.

## 6. CTE + JOIN

```sql
WITH customer_spending AS (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
)
SELECT
    c.name,
    cs.total_spent
FROM join_customers AS c
INNER JOIN customer_spending AS cs
    ON c.id = cs.customer_id;
```

Mental model:

```text
CTE
→ prepare/summarize data

JOIN
→ combine it with another table
```

## 7. CTE + aggregation

```sql
WITH order_stats AS (
    SELECT
        customer_id,
        COUNT(*) AS total_orders,
        SUM(total) AS total_spent,
        MAX(total) AS highest_order
    FROM join_orders
    GROUP BY customer_id
)
SELECT *
FROM order_stats
WHERE total_orders >= 2;
```

---

# 8. `INSERT ... SELECT`

## Problem

Sometimes rows already exist or can be calculated elsewhere, and we want to insert those query results into another table.

## Definition

`INSERT ... SELECT` inserts rows produced by a `SELECT` query into a target table.

```sql
INSERT INTO target_table (
    column1,
    column2
)
SELECT
    source_column1,
    source_column2
FROM source_table;
```

Mental model:

```text
SELECT
→ produces rows

INSERT INTO
→ stores those rows as NEW rows in the target
```

### Example with a CTE

```sql
WITH customer_spending AS (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
)
INSERT INTO high_value_customers (
    customer_id,
    total_spent
)
SELECT
    customer_id,
    total_spent
FROM customer_spending
WHERE total_spent > 5000
RETURNING customer_id, total_spent;
```

Roles:

```text
high_value_customers
→ target

customer_spending
→ source

SELECT
→ produces rows

INSERT
→ creates those rows in target
```

Important:
- target column count must match selected column count
- column order must correspond
- data types must be compatible

The CTE is optional. `INSERT ... SELECT` also works directly from a real table or query.

---

# 9. `UPDATE ... FROM`

## Problem

Sometimes a target row must be updated using information stored or calculated somewhere else.

Example:

> Set `is_high_value = TRUE` based on total spending calculated from orders.

## Definition

PostgreSQL's `UPDATE ... FROM` syntax updates rows in a target table while using another table or table-like result as supporting data.

```sql
UPDATE target_table
SET column = value
FROM source_table
WHERE matching_condition;
```

Mental model:

```text
UPDATE
→ target table to modify

SET
→ new value

FROM
→ supporting source data

WHERE
→ match target rows to source rows
  and apply conditions
```

## Is this like a JOIN?

Conceptually, yes.

```text
SELECT + JOIN
→ match rows and READ them

UPDATE + FROM
→ match rows and MODIFY target rows
```

Normal join:

```sql
SELECT *
FROM customers AS c
JOIN spending AS s
    ON c.id = s.customer_id;
```

Update version:

```sql
UPDATE customers AS c
SET ...
FROM spending AS s
WHERE c.id = s.customer_id;
```

The matching condition appears in `WHERE` rather than `ON`.

### Example without a CTE

```sql
UPDATE customers AS c
SET city_name = ci.name
FROM cities AS ci
WHERE c.city_id = ci.id;
```

### Example with a CTE

```sql
WITH customer_spending AS (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
)
UPDATE join_customers AS c
SET is_high_value = TRUE
FROM customer_spending AS cs
WHERE c.id = cs.customer_id
  AND cs.total_spent > 5000
RETURNING
    c.id,
    c.name,
    c.is_high_value;
```

Roles:

```text
join_customers
→ target table

customer_spending
→ source result

c.id = cs.customer_id
→ matching relationship

cs.total_spent > 5000
→ business condition
```

The CTE is optional. `FROM` can use a real table, CTE, or derived table.

---

# 10. `DELETE ... USING`

## Problem

Sometimes another table or query result is needed to determine which target rows should be deleted.

## Definition

PostgreSQL's `DELETE ... USING` syntax deletes rows from a target table while using another table or result set to help identify matching target rows.

```sql
DELETE FROM target_table
USING source_table
WHERE matching_condition;
```

Mental model:

```text
DELETE FROM
→ target table

USING
→ supporting source

WHERE
→ match source and target
  and decide which target rows qualify
```

### Example

```sql
WITH customer_spending AS (
    SELECT
        customer_id,
        SUM(total) AS total_spent
    FROM join_orders
    GROUP BY customer_id
)
DELETE FROM join_customers AS c
USING customer_spending AS cs
WHERE c.id = cs.customer_id
  AND cs.total_spent < 4000
RETURNING c.id, c.name;
```

Important:

The source rows are **not copied**. They only help identify target rows to remove.

---

# 11. Compare the three confusing patterns

## `INSERT ... SELECT`

```text
source query
→ produces rows
→ rows become NEW target rows
```

## `UPDATE ... FROM`

```text
source table/result
→ helps match target rows
→ existing target rows are MODIFIED
```

## `DELETE ... USING`

```text
source table/result
→ helps match target rows
→ existing target rows are REMOVED
```

Compact rule:

```text
INSERT ... SELECT
→ source rows become new target rows

UPDATE ... FROM
→ source helps modify target rows

DELETE ... USING
→ source helps delete target rows
```

---

# 12. Referential-integrity error encountered in practice

A `DELETE ... USING` statement can be syntactically correct but still fail because of a foreign key.

Example situation:

```text
join_customers.id = 3
↑
still referenced by
join_orders.customer_id = 3
```

PostgreSQL blocks deletion to prevent an order from referencing a customer that no longer exists.

This is a **referential integrity** issue, not a CTE issue.

Deeper topics such as:
- `ON DELETE`
- `ON UPDATE`
- `CASCADE`
- `RESTRICT`
- `SET NULL`

belong to the later Data Integrity module.

---

# 13. Recursive CTEs

## Problem

Some data forms a hierarchy with an unknown number of levels.

Examples:

```text
category
→ subcategory
→ subcategory
→ ...
```

```text
folder
→ subfolder
→ deeper folder
→ ...
```

```text
comment
→ reply
→ reply to reply
→ ...
```

A fixed number of joins can only handle a fixed number of levels.

## Hierarchical data

**Hierarchical data** is data arranged in levels where one item can be the parent of another item.

Example:

```text
Electronics
├── Computers
│   ├── Laptops
│   └── Desktops
└── Mobiles
```

## How the tree is stored

SQL stores normal rows plus a parent reference.

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id)
);
```

Example:

```text
id | name         | parent_id
---+--------------+----------
1  | Electronics  | NULL
2  | Computers    | 1
3  | Mobiles      | 1
4  | Laptops      | 2
5  | Desktops     | 2
```

This logically forms:

```text
Electronics
├── Computers
│   ├── Laptops
│   └── Desktops
└── Mobiles
```

## Comment example

```text
Comment 1: Great post!
├── Comment 2: Thanks!
│   ├── Comment 4: You're welcome
│   └── Comment 5: Nice explanation
└── Comment 3: I agree
    └── Comment 6: Same here
        └── Comment 7: Exactly
```

## Definition

A **recursive CTE** is a CTE that repeatedly references its previous result to traverse hierarchical data whose depth is not known beforehand.

Mental model:

```text
start with first level
→ find children

take those children
→ find their children

repeat
→ stop when no more rows are found
```

For this stage, understanding the problem and mental model is enough.

---

# 14. Final Stage 9 mental model

```text
CTE
→ named temporary result

Multiple CTEs
→ several named intermediate steps

CTE + JOIN
→ combine prepared data with other tables

CTE + aggregation
→ summarize first, then continue processing

INSERT ... SELECT
→ query results create new rows

UPDATE ... FROM
→ source helps modify existing rows

DELETE ... USING
→ source helps remove existing rows

Recursive CTE
→ repeatedly traverse hierarchical levels
```
