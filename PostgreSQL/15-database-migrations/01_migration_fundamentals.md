# Stage 15 — Database Migrations

## Module 15 — Schema Evolution

# 01 — Migration Fundamentals

## 1. Why Migrations Exist

**Definition:**  
A database migration is a versioned change that moves a database schema from one state to another.

```text
Version 1
customers(id, name)

        ↓ migration

Version 2
customers(id, name, email)
```

Migrations exist so teams can track schema-change history, keep local/staging/production schemas in sync, reproduce the same schema on a new database, review database changes in Git, apply changes in a controlled order, and plan recovery strategies.

```text
Git
→ tracks application code changes

Migrations
→ track database schema changes
```

Common schema operations:

```sql
CREATE TABLE
ALTER TABLE
DROP TABLE
ADD COLUMN
DROP COLUMN
CREATE INDEX
ADD CONSTRAINT
```

---

## 2. Local Database vs Production Database

Local and production databases are separate PostgreSQL databases.

```text
Development Backend
      ↓
PostgreSQL on localhost
```

```text
Production Backend
      ↓
Cloud PostgreSQL
      ↓
Neon / Supabase / RDS / another provider
```

The same backend code can connect to different databases through different environment variables.

Local:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp
```

Production:

```env
DATABASE_URL=postgresql://user:password@production-host/myapp
```

Application connection:

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

The database selected by `DATABASE_URL` is the database that receives the migration.

---

## 3. Schema vs Data

```text
Schema
→ tables
→ columns
→ constraints
→ indexes
→ relationships

Data
→ actual customers
→ actual orders
→ actual products
```

Migrations normally reproduce and evolve the required schema. Development test rows are not automatically copied to production.

---

## 4. Migration Files

**Definition:**  
A migration file is a saved, version-controlled file describing one database schema change.

Example:

```text
002_add_customer_phone.sql
```

```sql
ALTER TABLE customers
ADD COLUMN phone TEXT;
```

Migration files are commonly ordered using numbers or timestamps:

```text
001_create_customers
002_create_orders
003_add_phone
```

or:

```text
20260929152000_rename-customer-name-to-full-name.ts
```

The name should describe the change.

---

## 5. Ordered Migrations

Migrations must run in the correct order because later migrations may depend on earlier migrations.

Example:

```text
001_create_customers
↓
002_create_orders
↓
003_add_order_status
```

If `orders.customer_id` references `customers.id`, the `customers` table must exist first.

Another example:

```text
001_create_products
↓
002_add_price_column
↓
003_create_price_index
```

Migration `003` cannot create an index on a column that migration `002` has not created yet.

Once migrations have been shared or applied to staging/production, treat them as historical records. Do not reorder or silently rewrite them; create a new migration instead.

---

## 6. Running Migrations

Creating a migration file alone does not change PostgreSQL.

```text
migration file
+
database connection
↓
execute migration
↓
database schema changes
```

A migration runner normally:

```text
connects to PostgreSQL
↓
reads migration history
↓
finds pending migrations
↓
runs them in order
↓
records successful migrations
```

The same migration files can be run against local, staging, and production databases. The connection string determines which database is changed.

---

## 7. Tracking Migration State

The migration system needs to know which migrations have already run.

`node-pg-migrate` records migration history in a database table named `pgmigrations` by default.

Conceptually:

| id | name | run_on |
|---:|---|---|
| 1 | initial-schema | ... |
| 2 | add-customer-phone | ... |

The runner compares:

```text
migration files in project
vs
migration records in database
```

Example:

```text
001 → already applied
002 → already applied
003 → pending
```

Only pending migrations should run.

Important distinction:

```text
Migration files
→ live in the application repository / Git

Migration state
→ lives inside each database
```

---

## 8. Baselining an Existing Database

**Definition:**  
Baselining means treating an already-existing database schema as the starting point of migration history.

Example situation:

```text
Existing PostgreSQL database

customers
orders
products

but:

no migrations/
no pgmigrations history
```

Goal:

```text
existing schema
↓
capture current schema as initial migration
↓
mark initial migration as already applied
↓
future changes use normal migrations
```

Do not run the initial schema migration normally against a database that already contains those tables.

With `node-pg-migrate`, the baseline can be recorded without executing its SQL:

```bash
pnpm migrate up --fake
```

Mental model:

```text
--fake
→ record migration as applied
→ do not execute its schema SQL
```

---

## 9. Capturing the Existing Schema

For an existing PostgreSQL database, the current schema can be exported with `pg_dump`.

```bash
pg_dump --schema-only --no-owner --no-privileges -d "DATABASE_URL" > current-schema.sql
```

`--schema-only` exports structure without table rows.

The output may include:

```text
CREATE TABLE
ALTER TABLE
constraints
indexes
sequences
```

If the dump contains `psql` meta-command lines beginning with `\`, remove those non-SQL meta-command lines before using the dump as a migration file.

---

## 10. node-pg-migrate

For a Node.js + TypeScript + PostgreSQL + `pg` backend:

```bash
pnpm add -D node-pg-migrate
```

Example `package.json` script:

```json
{
  "scripts": {
    "migrate": "node-pg-migrate"
  }
}
```

Official documentation:

https://salsita.github.io/node-pg-migrate/getting-started

---

## 11. Creating a Migration

Example:

```bash
pnpm migrate create rename-customer-name-to-full-name -j ts
```

This creates a timestamped migration such as:

```text
20260929152000_rename-customer-name-to-full-name.ts
```

Typical TypeScript migration:

```ts
import type {
  ColumnDefinitions,
  MigrationBuilder,
} from "node-pg-migrate";

export const shorthands:
  ColumnDefinitions | undefined =
  undefined;

export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  // forward schema change
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  // reverse schema change
}
```

`up()` moves the schema forward.

`down()` describes how the migration could be reversed. It does not run during `migrate up`.

---

## 12. Complete Practical Migration Cycle

```text
Need database schema change
↓
Create a new migration
↓
Write the change in up()
↓
Write the reverse in down() when appropriate
↓
Preview the migration
↓
Apply it locally
↓
Verify the schema
↓
Verify pgmigrations
↓
Test the application
↓
Commit code + migration to Git
↓
Deploy
↓
Run pending migrations against production
```

### Step 1 — Create

```bash
pnpm migrate create rename-customer-name-to-full-name -j ts
```

Example:

```text
20260929152000_rename-customer-name-to-full-name.ts
```

### Step 2 — Write

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.renameColumn(
    "customers",
    "name",
    "full_name"
  );
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.renameColumn(
    "customers",
    "full_name",
    "name"
  );
}
```

### Step 3 — Preview

```bash
pnpm migrate up --dry-run
```

`--dry-run` shows what would execute but does not change the database.

Generated SQL may be:

```sql
ALTER TABLE "customers"
RENAME "name" TO "full_name";
```

This is equivalent to:

```sql
ALTER TABLE customers
RENAME COLUMN name TO full_name;
```

because `COLUMN` is optional in this PostgreSQL syntax.

### Step 4 — Apply

```bash
pnpm migrate up
```

This actually executes pending migrations.

### Step 5 — Verify schema

Inspect the table in pgAdmin or PostgreSQL.

```text
customers
- id
- full_name
- email
```

### Step 6 — Verify history

```sql
SELECT *
FROM pgmigrations
ORDER BY id;
```

The new migration should appear as applied.

---

## 13. Dry Run vs Real Migration

```bash
pnpm migrate up --dry-run
```

```text
preview only
database unchanged
```

```bash
pnpm migrate up
```

```text
execute pending migrations
database changes
migration state is recorded
```

Short mental model:

```text
--dry-run = preview
up        = execute
```

---

## 14. Professional Schema-Change Workflow

Once a project uses migrations, schema changes should normally be represented by version-controlled migrations rather than undocumented manual changes.

```text
Need DB change
↓
Create migration
↓
Write change
↓
Review / dry-run
↓
Run locally
↓
Test
↓
Commit
↓
Deploy
↓
Run pending production migrations
```

pgAdmin remains useful for inspecting schema/data, running queries, and debugging, but should not replace migration history for normal production schema evolution.

---

## 15. Fundamental Mental Model

```text
Migration
= move schema from one version to another

Migration file
= saved instructions for one schema change

Migration order
= chronological dependency chain

Migration runner
= executes pending migrations

pgmigrations
= records what has already run

Baseline
= establish an existing schema as migration starting point
```
