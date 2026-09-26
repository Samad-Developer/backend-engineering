# Module 13 — `pg` Driver & Database Integration

## 03 — Architecture

This section defines how to organize a TypeScript + Express 5 + PostgreSQL backend so request handling, validation, business logic, database access, responses, errors, middleware, and database infrastructure remain clean as the application grows.

---

## 1. Core Request Architecture

The main request flow is:

```text
HTTP Request
     ↓
Global Middleware
     ↓
Router
     ↓
Route Middleware
(authentication / authorization / validation)
     ↓
Controller
     ↓
Service
     ↓
Repository
     ↓
PostgreSQL
```

The result comes back in the opposite direction:

```text
PostgreSQL
     ↓
Repository
     ↓
Service
     ↓
Controller
     ↓
HTTP Response
```

Errors use a separate path:

```text
Validation
Controller
Service
Repository
PostgreSQL
     ↓
throw / rejected Promise
     ↓
Express 5
     ↓
Central Error Handler
     ↓
Consistent API Error Response
```

---

## 2. Feature-First Folder Structure

A scalable backend can organize each business feature together:

```text
src/
│
├── app.ts
├── server.ts
│
├── config/
│   └── env.ts
│
├── db/
│   ├── pool.ts
│   └── transaction.ts
│
├── shared/
│   ├── errors/
│   │   ├── app-error.ts
│   │   └── error-handler.ts
│   │
│   ├── middleware/
│   │   ├── validate-body.ts
│   │   ├── request-id.ts
│   │   └── not-found.ts
│   │
│   └── http/
│       └── api-response.ts
│
└── modules/
    ├── customers/
    │   ├── customer.routes.ts
    │   ├── customer.controller.ts
    │   ├── customer.service.ts
    │   ├── customer.repository.ts
    │   ├── customer.schema.ts
    │   └── customer.types.ts
    │
    ├── orders/
    │   └── ...
    │
    └── products/
        └── ...
```

Feature-first organization keeps everything related to one feature close together instead of creating huge global folders such as:

```text
controllers/
services/
repositories/
```

with dozens of unrelated files.

---

## 3. File Naming Convention

A filename such as:

```text
customer.routes.ts
```

does **not** have two file extensions.

The actual extension is only the final part:

```text
customer.routes.ts
                └─ .ts
```

`customer.routes` is simply the filename.

The middle part describes the responsibility:

```text
customer.routes.ts
customer.controller.ts
customer.service.ts
customer.repository.ts
customer.schema.ts
customer.types.ts
```

This is a naming convention, not a TypeScript requirement.

---

## 4. Responsibility of Each Layer

| Layer | Main Responsibility |
|---|---|
| Route | URL, HTTP method, middleware chain |
| Middleware | Cross-cutting request processing |
| Schema | Runtime request validation |
| Controller | HTTP input and HTTP output |
| Service | Business/application logic |
| Repository | Database access and SQL |
| `db/` | Shared PostgreSQL infrastructure |
| PostgreSQL | Persistence and data integrity |
| Error Handler | Converts failures into HTTP responses |

Dependency direction:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
PostgreSQL
```

Avoid reversing responsibilities:

```text
Repository → Controller       ❌
Service → Express Response    ❌
Controller → Raw SQL          ❌
Repository → HTTP Status Code ❌
```

---

## 5. Route Layer

A route answers:

> Which controller should handle this HTTP method and URL?

Example:

```ts
import { Router } from "express";
import { getCustomerById } from "./customer.controller.ts";

const router = Router();

router.get("/:id", getCustomerById);

export default router;
```

The route should not contain:

```text
SQL
business logic
pool.query()
```

Later, middleware can be composed directly in the route:

```ts
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateBody(createCustomerSchema),
  createCustomer
);
```

This reads naturally:

```text
authenticate
→ authorize
→ validate
→ controller
```

---

## 6. Three Different Types of Validation

Validation is not one single concern.

### 6.1 Request Validation

Question:

> Is the incoming HTTP input structurally valid?

Examples:

```text
required fields
correct data types
email format
minimum/maximum lengths
UUID format
enum values
number ranges
```

This belongs in a runtime validation schema such as Zod.

---

### 6.2 Business Validation

Question:

> Is this operation allowed according to application rules?

Examples:

```text
Can this order still be cancelled?
Can this customer place another order?
Is this restaurant currently accepting orders?
Does this user have permission to perform this action?
```

This belongs primarily in the **service layer**.

---

### 6.3 Database Integrity

Question:

> Can invalid data physically exist in PostgreSQL?

Examples:

```sql
PRIMARY KEY
FOREIGN KEY
UNIQUE
NOT NULL
CHECK
```

This belongs in PostgreSQL.

Mental model:

```text
Zod
→ request correctness

Service
→ business correctness

PostgreSQL constraints
→ data integrity
```

All three complement each other.

---

## 7. Runtime Validation with Zod

TypeScript protects code during development, but client input exists at runtime.

Never blindly trust:

```ts
req.body
req.params
req.query
```

Install Zod:

```bash
pnpm add zod
```

Example schema:

```ts
import * as z from "zod";

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100),

  email: z
    .email("Invalid email address")
    .transform((email) => email.toLowerCase()),
});

export type CreateCustomerInput =
  z.infer<typeof createCustomerSchema>;
```

One schema now provides:

```text
runtime validation
+
TypeScript type inference
```

---

## 8. Validation Middleware

Create:

```text
shared/middleware/validate-body.ts
```

```ts
import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateBody(
  schema: ZodType
): RequestHandler {
  return async (req, _res, next) => {
    req.body = await schema.parseAsync(req.body);

    next();
  };
}
```

Route:

```ts
router.post(
  "/",
  validateBody(createCustomerSchema),
  createCustomer
);
```

Flow:

```text
POST /customers
      ↓
validateBody()
      ↓
Zod parses request body
      ↓
valid?
 ┌────┴────┐
yes       no
 ↓         ↓
next()    ZodError
 ↓         ↓
controller error handler
```

If validation fails, the controller, service, and repository should not run.

---

## 9. Controller Layer

The controller handles HTTP concerns.

Example:

```ts
import type {
  Request,
  Response,
} from "express";

import * as customerService
  from "./customer.service.ts";

export async function getCustomerById(
  req: Request,
  res: Response
) {
  const customerId = req.params.id;

  const customer =
    await customerService.getCustomerById(
      customerId
    );

  res.status(200).json({
    success: true,
    data: customer,
  });
}
```

Controller responsibilities:

```text
read req.body / req.params / req.query
↓
call service
↓
choose successful HTTP status
↓
send response
```

The controller should generally not contain:

```text
SQL
pool.query()
business rules
database error codes
transaction implementation
```

---

## 10. Service Layer

The service contains application and business logic.

Example:

```ts
import * as customerRepository
  from "./customer.repository.ts";

import {
  AppError,
} from "../../shared/errors/app-error.ts";

export async function getCustomerById(
  customerId: string
) {
  const customer =
    await customerRepository.findById(
      customerId
    );

  if (!customer) {
    throw new AppError({
      statusCode: 404,
      code: "CUSTOMER_NOT_FOUND",
      message: "Customer not found",
    });
  }

  return customer;
}
```

The service asks questions such as:

```text
Does the customer exist?
Can this order be cancelled?
Can this user perform this action?
Which repositories must participate in this operation?
Should this operation run inside a transaction?
```

The service should not know about:

```text
req
res
res.status()
res.json()
```

---

## 11. Same Function Names Across Layers

It is normal for controller and service functions to have the same logical name.

Example:

```ts
import * as customerService
  from "./customer.service.ts";

export async function getCustomerById(
  req: Request,
  res: Response
) {
  const customer =
    await customerService.getCustomerById(
      req.params.id
    );

  res.json(customer);
}
```

There is no conflict because:

```text
controller function
→ getCustomerById()

service function
→ customerService.getCustomerById()
```

If named imports are used, aliases can also solve naming conflicts:

```ts
import {
  getCustomerById as getCustomerByIdService,
} from "./customer.service.ts";
```

There is no need to invent different business names for every layer.

---

## 12. Repository Layer

A repository contains persistence/database operations for one feature.

Example:

```ts
import { pool }
  from "../../db/pool.ts";

import type {
  Customer,
} from "./customer.types.ts";

export async function findById(
  customerId: string
): Promise<Customer | null> {
  const result =
    await pool.query<Customer>(
      `
        SELECT id, name, email
        FROM customers
        WHERE id = $1
      `,
      [customerId]
    );

  return result.rows[0] ?? null;
}
```

The repository knows:

```text
SQL
table names
column names
pg
PostgreSQL
```

It should not know:

```text
Express Request
Express Response
HTTP status codes
business rules
```

---

## 13. Why the Name `Repository`?

`Repository` is an architecture/design-pattern term for a layer that hides persistence details from the business layer.

The service asks:

```ts
customerRepository.findById(id);
customerRepository.findByEmail(email);
customerRepository.create(input);
```

The service does not need to know that the repository internally uses:

```sql
SELECT ...
INSERT ...
UPDATE ...
```

Mental model:

```text
Service
   ↓
"I need customer 7"
   ↓
Repository
   ↓
SQL / PostgreSQL
```

Other projects may use names such as:

```text
customer.dao.ts
customer.data.ts
customer.data-access.ts
customer.queries.ts
customer.store.ts
```

These can also be valid.

`repository` is useful when the file represents the complete persistence operations for a feature, rather than merely storing SQL strings.

---

## 14. Database Infrastructure vs Repository

Do not confuse these two responsibilities.

```text
db/
  pool.ts
  transaction.ts
```

means:

> Shared PostgreSQL infrastructure.

While:

```text
modules/customers/
  customer.repository.ts
```

means:

> Customer-specific data access.

Therefore avoid calling a customer repository something generic such as:

```text
customer.database.ts
```

because `database` usually refers to shared database infrastructure.

---

## 15. Customer Types

Example:

```text
customer.types.ts
```

```ts
export type Customer = {
  id: string;
  name: string;
  email: string;
};
```

Distinguish input types from stored entity types.

Example:

```ts
type CreateCustomerInput = {
  name: string;
  email: string;
};
```

versus:

```ts
type Customer = {
  id: string;
  name: string;
  email: string;
};
```

The client does not provide the generated database ID.

---

## 16. Repository Support for Transactions

A repository can accept either the normal pool or a transaction client.

```ts
import type {
  Pool,
  PoolClient,
} from "pg";

import { pool }
  from "../../db/pool.ts";

export type DatabaseClient =
  Pool | PoolClient;
```

Example repository:

```ts
export async function findByEmail(
  email: string,
  db: DatabaseClient = pool
) {
  const result = await db.query(
    `
      SELECT id, name, email
      FROM customers
      WHERE email = $1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}
```

Normally:

```ts
await findByEmail(email);
```

uses the shared pool.

Inside a transaction:

```ts
await findByEmail(email, transactionClient);
```

uses the same checked-out transaction connection.

This keeps repository functions reusable.

---

## 17. Centralized Environment Configuration

Avoid accessing:

```ts
process.env.SOMETHING
```

randomly throughout the application.

Centralize configuration:

```text
config/env.ts
```

```ts
import * as z from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      "development",
      "test",
      "production",
    ])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  DATABASE_URL: z
    .string()
    .min(1),

  DB_POOL_MAX: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  DB_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .positive()
    .default(2000),

  DB_QUERY_TIMEOUT_MS: z.coerce
    .number()
    .positive()
    .default(5000),
});

export const env =
  envSchema.parse(process.env);
```

Benefits:

```text
one source of truth
runtime configuration validation
proper TypeScript types
clear defaults
fail-fast startup
```

---

## 18. Centralized PostgreSQL Pool

Create one pool for the application:

```text
db/pool.ts
```

```ts
import { Pool } from "pg";

import { env }
  from "../config/env.ts";

export const pool = new Pool({
  connectionString:
    env.DATABASE_URL,

  max:
    env.DB_POOL_MAX,

  connectionTimeoutMillis:
    env.DB_CONNECTION_TIMEOUT_MS,

  query_timeout:
    env.DB_QUERY_TIMEOUT_MS,
});

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error
  );
});
```

Every repository imports this shared pool.

Do not create separate pools for:

```text
customers
orders
payments
products
```

If each feature created its own pool with:

```text
max = 10
```

then multiple pools could create far more database connections than expected.

---

## 19. Database Connection Lifecycle

The pool belongs to the application lifetime.

Normal request lifecycle:

```text
Application starts
      ↓
Pool created once
      ↓
HTTP request
      ↓
Repository
      ↓
pool.query()
      ↓
Pool provides idle connection
or creates one if allowed
      ↓
SQL executes
      ↓
Result returned
      ↓
Connection automatically returned to pool
      ↓
Connection stays idle and reusable
      ↓
Next request reuses it
```

When the application shuts down:

```ts
await pool.end();
```

This closes pool connections gracefully.

---

## 20. Transaction Connection Lifecycle

Transactions are different because all statements must use the same PostgreSQL connection.

```text
pool.connect()
      ↓
one PoolClient checked out
      ↓
BEGIN
      ↓
query
      ↓
query
      ↓
COMMIT / ROLLBACK
      ↓
client.release()
      ↓
connection returns to pool
```

Always release the checked-out client.

Failure to release clients repeatedly can cause:

```text
connection leaks
→ fewer available connections
→ connection exhaustion
```

---

## 21. Centralized Transaction Helper

Avoid repeating transaction boilerplate throughout services.

Create:

```text
db/transaction.ts
```

```ts
import type {
  PoolClient,
} from "pg";

import { pool }
  from "./pool.ts";

export async function withTransaction<T>(
  work: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await work(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}
```

Service usage:

```ts
return withTransaction(
  async (tx) => {
    const customer =
      await customerRepository.create(
        input,
        tx
      );

    await auditRepository.create(
      {
        action: "CUSTOMER_CREATED",
        customerId: customer.id,
      },
      tx
    );

    return customer;
  }
);
```

Both repositories now use the same PostgreSQL transaction.

---

## 22. Standard Success Response Shape

Use one predictable API contract.

Single resource:

```json
{
  "success": true,
  "data": {
    "id": "7",
    "name": "Samad"
  }
}
```

List response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Optional TypeScript type:

```ts
export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};
```

Do not return unrelated response shapes such as:

```text
{ customer: ... }
{ result: ... }
{ value: ... }
```

from different endpoints without a reason.

---

## 23. Standard Error Response Shape

Use a consistent error contract:

```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer not found"
  }
}
```

Validation example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

The frontend can consistently rely on:

```text
success
data
error.code
error.message
error.details
```

---

## 24. `AppError`

Expected application failures should use a predictable error type.

```text
shared/errors/app-error.ts
```

```ts
type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({
    statusCode,
    code,
    message,
    details,
  }: AppErrorOptions) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
```

Usage:

```ts
throw new AppError({
  statusCode: 404,
  code: "CUSTOMER_NOT_FOUND",
  message: "Customer not found",
});
```

The service describes the business failure.

It does not call:

```ts
res.status(...)
res.json(...)
```

---

## 25. Express 5 Centralized Error Handling

Express 5 automatically forwards thrown errors and rejected Promises from `async` route handlers to error-handling middleware.

Therefore a normal async controller does not need repetitive `try/catch` only to forward errors.

Example controller:

```ts
export async function createCustomer(
  req: Request,
  res: Response
) {
  const customer =
    await customerService.createCustomer(
      req.body
    );

  res.status(201).json({
    success: true,
    data: customer,
  });
}
```

If the service or repository rejects:

```text
controller Promise rejects
↓
Express 5
↓
central error middleware
```

Callback-based asynchronous APIs may still require:

```ts
next(error);
```

because they are not automatically part of the Promise chain.

---

## 26. Central Error Handler

Create:

```text
shared/errors/error-handler.ts
```

```ts
import type {
  ErrorRequestHandler,
} from "express";

import {
  DatabaseError,
} from "pg";

import {
  ZodError,
} from "zod";

import {
  AppError,
} from "./app-error.ts";

export const errorHandler:
  ErrorRequestHandler =
  (
    error,
    _req,
    res,
    next
  ) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error instanceof AppError) {
      res
        .status(error.statusCode)
        .json({
          success: false,

          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });

      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,

        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",

          details:
            error.issues.map(
              (issue) => ({
                field:
                  issue.path.join("."),

                message:
                  issue.message,
              })
            ),
        },
      });

      return;
    }

    if (error instanceof DatabaseError) {
      if (error.code === "23505") {
        res.status(409).json({
          success: false,

          error: {
            code:
              "DATABASE_CONFLICT",

            message:
              "Resource already exists",
          },
        });

        return;
      }

      if (error.code === "23503") {
        res.status(409).json({
          success: false,

          error: {
            code:
              "REFERENCE_CONFLICT",

            message:
              "Related resource conflict",
          },
        });

        return;
      }
    }

    console.error(error);

    res.status(500).json({
      success: false,

      error: {
        code:
          "INTERNAL_SERVER_ERROR",

        message:
          "Internal server error",
      },
    });
  };
```

The error handler should be registered after routes.

---

## 27. Specific PostgreSQL Constraint Errors

A SQLSTATE code such as:

```text
23505
```

means:

```text
unique violation
```

but does not identify which unique rule failed.

Large applications should also inspect:

```ts
error.constraint
```

Example:

```ts
if (
  error.code === "23505" &&
  error.constraint ===
    "customers_email_key"
) {
  // customer email conflict
}
```

This lets one central handler distinguish different database conflicts.

---

## 28. Business Check vs Database Constraint

Suppose the service checks whether an email already exists:

```ts
const existing =
  await customerRepository.findByEmail(
    input.email
  );

if (existing) {
  throw new AppError({
    statusCode: 409,
    code: "CUSTOMER_EMAIL_EXISTS",
    message:
      "A customer with this email already exists",
  });
}
```

This improves the application flow but is not a concurrency-safe replacement for:

```sql
UNIQUE(email)
```

Two simultaneous requests could both perform the check before either inserts.

Therefore:

```text
Service check
→ useful business behavior

PostgreSQL UNIQUE
→ final integrity guarantee
```

Use both when appropriate.

---

## 29. 404 Middleware

Unknown routes should also follow the same error contract.

Create:

```text
shared/middleware/not-found.ts
```

```ts
import type {
  RequestHandler,
} from "express";

import {
  AppError,
} from "../errors/app-error.ts";

export const notFound:
  RequestHandler =
  (req) => {
    throw new AppError({
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
      message:
        `Route ${req.method} ${req.originalUrl} not found`,
    });
  };
```

Flow:

```text
no route matched
↓
notFound middleware
↓
AppError
↓
central error handler
```

---

## 30. Request ID Middleware

Production applications receive many concurrent requests.

A request ID helps correlate logs belonging to one request.

```text
shared/middleware/request-id.ts
```

```ts
import {
  randomUUID,
} from "node:crypto";

import type {
  RequestHandler,
} from "express";

export const requestId:
  RequestHandler =
  (req, res, next) => {
    const id =
      req.header("x-request-id")
      ?? randomUUID();

    res.locals.requestId = id;

    res.setHeader(
      "x-request-id",
      id
    );

    next();
  };
```

Example:

```text
Request ID:
cf57ecf2-e087-4ae4-95c9-cfbad9a7547e
```

Later, structured logging can attach this ID to every log produced by the request.

---

## 31. Middleware Order

Middleware order matters because Express executes middleware in registration order.

A typical pipeline is:

```text
Incoming Request
       ↓
Request ID / Context
       ↓
Security Middleware
       ↓
Body Parsing
       ↓
Request Logging
       ↓
Router
       ↓
Authentication
       ↓
Authorization
       ↓
Validation
       ↓
Controller
       ↓
Service
       ↓
Repository
       ↓
PostgreSQL
```

After all routes:

```text
No route matched
       ↓
404 Middleware
       ↓
Central Error Handler
```

The central error handler should be registered last.

---

## 32. `app.ts`

`app.ts` configures the Express application.

```ts
import express from "express";

import customerRouter
  from "./modules/customers/customer.routes.ts";

import {
  requestId,
} from "./shared/middleware/request-id.ts";

import {
  notFound,
} from "./shared/middleware/not-found.ts";

import {
  errorHandler,
} from "./shared/errors/error-handler.ts";

export const app =
  express();

app.disable("x-powered-by");

app.use(requestId);

app.use(
  express.json({
    limit: "1mb",
  })
);

app.get(
  "/health",
  (_req, res) => {
    res.status(200).json({
      success: true,

      data: {
        status: "ok",
      },
    });
  }
);

app.use(
  "/api/customers",
  customerRouter
);

app.use(notFound);

// Error middleware should be last.
app.use(errorHandler);
```

`app.ts` should focus on application configuration and middleware wiring.

It should not contain feature SQL or business logic.

---

## 33. `server.ts`

`server.ts` owns the process lifecycle:

```text
startup
database readiness
listen()
shutdown
pool.end()
```

Example:

```ts
import {
  app,
} from "./app.ts";

import {
  env,
} from "./config/env.ts";

import {
  pool,
} from "./db/pool.ts";

async function startServer() {
  await pool.query("SELECT 1");

  const server =
    app.listen(
      env.PORT,
      () => {
        console.log(
          `Server running on port ${env.PORT}`
        );
      }
    );

  async function shutdown(
    signal: string
  ) {
    console.log(
      `${signal} received`
    );

    server.close(
      async () => {
        await pool.end();

        process.exit(0);
      }
    );
  }

  process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
  );

  process.on(
    "SIGINT",
    () => shutdown("SIGINT")
  );
}

startServer();
```

Separation:

```text
app.ts
→ configures Express

server.ts
→ starts and stops the process
```

This also makes application testing easier.

---

## 34. Successful Request Example

Request:

```http
POST /api/customers
```

Body:

```json
{
  "name": "Samad",
  "email": "samad@example.com"
}
```

Complete flow:

```text
HTTP Request
      ↓
Request ID Middleware
      ↓
express.json()
      ↓
Customer Router
      ↓
Zod Validation
      ↓
Controller
      ↓
Service
      ↓
Business Rules
      ↓
Repository
      ↓
pool.query()
      ↓
PostgreSQL
      ↓
INSERT + RETURNING
      ↓
Connection returned to pool
      ↓
Repository returns Customer
      ↓
Service returns Customer
      ↓
Controller
      ↓
201 Response
```

Example response:

```json
{
  "success": true,
  "data": {
    "id": "7",
    "name": "Samad",
    "email": "samad@example.com"
  }
}
```

---

## 35. Validation Failure Example

Invalid request:

```json
{
  "name": "",
  "email": "hello"
}
```

Flow:

```text
request
↓
validation middleware
↓
Zod fails
↓
ZodError
↓
Express 5
↓
central error handler
↓
400 response
```

The controller, service, repository, and database are never reached.

---

## 36. Business Failure Example

Valid request but business rule fails:

```text
validation passes
↓
controller
↓
service
↓
business rule fails
↓
throw AppError
↓
controller Promise rejects
↓
Express 5
↓
central error handler
↓
409 / 404 / 403 response
```

No repeated controller `try/catch` is required just to forward the error.

---

## 37. Unexpected Database Failure Example

If PostgreSQL is unavailable:

```text
repository
↓
pool.query()
↓
database error
↓
Promise rejects
↓
service rejects
↓
controller rejects
↓
Express 5
↓
central error handler
↓
500 Internal Server Error
```

The API client should receive a safe response such as:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Internal server error"
  }
}
```

Do not expose raw PostgreSQL errors directly to clients.

---

## 38. What Belongs Where

| Concern | Correct Place |
|---|---|
| URL and HTTP method | Route |
| Authentication | Middleware |
| Authorization | Middleware and/or service depending on rule |
| Body/params/query shape validation | Schema + validation middleware |
| Reading `req.body`, `req.params`, `req.query` | Controller |
| Successful HTTP status and response | Controller |
| Business decisions | Service |
| Multi-repository workflow | Service |
| Starting transactions | Usually service through transaction helper |
| SQL | Repository |
| `pool.query()` | Repository |
| PostgreSQL connection infrastructure | `db/` |
| PostgreSQL integrity constraints | Database |
| Expected application failures | `AppError` |
| Error-to-HTTP formatting | Central error handler |
| Unknown routes | 404 middleware |
| Request tracing | Request ID middleware |
| Environment variables | `config/env.ts` |
| Express configuration | `app.ts` |
| Process startup/shutdown | `server.ts` |

---

## 39. Final Mental Model

Do not think of the backend as:

```text
Express Route
→ Database
```

Think:

```text
HTTP
↓
Middleware
↓
Validation
↓
Controller
↓
Service
↓
Repository
↓
PostgreSQL
```

The result comes back:

```text
PostgreSQL
↑
Repository
↑
Service
↑
Controller
↑
HTTP Response
```

Errors use:

```text
any layer
↓
throw / reject
↓
Express 5
↓
central error handler
↓
consistent API error response
```

---

## 40. Key Architecture Rules

1. Keep features together in feature-first folders.
2. `.routes` / `.service` / `.repository` are filename descriptors; `.ts` is the real file extension.
3. Routes define where requests go.
4. Validation middleware checks untrusted HTTP input before the controller.
5. Controllers handle HTTP concerns only.
6. Services contain business logic and orchestrate workflows.
7. Repositories contain SQL and database access.
8. `repository` is a data-access architecture term, not a Node.js requirement.
9. Controller and service functions may safely share the same logical name when imports are namespaced or aliased.
10. PostgreSQL constraints remain the final data-integrity guarantee.
11. Create one centralized PostgreSQL pool per application process.
12. Keep environment configuration centralized and validated.
13. Normal queries use the shared pool and automatically return connections.
14. Transactions must use one checked-out `PoolClient`.
15. Always release transaction clients.
16. A reusable transaction helper prevents duplicated transaction boilerplate.
17. Keep success responses consistent.
18. Keep error responses consistent.
19. Use `AppError` for expected application/business failures.
20. Let Express 5 forward async errors to centralized error middleware.
21. Never expose raw database internals to API clients.
22. Register 404 middleware after routes.
23. Register the central error handler last.
24. Use request IDs for production traceability.
25. Keep `app.ts` responsible for Express configuration and `server.ts` responsible for process lifecycle.
