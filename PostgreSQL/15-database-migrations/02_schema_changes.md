# Stage 15 — Database Migrations

## Module 15 — Schema Evolution

# 02 — Schema Changes

Examples use `node-pg-migrate`.

## Creating a Migration File

Before writing any schema change, create a new TypeScript migration file:

```bash
pnpm migrate create create-customers -j ts
```

This creates a timestamped file inside the `migrations/` folder, for example:

```text
20260929152000_create-customers.ts
```

For a different schema change, replace `create-customers` with a descriptive name, for example:

```bash
pnpm migrate create add-customer-phone -j ts
pnpm migrate create rename-customer-name-to-full-name -j ts
pnpm migrate create add-orders-customer-index -j ts
```

Then write the forward change in `up()` and the reverse change in `down()` when appropriate.

The practical cycle is:

```text
Create migration file
↓
Write up() / down()
↓
pnpm migrate up --dry-run
↓
pnpm migrate up
↓
Verify schema + pgmigrations
```

---

## 1. Add Table

**Definition:**  
Create a new table as a new schema version.

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.createTable("payments", {
    id: {
      type: "bigserial",
      primaryKey: true,
    },

    order_id: {
      type: "bigint",
      notNull: true,
      references: "orders(id)",
    },

    amount: {
      type: "numeric(10,2)",
      notNull: true,
    },

    status: {
      type: "text",
      notNull: true,
      default: "PENDING",
    },
  });
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropTable("payments");
}
```

Equivalent SQL:

```sql
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
);
```

Use a new migration rather than editing an older migration already applied elsewhere.

---

## 2. Add Column

Example:

```text
customers
- id
- full_name
- email

↓ add

phone
```

Migration:

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.addColumn("customers", {
    phone: {
      type: "text",
      notNull: false,
    },
  });
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropColumn(
    "customers",
    "phone"
  );
}
```

Equivalent SQL:

```sql
ALTER TABLE customers
ADD COLUMN phone TEXT;
```

`up()` adds the column. `down()` defines the reverse operation if rollback is intentionally requested.

---

## 3. Remove Column

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropColumn(
    "customers",
    "old_phone"
  );
}
```

Equivalent SQL:

```sql
ALTER TABLE customers
DROP COLUMN old_phone;
```

Important:

> Dropping a column deletes the data stored in that column.

A reverse migration may recreate the structure, but it cannot automatically restore deleted production data.

---

## 4. Rename Column

Example:

```text
customers.name
↓
customers.full_name
```

Migration:

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

Generated SQL may be:

```sql
ALTER TABLE "customers"
RENAME "name" TO "full_name";
```

Equivalent longer syntax:

```sql
ALTER TABLE customers
RENAME COLUMN name TO full_name;
```

Existing values remain; only the column name changes.

After renaming the DB column, application SQL and TypeScript code referencing the old name must also be updated.

---

## 5. Modify Column

Use `alterColumn()` to change properties of an existing column.

Possible changes include:

```text
data type
NULL / NOT NULL
default value
```

Example:

```ts
pgm.alterColumn(
  "customers",
  "phone",
  {
    type: "varchar(20)",
  }
);
```

Equivalent:

```sql
ALTER TABLE customers
ALTER COLUMN phone
TYPE VARCHAR(20);
```

Make a column required:

```ts
pgm.alterColumn(
  "customers",
  "phone",
  {
    notNull: true,
  }
);
```

Equivalent:

```sql
ALTER TABLE customers
ALTER COLUMN phone
SET NOT NULL;
```

Existing rows must satisfy the new rule. For example, `SET NOT NULL` fails if rows still contain `NULL`.

---

## 6. Add Constraint

Example requirement:

```text
products.price
must never be negative
```

Migration:

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.addConstraint(
    "products",
    "products_price_positive",
    {
      check: "price >= 0",
    }
  );
}
```

Equivalent:

```sql
ALTER TABLE products
ADD CONSTRAINT products_price_positive
CHECK (price >= 0);
```

Explicit constraint names are useful because PostgreSQL errors can identify:

```ts
error.constraint
```

---

## 7. Remove Constraint

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropConstraint(
    "products",
    "products_price_positive"
  );
}
```

Equivalent:

```sql
ALTER TABLE products
DROP CONSTRAINT products_price_positive;
```

Reverse example:

```ts
export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.addConstraint(
    "products",
    "products_price_positive",
    {
      check: "price >= 0",
    }
  );
}
```

Avoid destructive options such as `CASCADE` unless their effects are understood.

---

## 8. Add Index

Suppose queries frequently use:

```sql
SELECT *
FROM orders
WHERE customer_id = $1;
```

Migration:

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.createIndex(
    "orders",
    "customer_id",
    {
      name:
        "idx_orders_customer_id",
    }
  );
}
```

Equivalent:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

Composite example:

```ts
pgm.createIndex(
  "orders",
  [
    "customer_id",
    "created_at",
  ],
  {
    name:
      "idx_orders_customer_created",
  }
);
```

Equivalent:

```sql
CREATE INDEX idx_orders_customer_created
ON orders(customer_id, created_at);
```

Indexes should be added based on query patterns and performance needs.

---

## 9. Remove Index

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropIndex(
    "orders",
    "customer_id",
    {
      name:
        "idx_orders_customer_id",
    }
  );
}
```

Equivalent:

```sql
DROP INDEX idx_orders_customer_id;
```

A `down()` migration may recreate it when appropriate.

---

## 10. Complete Example

Current schema:

```text
customers
- id
- full_name
- email

orders
- id
- customer_id
- total
```

New requirements:

```text
1. Add customers.phone
2. Add orders.status
3. Add index for orders.customer_id
```

Migration history:

```text
001_initial_schema
002_add_customer_phone
003_add_order_status
004_add_orders_customer_index
```

### Migration 002

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
  pgm.dropColumn(
    "customers",
    "phone"
  );
}
```

### Migration 003

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.addColumn("orders", {
    status: {
      type: "text",
      notNull: true,
      default: "PENDING",
    },
  });
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropColumn(
    "orders",
    "status"
  );
}
```

### Migration 004

```ts
export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.createIndex(
    "orders",
    "customer_id",
    {
      name:
        "idx_orders_customer_id",
    }
  );
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.dropIndex(
    "orders",
    "customer_id",
    {
      name:
        "idx_orders_customer_id",
    }
  );
}
```

Preview:

```bash
pnpm migrate up --dry-run
```

Apply:

```bash
pnpm migrate up
```

Verify migration history:

```sql
SELECT *
FROM pgmigrations
ORDER BY id;
```

---

## 11. Schema-Change Mental Model

```text
Need schema change
↓
Create a new migration
↓
Describe forward change in up()
↓
Describe reverse change in down() when appropriate
↓
Dry-run
↓
Apply locally
↓
Verify schema
↓
Verify pgmigrations
↓
Test application
↓
Commit migration
```

Operations covered:

```text
Add table          ✅
Add column         ✅
Remove column      ✅
Rename column      ✅
Modify column      ✅
Add constraint     ✅
Remove constraint  ✅
Add index          ✅
Remove index       ✅
```
