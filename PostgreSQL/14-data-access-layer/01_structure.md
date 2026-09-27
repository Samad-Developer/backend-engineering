# Stage 14 — Database Application Architecture

## Module 14 — Data Access Layer

# 01 — Structure

## 1. Repository Pattern

**Definition:**  
A repository is a data-access abstraction that exposes meaningful persistence operations to the service layer while hiding SQL and database-driver details.

```ts
export async function findById(
  id: string
): Promise<Customer | null> {
  const result = await pool.query<Customer>(
    `
      SELECT id, name, email
      FROM customers
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}
```

Service usage:

```ts
const customer =
  await customerRepository.findById(id);
```

Repository responsibilities include:

```text
findById()
findByEmail()
findMany()
create()
update()
deleteById()
feature-specific queries
```

Repositories may contain complex SQL. They should not contain HTTP response logic, Express objects, HTTP status codes, or business rules.

Prefer returning useful data:

```ts
return result.rows[0] ?? null;
```

instead of exposing the raw `pg` `QueryResult`.

---

## 2. Data-Access Layer

**Definition:**  
The Data-Access Layer (DAL) is the broader architectural area responsible for all database communication.

A repository is one part of the DAL.

```text
Data-Access Layer
│
├── customer.repository.ts
├── order.repository.ts
├── product.repository.ts
├── db/pool.ts
└── db/transaction.ts
```

Conceptually:

```text
Controller
   ↓
Service
   ↓
Data-Access Layer
   ↓
PostgreSQL
```

The DAL may include repositories, SQL queries, pool configuration, transaction helpers, database-specific helpers, and row mapping.

The DAL should not contain HTTP response handling, request validation, UI response formatting, or business decisions.

The DAL is an architectural layer, not necessarily a literal folder named `data-access`.

---

## 3. Service Layer

**Definition:**  
The service layer contains business logic and orchestrates application use cases.

Short rule:

```text
Service = what the application should do
```

Example:

```ts
export async function cancelOrder(
  orderId: string
) {
  const order =
    await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError({
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
      message: "Order not found",
    });
  }

  if (order.status === "DELIVERED") {
    throw new AppError({
      statusCode: 409,
      code: "ORDER_ALREADY_DELIVERED",
      message:
        "Delivered order cannot be cancelled",
    });
  }

  return orderRepository.updateStatus(
    orderId,
    "CANCELLED"
  );
}
```

The service layer handles:

```text
business rules
business calculations
use-case orchestration
calling multiple repositories
deciding whether actions are allowed
choosing transaction boundaries
throwing application/business errors
```

A service receives normal typed values:

```ts
getCustomerById(id)
createCustomer(input)
placeOrder(input)
```

It should not receive `req` or `res`, and should not contain `res.status()`, `res.json()`, or raw SQL.

Service functions should often describe use cases:

```text
registerCustomer()
placeOrder()
cancelOrder()
refundPayment()
approveRestaurant()
```

Repository functions describe data operations:

```text
create()
findById()
updateStatus()
deleteById()
```

---

## 4. Controller Responsibilities

**Definition:**  
A controller is the HTTP boundary of the application.

Short rule:

```text
Controller = HTTP in / HTTP out
```

Example:

```ts
export async function getCustomerById(
  req: Request,
  res: Response
) {
  const customer =
    await customerService.getCustomerById(
      req.params.id
    );

  res.status(200).json({
    success: true,
    data: customer,
  });
}
```

Controllers handle:

```text
req.params
req.query
req.body
calling the service
successful HTTP status
successful API response
```

Controllers should not contain SQL, business logic, database constraints, or transaction implementation.

Validation should normally run before the controller:

```ts
router.post(
  "/",
  validateBody(createCustomerSchema),
  createCustomer
);
```

A good controller is usually thin.

---

## 5. API Response Object Shape

The actual data shape sent to the UI belongs at the HTTP/API boundary.

For a small transformation, build it in the controller.

Example service result:

```ts
{
  id: "7",
  firstName: "Abdus",
  lastName: "Samad",
  email: "samad@example.com",
  passwordHash: "...",
}
```

UI response:

```ts
const response = {
  id: customer.id,
  fullName:
    `${customer.firstName} ${customer.lastName}`,
  email: customer.email,
};

res.json(response);
```

If response transformation becomes reusable or complex, use a response mapper/presenter:

```text
customer.response.ts
customer.mapper.ts
```

Example:

```ts
export function toCustomerResponse(
  customer: Customer
) {
  return {
    id: customer.id,
    fullName:
      `${customer.firstName} ${customer.lastName}`,
    email: customer.email,
  };
}
```

Mental model:

```text
Repository
→ database shape

Service
→ business/domain data

Mapper / Presenter
→ API response shape

Controller
→ sends HTTP response
```

---

## 6. Separating SQL from Controllers

SQL should stay behind the repository/data-access boundary.

Avoid:

```ts
export async function getCustomerById(
  req: Request,
  res: Response
) {
  const result = await pool.query(
    `
      SELECT id, name, email
      FROM customers
      WHERE id = $1
    `,
    [req.params.id]
  );

  res.json(result.rows[0]);
}
```

Prefer:

```text
Controller
↓
Service
↓
Repository
↓
PostgreSQL
```

Main rule:

```text
SQL stops at the repository boundary.
```

---

## 7. Reusable Database Functions

Reusable database functions remove repeated low-level database boilerplate.

Example:

```ts
export async function queryOne<T>(
  sql: string,
  values: unknown[]
): Promise<T | null> {
  const result =
    await pool.query<T>(sql, values);

  return result.rows[0] ?? null;
}
```

Repository:

```ts
export function findById(
  id: string
) {
  return queryOne<Customer>(
    `
      SELECT id, name, email
      FROM customers
      WHERE id = $1
    `,
    [id]
  );
}
```

Useful reusable helpers may include:

```text
query one row
query many rows
execute a command
transaction wrapper
pagination helpers
```

Do not over-abstract SQL. Prefer keeping SQL visible inside repositories and extracting only genuinely repetitive infrastructure.

---

## 8. Same Function Names Across Layers

Controller and service functions may use the same logical name.

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

Named imports can also be aliased.

---

## 9. Final Structure Mental Model

```text
Controller
= HTTP

Service
= Business logic

Repository
= Database access
```

Expanded:

```text
HTTP Request
     ↓
Controller
     ↓
Service
     ↓
Repository
     ↓
PostgreSQL
```
