# UPSERT and ON CONFLICT

## Topic 1: UPSERT

UPSERT is a common database term for an operation that inserts a row
when no conflicting row exists and otherwise handles the conflict,
commonly by updating the existing row.

`UPSERT` itself is not the PostgreSQL keyword. PostgreSQL implements the
pattern through `INSERT ... ON CONFLICT`.

``` sql
CREATE TABLE app_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);
```

## Topic 2: ON CONFLICT DO NOTHING

``` sql
INSERT INTO app_users (name, email)
VALUES ('Samad', 'samad@gmail.com')
ON CONFLICT (email)
DO NOTHING;
```

``` text
Conflict?
  No  -> INSERT
  Yes -> DO NOTHING
```

## Topic 3: ON CONFLICT DO UPDATE

``` sql
INSERT INTO app_users (name, email)
VALUES ('Abdus Samad', 'samad@gmail.com')
ON CONFLICT (email)
DO UPDATE
SET name = EXCLUDED.name;
```

``` text
Conflict?
  No  -> INSERT
  Yes -> UPDATE existing row
```

`ON CONFLICT` is part of PostgreSQL's `INSERT` statement.

## Topic 4: EXCLUDED

Within `ON CONFLICT DO UPDATE`, `EXCLUDED` represents the row PostgreSQL
attempted to insert but which encountered the conflict.

``` sql
SET name = EXCLUDED.name
```

means to use the attempted row's `name` value when updating the existing
conflicting row.

## Topic 5: UPSERT with RETURNING

``` sql
INSERT INTO app_users (name, email)
VALUES ('Abdus Samad', 'samad@gmail.com')
ON CONFLICT (email)
DO UPDATE
SET name = EXCLUDED.name
RETURNING *;
```

The statement returns the resulting row whether PostgreSQL followed the
insert path or conflict-update path.

A conflict target normally corresponds to a uniqueness rule PostgreSQL
can detect, such as a primary key or `UNIQUE` constraint.
