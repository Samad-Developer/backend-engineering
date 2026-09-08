# Practical CRUD Patterns

## Topic 1: Practical Table

``` sql
CREATE TABLE app_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    login_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Topic 2: Create and Return

``` sql
INSERT INTO app_users (name, email)
VALUES ('Samad', 'samad@gmail.com')
RETURNING *;
```

## Topic 3: Parameterized Read

With Node.js `pg`:

``` js
const result = await pool.query(
  `SELECT * FROM app_users WHERE email = $1`,
  [userEmail]
);
```

The JavaScript values array is part of the `pg` API. It is not SQL
syntax that can be appended to an ordinary interactive `psql` query.

## Topic 4: Update and Return

``` sql
UPDATE app_users
SET login_count = login_count + 1
WHERE id = 1
RETURNING id, name, login_count;
```

## Topic 5: Insert or Update

``` sql
INSERT INTO app_users (name, email)
VALUES ('Abdus Samad', 'samad@gmail.com')
ON CONFLICT (email)
DO UPDATE
SET name = EXCLUDED.name
RETURNING *;
```

## Topic 6: Delete and Return

``` sql
DELETE FROM app_users
WHERE id = 1
RETURNING *;
```

## Topic 7: Real Application CRUD

CRUD statements are normally one layer in a larger backend request flow.

``` text
HTTP request
     |
Authentication / authorization
     |
Input validation
     |
Business logic
     |
Parameterized SQL
     |
PostgreSQL
     |
Result
     |
HTTP response
```

Joins, aggregation, sorting, pagination, transactions, concurrency
control, constraints, and indexing make production data access more
sophisticated, while the fundamental CRUD operations remain Create,
Read, Update, and Delete.
