# node-pg-migrate: Migration Handling Guide

For a Node.js + Express + PostgreSQL backend using the `pg` package, use `node-pg-migrate` to manage database schema changes through version-controlled migration files.

## 1. Install the package

Run from your backend project directory:

```bash
npm install node-pg-migrate
```

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
