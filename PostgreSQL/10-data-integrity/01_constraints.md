# Stage 10 — Data Integrity
## Section 1 — Constraints

## 1. Why constraints exist

Without database constraints, invalid data can enter the database.

Examples:

```text
duplicate user IDs
NULL customer names
negative prices
duplicate emails
orders pointing to customers that do not exist
```

Application validation helps, but applications can have bugs, multiple services may write to the same database, and someone may also run SQL directly.

Constraints place important rules inside the database itself.

## 2. Definition

A **constraint** is a rule enforced by the database that restricts what data is allowed to be stored.

Mental model:

```text
Application sends data
        ↓
PostgreSQL checks constraints
        ↓
Valid   → store it
Invalid → reject it
```

Constraints are one of the main tools used to protect **data integrity**.

---

# 3. `PRIMARY KEY`

A `PRIMARY KEY` uniquely identifies each row in a table.

```sql
CREATE TABLE customers (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL
);
```

Important properties:

```text
PRIMARY KEY
→ UNIQUE
→ NOT NULL
→ officially identifies each row
```

A table has one primary-key constraint, although that primary key can later contain multiple columns.

## `PRIMARY KEY` vs `UNIQUE NOT NULL`

This:

```sql
id BIGINT UNIQUE NOT NULL
```

enforces the two main value rules of a primary key:

```text
unique
not null
```

But PostgreSQL still does not treat it as the table's actual `PRIMARY KEY` constraint.

This:

```sql
id BIGINT PRIMARY KEY
```

formally declares that column as the table's main identifier.

So:

```text
UNIQUE + NOT NULL
→ similar value behavior

PRIMARY KEY
→ unique + non-null + formally designated row identifier
```

---

# 4. `FOREIGN KEY`

A `FOREIGN KEY` creates and protects a relationship between tables.

Example:

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,

    customer_id BIGINT
        REFERENCES customers(id)
);
```

The relationship is:

```text
orders.customer_id
        ↓
customers.id
```

If an order contains:

```text
customer_id = 5
```

then a matching referenced customer must exist:

```text
customers.id = 5
```

This is one of the main mechanisms PostgreSQL uses to enforce **referential integrity**.

---

# 5. `NOT NULL`

`NOT NULL` means a column must contain a value.

```sql
name TEXT NOT NULL
```

PostgreSQL rejects:

```sql
INSERT INTO customers (id, name)
VALUES (1, NULL);
```

Use `NOT NULL` when the absence of a value would make the row invalid.

---

# 6. `UNIQUE`

`UNIQUE` prevents duplicate values in a column or group of columns.

Example:

```sql
email TEXT UNIQUE
```

Valid:

```text
samad@gmail.com
ali@gmail.com
```

Invalid:

```text
samad@gmail.com
samad@gmail.com
```

## Important PostgreSQL detail: `NULL`

A normal PostgreSQL `UNIQUE` constraint can allow multiple `NULL` values because `NULL` represents an unknown or missing value and is not normally considered equal to another `NULL`.

If the value is required as well as unique:

```sql
email TEXT UNIQUE NOT NULL
```

---

# 7. `CHECK`

`CHECK` enforces a condition on stored data.

Example:

```sql
price NUMERIC CHECK (price >= 0)
```

PostgreSQL rejects:

```sql
INSERT INTO products (price)
VALUES (-500);
```

Another example:

```sql
CHECK (age >= 18)
```

A `CHECK` can also compare multiple columns:

```sql
CHECK (discount_price <= original_price)
```

Mental model:

> A `CHECK` constraint is a boolean rule that stored rows must satisfy.

This becomes especially useful for database-level business rules.

---

# 8. `DEFAULT`

`DEFAULT` supplies a value automatically when an `INSERT` does not provide one.

Example:

```sql
status TEXT DEFAULT 'PENDING'
```

Then:

```sql
INSERT INTO orders (customer_id)
VALUES (1);
```

can store:

```text
status = 'PENDING'
```

## Important distinction

If the application explicitly sends:

```sql
INSERT INTO orders (customer_id, status)
VALUES (1, NULL);
```

PostgreSQL does not automatically replace that explicit `NULL` with `'PENDING'`.

If `NULL` should also be forbidden:

```sql
status TEXT NOT NULL DEFAULT 'PENDING'
```

## Technical note

In PostgreSQL, `DEFAULT` is technically a column default rather than a constraint object, but it is commonly taught alongside constraints because it controls stored-data behavior.

---

# 9. One table combining the main rules

```sql
CREATE TABLE constraint_products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name TEXT NOT NULL,

    sku TEXT UNIQUE NOT NULL,

    price NUMERIC(10,2)
        NOT NULL
        CHECK (price >= 0),

    stock INTEGER
        NOT NULL
        DEFAULT 0
        CHECK (stock >= 0),

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE
);
```

What PostgreSQL guarantees:

```text
id
→ unique + non-null identifier

name
→ required

sku
→ required and unique

price
→ required and cannot be negative

stock
→ required, defaults to 0, cannot be negative

is_active
→ required, defaults to TRUE
```

---

# 10. Quick constraint mapping

```text
Problem:
Every product must have a name.
Solution:
NOT NULL
```

```text
Problem:
Two users cannot have the same email.
Solution:
UNIQUE
```

```text
Problem:
Product price cannot be below zero.
Solution:
CHECK (price >= 0)
```

```text
Problem:
New orders should automatically start as PENDING.
Solution:
DEFAULT 'PENDING'
```

```text
Problem:
Every order must reference a real customer.
Solution:
FOREIGN KEY
```

```text
Problem:
Every row needs an official unique identifier.
Solution:
PRIMARY KEY
```

---

# 11. Final mental model

```text
PRIMARY KEY
→ official unique row identifier

FOREIGN KEY
→ valid relationship to another table

NOT NULL
→ value is required

UNIQUE
→ duplicate values are not allowed

CHECK
→ custom boolean rule for stored data

DEFAULT
→ automatic fallback value when one is omitted
```
