# Stage 12 — Database Performance
## 03 — Practical Indexing

## 1. Single-Column Index

A single-column index contains one column.

```sql
CREATE INDEX idx_users_email
ON users(email);
```

A table can have several separate single-column indexes.

---

## 2. Composite Index

A **composite index is one index containing multiple columns together**.

```sql
CREATE INDEX idx_orders_customer_status
ON orders(customer_id, status);
```

Useful for:

```sql
WHERE customer_id = 100
  AND status = 'PAID'
```

Two separate indexes:

```text
INDEX(customer_id)
INDEX(status)
```

are different from one composite index:

```text
INDEX(customer_id, status)
```

---

## 3. Composite Index Column Order

Column order matters.

```text
INDEX(customer_id, status)
```

naturally fits:

```sql
WHERE customer_id = 100;
```

and:

```sql
WHERE customer_id = 100
AND status = 'PAID';
```

It is generally less suitable for:

```sql
WHERE status = 'PAID';
```

alone.

Mental model:

```text
INDEX(A, B, C)

naturally fits:
A
A + B
A + B + C
```

This is the practical leftmost-prefix idea.

---

## 4. Indexes for `WHERE`

Indexes can help frequent, selective filters on large tables.

Example:

```sql
SELECT *
FROM users
WHERE email = 'samad@gmail.com';
```

Possible index:

```sql
CREATE INDEX idx_users_email
ON users(email);
```

Do not automatically index every column appearing in `WHERE`.

---

## 5. Indexes for `JOIN`

Example:

```sql
SELECT *
FROM customers c
JOIN orders o
ON o.customer_id = c.id;
```

`customers.id` is normally indexed because it is a primary key.

`orders.customer_id` is a foreign key, but PostgreSQL does **not automatically create an index on the referencing foreign-key column**.

Possible index:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

---

## 6. Indexes for `ORDER BY`

B-tree indexes can help PostgreSQL return rows in useful order.

Example:

```sql
SELECT *
FROM orders
ORDER BY created_at DESC
LIMIT 20;
```

Possible index:

```sql
CREATE INDEX idx_orders_created_at
ON orders(created_at);
```

`ORDER BY + LIMIT` can be especially useful with an index.

### `WHERE` + `ORDER BY`

```sql
SELECT *
FROM orders
WHERE restaurant_id = 5
ORDER BY created_at DESC
LIMIT 20;
```

Possible composite index:

```sql
CREATE INDEX idx_orders_restaurant_created
ON orders(restaurant_id, created_at DESC);
```

---

## 7. Foreign-Key Indexes

PostgreSQL does not automatically create an index on every foreign-key column.

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(id)
);
```

If `orders.customer_id` is frequently queried or joined:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

---

## 8. Unique Indexes

A **unique index** is a normal index plus a rule: no two rows may have the same indexed value.

| | Normal index | Unique index |
|---|---|---|
| Speeds up lookups | yes | yes |
| Allows duplicates | yes | **no** |

```sql
CREATE UNIQUE INDEX idx_users_email ON users (email);
```

Duplicates are rejected during `INSERT` or `UPDATE` with error code `23505`.

### Unique constraint vs unique index

```sql
email TEXT UNIQUE
-- same as
CONSTRAINT users_email_key UNIQUE (email)
```

A `UNIQUE` constraint is enforced by a unique index that Postgres builds for you. They behave the same, but they differ in what you can write:

| | `UNIQUE` constraint | `CREATE UNIQUE INDEX` |
|---|---|---|
| Rejects duplicates | yes | yes |
| Can have a `WHERE` condition (partial) | **no** | **yes** |
| Can use an expression, e.g. `lower(email)` | **no** | **yes** |

Rule of thumb:
- Unique among all rows, no exceptions: use a `UNIQUE` constraint.
- Unique among only some rows, or on an expression: use a unique index.

### Partial unique index

Add `WHERE` and only rows matching the condition are indexed, so only they are checked for duplicates.

```sql
CREATE UNIQUE INDEX bookings_one_active_per_slot
ON bookings (slot_id)
WHERE status = 'confirmed';
```

Read it as: *among confirmed bookings, `slot_id` must be unique.*

### Example: why BookEasy needs a partial index

Rule: a slot can have only one **active** booking. Cancelled bookings are kept as history and don't count.

```text
Step 1  Ali books slot 1           id=1  slot_id=1  confirmed
Step 2  Ali cancels                id=1  slot_id=1  cancelled
Step 3  Sara books slot 1 again    id=1  slot_id=1  cancelled
                                   id=2  slot_id=1  confirmed
```

`slot_id = 1` appears twice at the end, and that is correct.

**With `UNIQUE (slot_id)`**: Step 3 fails, because `slot_id = 1` already exists in row 1. A cancelled slot could never be rebooked.
```text
ERROR: duplicate key value violates unique constraint "bookings_a_slot_id_key"
```

**With the partial unique index**: Step 3 works, because row 1 is cancelled and not in the index. A second *confirmed* booking for the same slot is still rejected:
```text
ERROR: duplicate key value violates unique constraint "bookings_one_active_per_slot"
```

This also stops double booking when two people click "Book" at the same moment. The database refuses the second insert whatever the app code does. The service catches error `23505` and returns `409 SLOT_TAKEN`.

### Expression unique index

Make emails unique ignoring upper and lower case:
```sql
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));
```
`Ali@x.com` and `ali@x.com` now count as the same email.

---

## 9. Partial Indexes

A **partial index contains only rows satisfying a condition**.

```sql
CREATE INDEX idx_pending_orders
ON orders(created_at)
WHERE status = 'PENDING';
```

Meaning:

```text
indexed column → created_at
only include rows where status = 'PENDING'
```

Useful for targeted subsets such as pending orders or active jobs.

---

## 10. Expression Indexes

An **expression index stores the result of an expression instead of the raw column value**.

```sql
CREATE INDEX idx_users_lower_email
ON users(LOWER(email));
```

Example:

```text
Table value:
Samad@Gmail.com

Index value:
samad@gmail.com
```

Useful for:

```sql
WHERE LOWER(email) = 'samad@gmail.com'
```

The table value itself is unchanged.

---

## 11. Covering Indexes / `INCLUDE`

A covering index stores the search key plus extra values needed by the query.

```sql
CREATE INDEX idx_orders_customer
ON orders(customer_id)
INCLUDE (status, total);
```

Meaning:

```text
search key:
customer_id

extra stored values:
status
total
```

Useful for:

```sql
SELECT customer_id, status, total
FROM orders
WHERE customer_id = 100;
```

---

## 12. Index-Only Scan

An **Index-Only Scan means PostgreSQL may obtain the required values directly from the index instead of fetching the full table row**.

Normal Index Scan:

```text
index
→ find row location
→ visit table
→ get data
```

Possible Index-Only Scan:

```text
index
→ required values already present
→ return result
```

A covering index using `INCLUDE` can make this possible.
