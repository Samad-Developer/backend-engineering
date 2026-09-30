# Stage 15 — Database Migrations

## Module 15 — Schema Evolution

# 03 — Production Safety

This section covers how to apply schema changes safely in production where real users, real data, and running application instances are involved.

---

## 1. Safe Schema Changes

**Definition:**  
A safe schema change is a database change designed to avoid breaking running application code, invalidating existing data, or blocking production traffic for too long.

A migration can be valid SQL but still be unsafe in production.

Before a production migration, ask:

```text
Will existing data satisfy the new schema?
Will the currently running application still work?
Could this migration lock a large table?
Could this change destroy data?
```

### Example — adding a nullable column

```sql
ALTER TABLE customers
ADD COLUMN phone TEXT;
```

This is usually relatively safe because existing rows simply get `NULL` and old code does not depend on the new column.

With `node-pg-migrate`:

```ts
pgm.addColumn("customers", {
  phone: {
    type: "text",
  },
});
```

### Risky example — adding `NOT NULL` immediately

```sql
ALTER TABLE customers
ADD COLUMN phone TEXT NOT NULL;
```

If existing rows do not have a value for `phone`, the migration can fail.

Safer sequence:

```text
1. Add phone as nullable
2. Deploy code that writes phone
3. Backfill existing rows
4. Verify no NULL values remain
5. Add NOT NULL
```

### Destructive example — dropping a column

```sql
ALTER TABLE customers
DROP COLUMN full_name;
```

This can destroy stored data and break old application code.

---

## 2. Migration Ordering

**Definition:**  
Migration ordering is the required sequence in which schema, data, and application changes must happen so every intermediate database state remains valid.

Basic dependency example:

```text
001_add_status_column
↓
002_create_status_index
```

The index cannot be created before the column exists.

### Production example

```text
001_add_status_nullable
↓
deploy code that writes status
↓
002_backfill_status
↓
verify existing rows
↓
003_make_status_not_null
```

The production sequence may therefore include schema changes, data changes, and application deployments—not just migration file numbers.

### Important rule

Already-applied migrations should be treated as immutable history.

If production has:

```text
001
002
003
```

and another change is required, create:

```text
004_new_change
```

Do not silently rewrite or reorder old production migrations.

---

## 3. Migration Conflicts

**Definition:**  
A migration conflict occurs when multiple schema changes collide or when a migration is written against a database state that is no longer current.

### Example — two developers change the same column

Developer A:

```sql
ALTER TABLE customers
ADD COLUMN phone TEXT;
```

Developer B:

```sql
ALTER TABLE customers
ADD COLUMN phone VARCHAR(20);
```

After merge:

```text
Migration A adds phone
↓
Migration B tries to add phone again
↓
ERROR
```

Different timestamps prevent filename collisions but not logical conflicts.

### Git conflict vs migration conflict

```text
No Git merge conflict
≠
No database migration conflict
```

### Team workflow

```text
pull latest migrations
↓
merge/rebase branch
↓
inspect migration order
↓
run the full migration chain
↓
test application
↓
merge/deploy
```

A useful test is whether a fresh database can run the entire migration history successfully from beginning to end.

If an already-applied migration later proves wrong, create a new corrective migration instead of rewriting shared history.

Example:

```text
004_add_phone
005_make_phone_unique
006_remove_phone_unique
```

---

## 4. Rollback Strategies

**Definition:**  
A rollback strategy is the plan for returning the system to a safe state when a migration or deployment causes a problem.

Rollback does not always mean:

```bash
pnpm migrate down
```

### Strategy 1 — `down()` migration

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.addColumn("customers", {
    phone: {
      type: "text",
    },
  });
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropColumn("customers", "phone");
}
```

Local rollback:

```bash
pnpm migrate down
```

This is useful only when reversing the change is truly safe.

### Important danger

If users already stored phone numbers, dropping the column destroys that data.

```text
schema rollback succeeded
≠
business data was safely preserved
```

### Strategy 2 — forward fix

Create another migration that corrects the problem.

```text
104_add_phone_as_varchar_10
↓
105_expand_phone_to_varchar_20
```

This preserves migration history and avoids destructive rollback.

### Strategy 3 — application rollback

If the database change is backward-compatible but the new backend has a bug:

```text
keep DB migration
↓
redeploy previous backend version
```

### Strategy 4 — backup / restore

For severe destructive failures, recovery may involve database backups, point-in-time recovery, or PostgreSQL restore tools.

### Transaction rollback vs deployment rollback

If a migration fails while its transaction is still open, PostgreSQL can roll back that migration transaction.

If the migration already committed and the problem is discovered later, a separate recovery strategy is needed.

Mental model:

```text
Migration fails while running
→ transaction rollback

Migration succeeds but schema is wrong
→ down migration or forward fix

Application code is broken
→ application rollback

Data/schema is seriously damaged
→ backup / recovery
```

---

## 5. Backward-Compatible Migrations

**Definition:**  
A backward-compatible migration changes the database in a way that old and new application versions can both keep working during deployment.

Production deployment is rarely instantaneous, so both application versions may temporarily exist:

```text
old backend version
+
new backend version
```

### Example — rename `name` to `full_name`

A direct rename:

```sql
ALTER TABLE customers
RENAME COLUMN name TO full_name;
```

can immediately break old code that still queries `name`.

A safer pattern is:

```text
EXPAND
↓
MIGRATE
↓
CONTRACT
```

### Step 1 — Expand

Add the new column without deleting the old one.

```ts
pgm.addColumn("customers", {
  full_name: {
    type: "text",
  },
});
```

Now both columns exist:

```text
customers
- id
- name
- full_name
```

### Step 2 — Migrate / backfill data

```sql
UPDATE customers
SET full_name = name
WHERE full_name IS NULL;
```

Important distinction:

```text
Schema migration
→ changes database structure

Data migration
→ changes existing stored data
```

### Step 3 — Deploy new application code

New code starts using `full_name` while the old column still exists.

### Step 4 — Verify

Confirm nothing still depends on `name`.

### Step 5 — Contract

Create a later migration:

```ts
pgm.dropColumn("customers", "name");
```

Final schema:

```text
customers
- id
- full_name
```

Main rule:

```text
Add before removing.
Migrate data before enforcing.
Remove old schema only after the application no longer depends on it.
```

---

## 6. Zero / Minimal-Downtime Migration Concepts

**Definition:**  
A zero- or minimal-downtime migration is designed so the database can change while the application continues serving users.

Goal:

```text
schema change
+
real production traffic
+
minimal interruption
```

### Example — creating an index on a large live table

Normal index creation:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

On a large production table, this can block writes while PostgreSQL builds the index.

A safer option is:

```sql
CREATE INDEX CONCURRENTLY idx_orders_customer_id
ON orders(customer_id);
```

This allows normal inserts, updates, and deletes to continue while the index is being built.

With `node-pg-migrate`:

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.noTransaction();

  pgm.createIndex(
    "orders",
    "customer_id",
    {
      name: "idx_orders_customer_id",
      concurrently: true,
    }
  );
}
```

### What does `pgm.noTransaction()` mean?

```text
Run this migration outside the normal PostgreSQL transaction.
```

It is needed here because PostgreSQL does not allow:

```sql
CREATE INDEX CONCURRENTLY
```

inside a transaction.

Mental model:

```text
Normal migration
→ may block production work

Minimal-downtime migration
→ choose a safer method that lets users continue using the application
```

---

# Production Safety Decision Map

```text
Does existing data satisfy the new rule?
↓
Will old application code still work?
↓
Will new application code work?
↓
Could the migration lock a large table?
↓
Could it destroy data?
↓
Can the application be rolled back safely?
↓
Do we need expand → migrate → contract?
↓
Test locally/staging
↓
Deploy carefully
```

---

# Stage 15 Production Safety Summary

```text
Safe schema changes
→ protect data, running code, and traffic

Migration ordering
→ apply schema/data/application changes in the correct sequence

Migration conflicts
→ prevent incompatible changes from multiple developers

Rollback strategies
→ choose down(), forward fix, app rollback, or recovery based on risk

Backward-compatible migrations
→ old and new application versions can coexist temporarily

Zero/minimal-downtime migrations
→ reduce blocking and service interruption during live schema changes
```

A professional migration is not merely valid SQL. It should be versioned, ordered, reviewable, compatible, recoverable, and production-safe.
