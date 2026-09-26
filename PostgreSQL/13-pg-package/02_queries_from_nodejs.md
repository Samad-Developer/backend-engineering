# Module 13 — `pg` Driver & Database Integration

## 02 — Queries from Node.js

### 1. Executing Queries

Use `pool.query()` for a normal independent SQL query.

```ts
const result = await pool.query(
  "SELECT id, name FROM customers"
);
```

Flow:

```text
Node.js
  ↓
pool.query(...)
  ↓
pool gets an available connection
  ↓
SQL sent to PostgreSQL
  ↓
PostgreSQL executes query
  ↓
result returned to Node.js
  ↓
connection returned to pool
```

For a single independent query, `pool.query(...)` is usually the simplest choice.

---

### 2. Parameterized Queries

**Definition:**  
A parameterized query keeps SQL structure separate from user-provided values.

Unsafe:

```ts
const email = req.body.email;

await pool.query(
  `SELECT * FROM customers WHERE email = '${email}'`
);
```

Safe:

```ts
const email = req.body.email;

const result = await pool.query(
  "SELECT * FROM customers WHERE email = $1",
  [email]
);
```

Placeholders map to values by position:

```text
$1 → first value
$2 → second value
$3 → third value
```

Example:

```ts
await pool.query(
  `
    INSERT INTO customers (name, email)
    VALUES ($1, $2)
  `,
  ["Samad", "samad@gmail.com"]
);
```

```text
$1 → "Samad"
$2 → "samad@gmail.com"
```

Parameterized queries help prevent SQL injection and correctly handle values.

Rule:

> Never manually inject user input into SQL strings.

---

### 3. Query Results

`pool.query()` returns a result object containing data and metadata.

```ts
const result = await pool.query(
  "SELECT id, name FROM customers"
);
```

Common properties:

```ts
result.rows
result.rowCount
result.command
result.fields
```

#### `rows`

Contains returned row data.

```ts
console.log(result.rows);
```

Example:

```ts
[
  { id: "1", name: "Ali" },
  { id: "2", name: "Samad" }
]
```

#### `rowCount`

Number of rows returned or affected.

```ts
console.log(result.rowCount);
```

#### `command`

The SQL command that ran.

```ts
console.log(result.command);
```

Possible values include:

```text
SELECT
INSERT
UPDATE
DELETE
```

#### `fields`

Contains metadata about returned columns.

```ts
console.log(result.fields[0].name);
```

Example output:

```text
id
```

If the query returns:

```sql
RETURNING id, name;
```

then `fields` contains metadata for `id` and `name`.

In normal API development, `rows` and `rowCount` are used much more often than `fields`.

---

### 4. TypeScript Typing

A query can be typed so TypeScript knows the expected shape of each returned row.

```ts
type Customer = {
  id: string;
  name: string;
  email: string;
};

const result = await pool.query<Customer>(
  `
    SELECT id, name, email
    FROM customers
  `
);
```

Now TypeScript understands:

```ts
result.rows[0].id
result.rows[0].name
result.rows[0].email
```

and catches invalid properties:

```ts
result.rows[0].age;
```

Important:

```ts
pool.query<Customer>()
```

does **not** transform database data.

It only tells TypeScript what row shape the application expects.

---

### 5. PostgreSQL `BIGINT` and TypeScript

PostgreSQL `BIGINT` / `int8` values are returned by `pg` as strings by default.

Example:

```text
id: '7'
```

So this may be accurate:

```ts
type Customer = {
  id: string;
  name: string;
};
```

unless a custom parser is configured.

---

### 6. PostgreSQL Errors

When PostgreSQL rejects a query, `pg` throws an error.

```ts
try {
  await pool.query(
    "INSERT INTO customers (email) VALUES ($1)",
    ["samad@gmail.com"]
  );
} catch (error) {
  console.error(error);
}
```

A database error may include:

```text
code
message
detail
constraint
table
column
```

The most important property is often:

```ts
error.code
```

Common SQLSTATE codes:

| Code | Meaning |
|---|---|
| `23505` | Unique violation |
| `23503` | Foreign key violation |
| `23502` | NOT NULL violation |
| `23514` | CHECK constraint violation |
| `40001` | Serialization failure |
| `40P01` | Deadlock detected |

Prefer:

```ts
error.code === "23505"
```

instead of checking error-message text.

---

### 7. PostgreSQL Error Typing

`pg` exposes `DatabaseError`.

```ts
import { DatabaseError } from "pg";

try {
  await pool.query(
    "INSERT INTO customers (email) VALUES ($1)",
    ["samad@gmail.com"]
  );
} catch (error) {
  if (error instanceof DatabaseError) {
    console.log(error.code);
    console.log(error.detail);
  }
}
```

This lets TypeScript safely access PostgreSQL-specific error properties.

---

### 8. Error Handling

Do not expose raw PostgreSQL errors directly to API clients.

Avoid:

```ts
res.json(error);
```

Raw database errors may expose internal details such as:

```text
table names
constraint names
database structure
SQL details
```

Convert database failures into clean HTTP responses.

Example:

```ts
if (error instanceof DatabaseError) {
  if (error.code === "23505") {
    return res.status(409).json({
      message: "Resource already exists",
    });
  }
}
```

Unexpected failures can return:

```ts
res.status(500).json({
  message: "Internal server error",
});
```

---

### 9. Express 5 Async Error Handling

With Express 5, errors thrown inside an `async` route handler, or rejected Promises returned by that handler, are automatically forwarded to Express error handling.

Therefore normal async routes do not need repetitive `try/catch` blocks only for forwarding errors.

```ts
router.get("/", async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name FROM customers"
  );

  res.json(result.rows);
});
```

If `pool.query()` rejects, Express 5 forwards the error automatically.

Later, in the **Architecture** section of Module 13, this will be connected to centralized error-handling middleware.

Important exception:

Callback-style asynchronous APIs may still require:

```ts
next(error);
```

because their errors are not automatically part of the route handler's Promise chain.

Official reference:

```text
https://expressjs.com/en/5x/guide/error-handling/
```

---

### 10. Transaction Handling from Node.js

A transaction must use the **same PostgreSQL connection for every query inside that transaction**.

Wrong:

```ts
await pool.query("BEGIN");
await pool.query("UPDATE accounts SET ...");
await pool.query("COMMIT");
```

Each `pool.query()` may borrow a different connection:

```text
BEGIN  → connection 1
UPDATE → connection 4
COMMIT → connection 7
```

That is not one transaction.

---

### 11. Correct Transaction Pattern

Borrow one connection manually:

```ts
const client = await pool.connect();
```

Then use the same client for the whole transaction:

```ts
const client = await pool.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `
      UPDATE accounts
      SET balance = balance - $1
      WHERE id = $2
    `,
    [100, 1]
  );

  await client.query(
    `
      UPDATE accounts
      SET balance = balance + $1
      WHERE id = $2
    `,
    [100, 2]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

Flow:

```text
pool.connect()
      ↓
borrow one connection
      ↓
BEGIN
      ↓
query 1
      ↓
query 2
      ↓
COMMIT
      ↓
client.release()
      ↓
connection returns to pool
```

If something fails:

```text
BEGIN
↓
query 1 succeeds
↓
query 2 fails
↓
ROLLBACK
↓
throw error again
↓
finally
↓
client.release()
```

---

### 12. Why `throw error` After `ROLLBACK`?

After rolling back, usually rethrow the original error:

```ts
catch (error) {
  await client.query("ROLLBACK");
  throw error;
}
```

This lets a higher application layer or Express error handling process the failure.

---

### 13. Why `finally` Is Critical

Always release the borrowed client:

```ts
finally {
  client.release();
}
```

`finally` runs whether the transaction succeeds or fails.

If the connection is not released:

```text
connection remains checked out
→ fewer connections available
→ repeated leaks
→ connection exhaustion
```

---

## `pool.query()` vs `pool.connect()`

### Normal Independent Query

```ts
const result = await pool.query(
  "SELECT * FROM customers"
);
```

Use:

```text
pool.query()
```

The pool automatically borrows and releases the connection.

### Transaction / Same PostgreSQL Session

```ts
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(...);
  await client.query("COMMIT");
} finally {
  client.release();
}
```

Use:

```text
pool.connect()
→ client.query()
→ client.release()
```

when multiple SQL statements must run on the same PostgreSQL session.

---

## Query Execution Mental Model

Normal query:

```text
HTTP request
      ↓
Express route
      ↓
pool.query(...)
      ↓
available PostgreSQL connection
      ↓
SQL executes
      ↓
QueryResult
      ↓
result.rows
      ↓
JSON response
```

Transaction:

```text
HTTP request
      ↓
pool.connect()
      ↓
one dedicated connection
      ↓
BEGIN
      ↓
multiple queries
      ↓
COMMIT / ROLLBACK
      ↓
client.release()
```

---

## Key Rules

1. Use `pool.query()` for normal independent queries.
2. Use parameterized queries for dynamic values.
3. `result.rows` contains returned row data.
4. `result.rowCount` gives the number of rows returned or affected.
5. `result.command` identifies the SQL command.
6. `result.fields` contains column metadata.
7. Type query results with TypeScript when possible.
8. PostgreSQL `BIGINT` is returned as a string by default.
9. Use SQLSTATE error codes instead of parsing error-message text.
10. Do not expose raw database errors to API clients.
11. Express 5 forwards rejected async route handlers to error handling.
12. Transactions must use one PostgreSQL connection.
13. Use `pool.connect()` for transactions.
14. `ROLLBACK` on transaction failure.
15. Always call `client.release()` in `finally`.
