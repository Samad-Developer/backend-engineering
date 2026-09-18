# Stage 10 — Data Integrity
## Section 2 — Foreign-Key Actions & Referential Integrity

## 1. Referential integrity

### Definition

**Referential integrity** means relationships between tables remain valid.

Example:

```text
orders.customer_id = 5
```

is valid only if:

```text
customers.id = 5
```

exists, unless the foreign key is allowed to be `NULL`.

A foreign key is the main mechanism PostgreSQL uses to enforce this relationship.

---

# 2. Rules that keep references valid

Referential integrity is preserved by rules such as:

1. A foreign-key value must reference an existing parent key.
2. A nullable foreign key may contain `NULL`, meaning no reference.
3. A parent key cannot be deleted or changed in a way that would leave invalid child references unless an appropriate foreign-key action handles it.

Example relationship:

```text
Parent table
customers.id
     ↑
     │ referenced by
     │
Child table
orders.customer_id
```

---

# 3. What foreign-key actions control

Foreign-key actions answer this question:

> When something happens to the parent row or referenced parent key, what should PostgreSQL do to the child row that contains the foreign key?

Important:

```text
ON DELETE ...
→ parent row is deleted
→ action controls what happens to child rows / child foreign keys

ON UPDATE ...
→ referenced parent key changes
→ action controls what happens to child foreign keys
```

The action is mainly about protecting the **child-side reference** after a change to the parent.

---

# 4. Default foreign-key action

If no explicit action is written:

```sql
customer_id BIGINT
REFERENCES customers(id)
```

PostgreSQL uses:

```sql
ON DELETE NO ACTION
ON UPDATE NO ACTION
```

In simple cases, `NO ACTION` behaves similarly to `RESTRICT`: PostgreSQL prevents the parent change if it would violate the foreign key.

The technical difference is timing:

- `NO ACTION` can participate in deferred constraint checking in some cases.
- `RESTRICT` rejects the change immediately.

---

# 5. `ON DELETE CASCADE`

## Problem

Suppose:

```text
customers
1 | Ali
```

and:

```text
orders
101 | customer_id = 1
102 | customer_id = 1
```

If customer `1` is deleted, the orders would otherwise reference a customer that no longer exists.

## Definition

`ON DELETE CASCADE` means:

> When the parent row is deleted, automatically delete all child rows that reference it.

Example:

```sql
CREATE TABLE customers (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id BIGINT PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES customers(id)
        ON DELETE CASCADE
);
```

Deleting:

```sql
DELETE FROM customers
WHERE id = 1;
```

causes:

```text
Customer 1
→ deleted

Order 101
→ automatically deleted

Order 102
→ automatically deleted
```

Mental model:

```text
delete parent
→ find referencing children
→ delete those children too
```

Use `CASCADE` when child rows should not exist independently of the parent.

## Warning

Cascades can delete many rows automatically. Use them only when that behavior matches the data model.

---

# 6. `ON DELETE RESTRICT`

## Definition

`ON DELETE RESTRICT` means:

> Do not allow the parent row to be deleted while child rows still reference it.

Example:

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES customers(id)
        ON DELETE RESTRICT
);
```

If:

```text
Ali
├── Order 101
└── Order 102
```

then:

```sql
DELETE FROM customers
WHERE id = 1;
```

is blocked.

Mental model:

```text
delete parent requested
        ↓
PostgreSQL checks children
        ↓
referencing children exist
        ↓
delete is rejected
```

---

# 7. Changing a foreign-key action

PostgreSQL does not normally let you edit only the action of an existing foreign-key constraint in place.

The usual pattern is:

```text
drop old foreign-key constraint
→ recreate it with the desired action
```

Inspect the table in `psql`:

```psql
\d orders
```

Suppose the constraint is:

```text
orders_customer_id_fkey
```

Drop it:

```sql
ALTER TABLE orders
DROP CONSTRAINT orders_customer_id_fkey;
```

Recreate it:

```sql
ALTER TABLE orders
ADD CONSTRAINT orders_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES customers(id)
ON DELETE RESTRICT;
```

---

# 8. `ON DELETE SET NULL`

## Problem

Sometimes the parent should be removable, but the child record should remain for historical or business reasons.

## Definition

`ON DELETE SET NULL` means:

> When the parent row is deleted, keep the child row but set its foreign-key column to `NULL`.

Example:

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,

    customer_id BIGINT
        REFERENCES customers(id)
        ON DELETE SET NULL
);
```

Before:

```text
orders
101 | customer_id = 1 | total = 5000
102 | customer_id = 1 | total = 3000
```

After deleting customer `1`:

```text
orders
101 | customer_id = NULL | total = 5000
102 | customer_id = NULL | total = 3000
```

Only the foreign-key column becomes `NULL`. Other child columns remain unchanged.

## Important requirement

The foreign-key column must allow `NULL`.

If it currently has `NOT NULL`:

```sql
ALTER TABLE orders
ALTER COLUMN customer_id DROP NOT NULL;
```

Then recreate the foreign key with:

```sql
ON DELETE SET NULL
```

---

# 9. Comparing delete actions

```text
ON DELETE CASCADE
→ delete parent
→ delete child rows
```

```text
ON DELETE RESTRICT
→ child rows exist
→ block parent deletion
```

```text
ON DELETE SET NULL
→ delete parent
→ keep child rows
→ set child foreign key to NULL
```

The parent is where the original delete happens. The action determines what happens to the child-side relationship.

---

# 10. `ON UPDATE`

## Problem

Suppose:

```text
customers.id = 1
```

is referenced by:

```text
orders.customer_id = 1
```

Now the referenced parent key changes:

```text
customers.id
1 → 10
```

Without a suitable action, child rows would still contain `1`, which would no longer reference the parent.

## Definition

`ON UPDATE` defines what PostgreSQL should do to child foreign-key values when the referenced parent key changes.

---

# 11. `ON UPDATE CASCADE`

Create practice tables:

```sql
CREATE TABLE update_customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE update_orders (
    id INTEGER PRIMARY KEY,

    customer_id INTEGER
        REFERENCES update_customers(id)
        ON UPDATE CASCADE,

    total NUMERIC(10,2)
);
```

Insert data:

```sql
INSERT INTO update_customers (id, name)
VALUES
    (1, 'Ali'),
    (2, 'Samad');
```

```sql
INSERT INTO update_orders (id, customer_id, total)
VALUES
    (101, 1, 5000),
    (102, 1, 3000),
    (103, 2, 8000);
```

Update the parent key:

```sql
UPDATE update_customers
SET id = 10
WHERE id = 1;
```

PostgreSQL automatically changes child references:

```text
Before
customers.id = 1
orders.customer_id = 1

After
customers.id = 10
orders.customer_id = 10
```

Mental model:

```text
parent referenced key changes
1 → 10

ON UPDATE CASCADE
        ↓
child foreign keys change automatically
1 → 10
```

---

# 12. Other `ON UPDATE` actions

```text
ON UPDATE CASCADE
→ update child foreign key automatically

ON UPDATE RESTRICT
→ block changing parent key while children reference it

ON UPDATE SET NULL
→ keep child row, set its foreign key to NULL

ON UPDATE NO ACTION
→ default behavior
```

In many real systems, generated primary keys and UUIDs rarely change, so `ON UPDATE` is usually encountered less often than `ON DELETE`.

---

# 13. Parent vs child mental model

Always identify the two sides first.

```text
customers.id
→ parent / referenced key
```

```text
orders.customer_id
→ child / foreign key
```

Then ask:

```text
What happened to the parent?

DELETE?
→ use ON DELETE rule

UPDATE referenced key?
→ use ON UPDATE rule
```

Then ask:

```text
What should happen to the child reference?

Delete child?
→ CASCADE

Block parent operation?
→ RESTRICT

Keep child but remove reference?
→ SET NULL
```

---

# 14. Final mental model

```text
Referential integrity
→ relationships between tables remain valid

FOREIGN KEY
→ enforces that relationship

ON DELETE
→ handles parent deletion

ON UPDATE
→ handles referenced parent-key changes

CASCADE
→ propagate the operation to the child

RESTRICT
→ block the parent operation

SET NULL
→ keep the child row but remove its reference

NO ACTION
→ PostgreSQL default
```
