# Stage 14 — Database Application Architecture

## Module 14 — Data Access Layer

# 03 — Transactions

## 1. Service-Level Transaction Boundaries

**Definition:**  
A transaction boundary defines where a transaction begins and where it ends.

```text
BEGIN
...
COMMIT
```

or, on failure:

```text
BEGIN
...
ROLLBACK
```

The service layer usually decides the transaction boundary because it understands the complete business operation.

Example:

```text
Place Order
↓
create order
create order items
reduce stock
create payment
```

These are multiple database operations, but from the business point of view they are one use case.

If all of them must succeed or fail together, the service should wrap them in one transaction.

```ts
export async function placeOrder(
  input: PlaceOrderInput
) {
  return withTransaction(async (client) => {
    const order =
      await orderRepository.create(
        input,
        client
      );

    await orderItemRepository.createMany(
      order.id,
      input.items,
      client
    );

    await inventoryRepository.reduceStock(
      input.items,
      client
    );

    return order;
  });
}
```

Conceptually:

```text
Service: placeOrder()
↓
BEGIN

orderRepository.create()
orderItemRepository.createMany()
inventoryRepository.reduceStock()

↓
COMMIT
```

If one step fails:

```text
BEGIN
↓
create order       ✅
create order items ✅
reduce stock       ❌
↓
ROLLBACK
```

The earlier changes are undone.

### Why the service owns the boundary

A repository usually knows only its own data operation.

```text
orderRepository
→ order data

inventoryRepository
→ inventory data

paymentRepository
→ payment data
```

The service understands the larger business rule:

```text
"Placing an order requires all of these operations."
```

So:

```text
Repository
→ individual database operations

Service
→ decides which operations must succeed or fail together
```

A single SQL statement often does not need an explicit transaction wrapper because PostgreSQL already executes an individual statement atomically.

A multi-step business operation often does.

---

## 2. Passing a Transaction Client Through Repositories

All queries inside one PostgreSQL transaction must use the **same database connection**.

```ts
const client =
  await pool.connect();
```

If the service starts a transaction using that `client`, every repository participating in the transaction must use that same client.

```ts
export async function placeOrder(
  input: PlaceOrderInput
) {
  return withTransaction(async (client) => {
    const order =
      await orderRepository.create(
        input,
        client
      );

    await inventoryRepository.reduceStock(
      input.items,
      client
    );

    return order;
  });
}
```

A repository can accept either the normal pool or a transaction client.

```ts
import type {
  Pool,
  PoolClient,
} from "pg";

type DbClient =
  Pool | PoolClient;
```

Repository:

```ts
export async function create(
  input: CreateOrderInput,
  db: DbClient = pool
) {
  const result =
    await db.query<Order>(
      `
        INSERT INTO orders (
          customer_id,
          total
        )
        VALUES ($1, $2)
        RETURNING *
      `,
      [
        input.customerId,
        input.total,
      ]
    );

  return result.rows[0];
}
```

Outside a transaction:

```ts
await orderRepository.create(input);
```

uses:

```text
db = pool
```

Inside a transaction:

```ts
await orderRepository.create(
  input,
  client
);
```

uses:

```text
db = client
```

Mental model:

```text
outside transaction
→ pool

inside transaction
→ PoolClient
```

### Why this matters

If repositories internally use `pool.query()`, the pool may give them different connections:

```text
transaction
→ connection #3

orderRepository
→ connection #7

inventoryRepository
→ connection #2
```

Those queries are not part of the transaction on connection #3.

Correct:

```text
BEGIN on connection #3
↓
orderRepository       → connection #3
inventoryRepository   → connection #3
paymentRepository     → connection #3
↓
COMMIT on connection #3
```

Main rule:

> The service decides the transaction, and repositories use the transaction client they are given.

---

## 3. Reusable Transaction Helper

A reusable helper can manage the transaction lifecycle.

```ts
import type {
  PoolClient,
} from "pg";

export async function withTransaction<T>(
  callback: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await callback(client);

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

Usage:

```ts
await withTransaction(
  async (client) => {
    await repositoryA.doSomething(
      input,
      client
    );

    await repositoryB.doSomethingElse(
      input,
      client
    );
  }
);
```

This helper centralizes:

```text
getting the client
BEGIN
COMMIT
ROLLBACK
releasing the client
```

The service only focuses on the business use case.

---

## 4. Rollback on Failure

**Definition:**  
`ROLLBACK` undoes all database changes made inside the current transaction.

```ts
await client.query("BEGIN");

await orderRepository.create(
  input,
  client
);

await inventoryRepository.reduceStock(
  input.items,
  client
);

await paymentRepository.create(
  input.payment,
  client
);

await client.query("COMMIT");
```

If all operations succeed:

```text
BEGIN
↓
create order    ✅
reduce stock    ✅
create payment  ✅
↓
COMMIT
```

The changes become permanent.

If one operation fails:

```text
BEGIN
↓
create order    ✅
reduce stock    ✅
create payment  ❌
↓
ROLLBACK
```

PostgreSQL undoes the earlier successful operations from that transaction.

This gives all-or-nothing behavior.

---

## 5. Why Rethrow After Rollback

A transaction catch block should usually rollback and then rethrow the original error.

```ts
catch (error) {
  await client.query("ROLLBACK");

  throw error;
}
```

These solve different problems:

```text
ROLLBACK
→ restore database state

throw error
→ tell the application that the operation failed
```

Avoid swallowing the error:

```ts
catch (error) {
  await client.query("ROLLBACK");
}
```

If the error is not rethrown, the application may continue as if the operation succeeded.

Correct flow:

```text
error occurs
↓
ROLLBACK
↓
rethrow error
↓
central error handler
↓
API failure response
```

---

## 6. Releasing the Client

The checked-out database client must always be returned to the pool.

```ts
finally {
  client.release();
}
```

`finally` runs whether the transaction commits successfully or rolls back after failure.

Connection lifecycle:

```text
get client
↓
BEGIN
↓
run operations
↓
success?
├── yes → COMMIT
└── no  → ROLLBACK
           ↓
           rethrow error
↓
release client
```

`client.release()` returns the connection to the pool so it can be reused.

---

## 7. Final Transaction Mental Model

```text
Service
↓
decides transaction boundary
↓
withTransaction()
↓
gets one PoolClient
↓
BEGIN
↓
passes same client to repositories
↓
Repository A
Repository B
Repository C
↓
success?
├── yes → COMMIT
└── no  → ROLLBACK
           ↓
           throw error
↓
release client
```

Key rules:

```text
1. Transaction boundaries normally belong to the service layer.

2. Every query in one transaction must use the same PoolClient.

3. Pass that client through every participating repository.

4. On failure, rollback the entire transaction.

5. After rollback, rethrow the error.

6. Always release the client in finally.
```
