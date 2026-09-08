# PostgreSQL RETURNING

## Topic 1: RETURNING

`RETURNING` is a PostgreSQL clause that returns values from rows
affected by an `INSERT`, `UPDATE`, or `DELETE` statement without
requiring a separate `SELECT`.

### INSERT RETURNING

``` sql
INSERT INTO app_users (name, email)
VALUES ('Samad', 'samad@gmail.com')
RETURNING id, name, email;
```

This can return generated identity values, defaults, timestamps, and
other resulting column values.

### UPDATE RETURNING

``` sql
UPDATE app_users
SET login_count = login_count + 1
WHERE id = 1
RETURNING id, name, login_count;
```

### DELETE RETURNING

``` sql
DELETE FROM app_users
WHERE id = 1
RETURNING *;
```

Mental model:

``` text
INSERT ... RETURNING -> return inserted row data
UPDATE ... RETURNING -> return updated row data
DELETE ... RETURNING -> return deleted row data
```

### Node.js Example

``` js
const result = await pool.query(
  `INSERT INTO app_users (name, email)
   VALUES ($1, $2)
   RETURNING id, name, email`,
  [name, email]
);

const createdUser = result.rows[0];
```

`RETURNING` is a PostgreSQL feature/extension rather than syntax
universally supported in the same form by every SQL database.
