# Stage 14 — Database Application Architecture

## Module 14 — Data Access Layer

# 02 — Error Handling

## 1. PostgreSQL Error Codes

PostgreSQL uses SQLSTATE error codes to identify database failures.

| Code | Meaning |
|---|---|
| `23505` | Unique constraint violation |
| `23503` | Foreign-key violation |
| `23502` | NOT NULL violation |
| `23514` | CHECK constraint violation |
| `40001` | Serialization failure |
| `40P01` | Deadlock detected |
| `25P02` | Current transaction is aborted |

With `pg`, PostgreSQL errors are represented by `DatabaseError`.

```ts
import { DatabaseError } from "pg";
```

Example:

```ts
if (error instanceof DatabaseError) {
  console.log(error.code);
  console.log(error.constraint);
  console.log(error.detail);
}
```

Important properties:

```text
error.code
→ PostgreSQL error type

error.constraint
→ specific database constraint that failed

error.detail
→ technical PostgreSQL explanation
```

Raw PostgreSQL errors should not be sent directly to API clients.

---

## 2. Constraint Violation Handling

Constraint violations should be converted from database-specific errors into meaningful application/API errors.

```ts
export function mapDatabaseError(
  error: DatabaseError
): AppError | null {
  if (error.code === "23505") {
    return new AppError({
      statusCode: 409,
      code: "RESOURCE_ALREADY_EXISTS",
      message: "Resource already exists",
    });
  }

  if (error.code === "23503") {
    return new AppError({
      statusCode: 409,
      code: "REFERENCE_CONFLICT",
      message:
        "Related resource does not exist or is still in use",
    });
  }

  if (error.code === "23502") {
    return new AppError({
      statusCode: 400,
      code: "MISSING_REQUIRED_VALUE",
      message:
        "A required value is missing",
    });
  }

  if (error.code === "23514") {
    return new AppError({
      statusCode: 400,
      code: "INVALID_VALUE",
      message:
        "A value violates a database rule",
    });
  }

  return null;
}
```

Architecture:

```text
PostgreSQL constraint failure
↓
DatabaseError
↓
DB error mapper
↓
AppError
↓
Central error handler
↓
API response
```

---

## 3. Unique Constraint Errors

PostgreSQL code:

```text
23505
```

means an `INSERT` or `UPDATE` violated a `UNIQUE` constraint.

Example:

```sql
email TEXT UNIQUE
```

For precise handling, inspect both the error code and the constraint:

```ts
if (
  error.code === "23505" &&
  error.constraint ===
    "customers_email_key"
) {
  return new AppError({
    statusCode: 409,
    code: "EMAIL_ALREADY_EXISTS",
    message: "Email already exists",
  });
}
```

Mental model:

```text
error.code
→ what kind of database failure happened

error.constraint
→ which specific uniqueness rule failed
```

One `23505` could mean duplicate email, username, order number, slug, or another unique value.

---

## 4. Foreign-Key Errors

PostgreSQL code:

```text
23503
```

means a foreign-key relationship was violated.

Example:

```sql
CREATE TABLE orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  customer_id BIGINT NOT NULL
    REFERENCES customers(id)
);
```

If a nonexistent customer ID is inserted:

```sql
INSERT INTO orders (customer_id)
VALUES (9999);
```

PostgreSQL throws `23503`.

Example mapping:

```ts
if (
  error.code === "23503" &&
  error.constraint ===
    "orders_customer_id_fkey"
) {
  return new AppError({
    statusCode: 400,
    code: "CUSTOMER_NOT_FOUND",
    message:
      "Referenced customer does not exist",
  });
}
```

Foreign-key errors can also happen during deletion.

Example:

```text
customer has orders
↓
DELETE customer
↓
foreign-key rule blocks deletion
↓
23503
```

Possible API mapping:

```ts
return new AppError({
  statusCode: 409,
  code: "CUSTOMER_HAS_ORDERS",
  message:
    "Customer cannot be deleted while orders exist",
});
```

---

## 5. Transaction Errors

### `40001` — Serialization Failure

This can happen under `SERIALIZABLE` isolation when PostgreSQL cannot safely serialize concurrent transactions.

```text
40001
→ concurrency conflict
→ usually retryable
```

When retrying, retry the complete transaction.

---

### `40P01` — Deadlock Detected

Example:

```text
Transaction A locks row 1
Transaction B locks row 2

A waits for row 2
B waits for row 1
```

PostgreSQL detects the deadlock and aborts one transaction.

```text
40P01
→ deadlock
→ commonly retryable
```

---

### `25P02` — Current Transaction Is Aborted

If a statement fails inside a transaction, the transaction enters a failed state.

```sql
BEGIN;

UPDATE ...; -- fails

SELECT ...; -- transaction is now aborted
```

Rollback before continuing:

```sql
ROLLBACK;
```

Node.js pattern:

```ts
try {
  await client.query("BEGIN");

  // transaction queries

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");

  throw error;
}
```

Distinction:

```text
40001 / 40P01
→ transaction/concurrency failure
→ rollback + possibly retry whole transaction

25P02
→ transaction is already failed
→ rollback before continuing
```

---

## 6. Mapping Database Errors to API Errors

The frontend should not understand PostgreSQL error codes.

Avoid exposing:

```json
{
  "code": "23505",
  "constraint": "customers_email_key"
}
```

Prefer application-friendly errors:

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Email already exists"
  }
}
```

Architecture:

```text
PostgreSQL Error
↓
DB Error Mapper
↓
Application Error
↓
Central Error Handler
↓
API Error Response
```

Recommended separation:

```text
db-error-mapper.ts
→ understands PostgreSQL codes and constraints

error-handler.ts
→ understands HTTP responses
```

---

## 7. `AppError`

A custom application error carries application-specific metadata.

```ts
type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
};

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor({
    statusCode,
    code,
    message,
  }: AppErrorOptions) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
  }
}
```

Example:

```ts
throw new AppError({
  statusCode: 404,
  code: "CUSTOMER_NOT_FOUND",
  message: "Customer not found",
});
```

Meaning:

```text
statusCode
→ HTTP status to eventually return

code
→ application-specific machine-readable error code

message
→ human-readable explanation
```

The central handler can identify it:

```ts
if (error instanceof AppError) {
  // handle application error
}
```

`DatabaseError` is provided by `pg`:

```ts
import { DatabaseError } from "pg";
```

`AppError` is created by the application.

> JavaScript class/object/instance/constructor/`super()` concepts should be reviewed separately if deeper understanding is needed.

---

## 8. Error Mapping Location

Recommended structure:

```text
shared/
  errors/
    app-error.ts
    db-error-mapper.ts
    error-handler.ts
```

Responsibilities:

```text
app-error.ts
→ custom application error type

db-error-mapper.ts
→ PostgreSQL error → AppError

error-handler.ts
→ Error/AppError → HTTP response
```

Avoid repeating PostgreSQL error mapping inside controllers, services, and repositories unless a specific use case needs local recovery behavior.

---

## 9. Final Error Handling Mental Model

```text
PostgreSQL
↓
DatabaseError
↓
error.code / error.constraint
↓
DB Error Mapper
↓
AppError
↓
Central Express Error Handler
↓
Safe API Error Response
```

Key rule:

```text
Database errors stay internal.
API errors use stable application-friendly codes and messages.
```
