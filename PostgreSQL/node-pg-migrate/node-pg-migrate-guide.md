# node-pg-migrate: Migration Handling Guide

For a Node.js + Express + PostgreSQL backend using the `pg` package, use `node-pg-migrate` to manage database schema changes through version-controlled migration files.

## 1. Install the package

Run from your backend project directory:

```bash
npm install node-pg-migrate
```

## 2. Create the migrations folder# node-pg-migrate: Migration Handling Guide

For a Node.js + Express + PostgreSQL backend using the `pg` package, use `node-pg-migrate` to manage database schema changes through version-controlled migration files.

## 1. Install the package

Run from your backend project directory:

```bash
npm install node-pg-migrate
```

With pnpm: `pnpm add node-pg-migrate`

## 2. Create the migrations folder

Create a `migrations` folder in the backend project root:

```text
backend/
├── migrations/
├── src/
├── .env
└── package.json
```

## 3. Add the npm script

Add this script to `package.json`:

```json
{
  "scripts": {
    "migrate": "node-pg-migrate -m migrations --envPath .env --migration-file-language sql"
  }
}
```

This configures the migration directory, loads environment variables from `.env`, and creates SQL migration files.

Make sure `.env` contains the PostgreSQL connection settings expected by your migration tool, commonly `DATABASE_URL`. Keep credentials out of Git.

## 4. Create a migration

Run from the backend project directory:

```bash
npm run migrate -- create init-schema
```

This creates a timestamped SQL migration file inside `migrations/`. Add your schema changes to its **Up Migration** section and the reversal to its **Down Migration** section.

Example:

```sql
-- Up Migration
CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration
DROP TABLE users;
```

- **Up:** applies the schema change.
- **Down:** reverses it when rolling back.

## 5. Migration commands

Run all commands from your backend project directory, such as `bookeasy\backend`.

| Command | Purpose |
|---|---|
| `npm run migrate -- create init-schema` | Create a migration file |
| `npm run migrate -- up` | Apply all pending migrations |
| `npm run migrate -- up 1` | Apply the next pending migration |
| `npm run migrate -- down` | Roll back the last applied migration |
| `npm run migrate -- redo` | Roll back and reapply the last migration |

The `--` separates npm arguments from arguments passed to the migration tool.

With pnpm the `--` is not needed: `pnpm migrate up`, `pnpm migrate down`, `pnpm migrate create add-venue-phone`.

Typing only `pnpm migrate` does nothing useful. The tool needs a direction word (`create`, `up`, `down`, `redo`).

## 6. How migrations work

1. Create a migration file.
2. Write the `Up` and `Down` SQL.
3. Run `npm run migrate -- up`.
4. Verify the database schema.
5. The tool records applied migrations in its migration-tracking table, normally `pgmigrations`.

## 7. SQL files vs JS/TS files (why the docs look different)

`node-pg-migrate` supports three migration file formats: **JavaScript, TypeScript and plain SQL**. Its docs show mostly JS/TS examples, but all three formats do the same job.

My project uses SQL because of this flag in the npm script:

```text
--migration-file-language sql
```

| Part of the script | Meaning |
|---|---|
| `-m migrations` | The migrations folder |
| `--envPath .env` | Read `DATABASE_URL` from `.env` |
| `--migration-file-language sql` | `create` makes `.sql` files, not JS/TS |

So the JS/TS parts of the docs do not apply to me. In SQL files:

- `-- Up Migration` starts the section that is applied.
- `-- Down Migration` starts the section that undoes it (optional, but good practice).

## 8. Complete example: add a `phone` column to `venues`

### Step 1: create the file

```powershell
pnpm migrate create add-venue-phone
```

This makes a new file in `migrations/` with a timestamp in the name (the timestamp keeps migrations in order):

```text
migrations/1794000000000_add-venue-phone.sql
```

### Step 2: write the SQL in the file

```sql
-- Up Migration
ALTER TABLE venues ADD COLUMN phone TEXT;

-- Down Migration
ALTER TABLE venues DROP COLUMN phone;
```

### Step 3: apply it

```powershell
pnpm migrate up
```

What the tool does:

1. Looks at the `pgmigrations` table (the list of migrations already applied).
2. Looks at the `migrations/` folder.
3. Runs only the files that are not in `pgmigrations` yet, in order.
4. Adds a row to `pgmigrations` for each file it ran.

Example output:

```text
> Migrating files:
> - 1794000000000_add-venue-phone
### MIGRATION 1794000000000_add-venue-phone (UP) ###
ALTER TABLE venues ADD COLUMN phone TEXT;
Migrations complete!
```

### Step 4: check the database

```powershell
psql -U postgres -d bookeasy -c "\d venues"
```

Replace `bookeasy` with the development database name. The `phone` column should be listed.

### Step 5: run `up` again

```powershell
pnpm migrate up
```

Nothing happens, because the migration is already recorded in `pgmigrations`.

### Step 6: undo it (development database only)

```powershell
pnpm migrate down
```

This runs the **Down** section of the last migration and removes it from `pgmigrations`. The `phone` column disappears. Run `pnpm migrate up` to put it back.

### Summary of the flow

```text
pnpm migrate create name  →  new .sql file in migrations/
write the SQL             →  Up (and Down) sections
pnpm migrate up           →  runs only the files not in pgmigrations
pgmigrations table        →  the tool's memory of what already ran
```

## 9. Migrations and tests

My tests use a separate database (`bookeasy_test`, set in `.env.test`). The file `tests/global-setup.ts` runs `pnpm migrate up` once before all tests, so a new migration is applied to the test database automatically the next time I run `pnpm test`.

A fresh test database runs all migrations. Later runs only apply the new ones.

## Important rules

- Never edit an applied migration that has already been shared or deployed. Create a new migration instead.
- One migration = one small change. It is easier to read and to undo.
- `Down` can delete data or fail if the reversal is unsafe; inspect it before running.
- Run `down` only on my own development database. On production, fix mistakes with a new "up" migration.
- Back up important databases before risky schema changes.
- Commit migration files to Git. They are the history of the database.
- Keep `.env` and database credentials out of Git.
- Run migrations as a deployment step, not automatically in every Express request.
- Your application can continue using `pg` for normal queries. `node-pg-migrate` manages schema changes; it does not replace the `pg` package.

Create a `migrations` folder in the backend project root:

```text
backend/
├── migrations/
├── src/
├── .env
└── package.json
```

## 3. Add the npm script

Add this script to `package.json`:

```json
{
  "scripts": {
    "migrate": "node-pg-migrate -m migrations --envPath .env --migration-file-language sql"
  }
}
```

This configures the migration directory, loads environment variables from `.env`, and creates SQL migration files.

Make sure `.env` contains the PostgreSQL connection settings expected by your migration tool, commonly `DATABASE_URL`. Keep credentials out of Git.

## 4. Create a migration

Run from the backend project directory:

```bash
npm run migrate -- create init-schema
```

This creates a timestamped SQL migration file inside `migrations/`. Add your schema changes to its **Up Migration** section and the reversal to its **Down Migration** section.

Example:

```sql
-- Up Migration
CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration
DROP TABLE users;
```

- **Up:** applies the schema change.
- **Down:** reverses it when rolling back.

## 5. Migration commands

Run all commands from your backend project directory, such as `bookeasy\backend`.

| Command | Purpose |
|---|---|
| `npm run migrate -- create init-schema` | Create a migration file |
| `npm run migrate -- up` | Apply all pending migrations |
| `npm run migrate -- up 1` | Apply the next pending migration |
| `npm run migrate -- down` | Roll back the last applied migration |
| `npm run migrate -- redo` | Roll back and reapply the last migration |

The `--` separates npm arguments from arguments passed to the migration tool.

## 6. How migrations work

1. Create a migration file.
2. Write the `Up` and `Down` SQL.
3. Run `npm run migrate -- up`.
4. Verify the database schema.
5. The tool records applied migrations in its migration-tracking table, normally `pgmigrations`.

## Important rules

- Never edit an applied migration that has already been shared or deployed. Create a new migration instead.
- `Down` can delete data or fail if the reversal is unsafe; inspect it before running.
- Back up important databases before risky schema changes.
- Keep `.env` and database credentials out of Git.
- Run migrations as a deployment step, not automatically in every Express request.
- Your application can continue using `pg` for normal queries. `node-pg-migrate` manages schema changes; it does not replace the `pg` package.
