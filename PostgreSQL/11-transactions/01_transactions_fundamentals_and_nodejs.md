# Stage 11 — Transactions & Concurrency
## Part 1 — Transactions Fundamentals and Node.js

## 1. What problem does a transaction solve?

Sometimes one business action requires several SQL statements.

Example: placing an order may require:

```text
1. Create order
2. Create order items
3. Reduce stock
4. Save payment record
```

From the user's point of view, this is one action:

```text
Place Order
```

But internally the database may need several operations.

The problem is:

> What if the first few SQL statements succeed, but a later statement fails?

Without a transaction, the database can be left partially updated.

Example:

```text
Create order        ✓
Create order items  ✓
Reduce stock        ✓
Save payment        ✗
```

A transaction solves this by treating several SQL operations as one logical unit.

## 2. Definition

A **transaction** is a group of SQL operations treated as one logical unit of work.

```text
all operations succeed
→ COMMIT

something fails
→ ROLLBACK
```

Mental model:

```text
BEGIN
↓
query 1
↓
query 2
↓
query 3
↓
everything good?
├── yes → COMMIT
└── no  → ROLLBACK
```

## 3. `BEGIN`, `COMMIT`, and `ROLLBACK`

Start:

```sql
BEGIN;
```

Keep changes:

```sql
COMMIT;
```

Discard uncommitted changes:

```sql
ROLLBACK;
```

Example:

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 1000
WHERE id = 1;

UPDATE accounts
SET balance = balance + 1000
WHERE id = 2;

COMMIT;
```

Mental model:

```text
BEGIN
→ start transaction

SQL changes
→ uncommitted transaction work

COMMIT
→ finalize

ROLLBACK
→ discard
```

## 4. Transactions are not only for payments

Use a transaction whenever several database operations represent one business operation and should succeed or fail together.

Examples:

```text
User registration
→ create user + profile + permissions

Order creation
→ create order + items + stock changes

Booking
→ create booking + reserve seat

Inventory
→ create sale + reduce stock

Bank transfer
→ debit one account + credit another
```

The useful question is:

> Do these operations need to succeed or fail together?

## 5. What happens if one statement fails?

Suppose:

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 1000
WHERE id = 1;
```

Then another statement fails, for example because of a duplicate primary key.

PostgreSQL puts the transaction into an **aborted state**.

Later statements usually fail with:

```text
current transaction is aborted,
commands ignored until end of transaction block
```

Normally recover with:

```sql
ROLLBACK;
```

Mental model:

```text
BEGIN
↓
statement 1 succeeds
↓
statement 2 fails
↓
transaction becomes aborted
↓
ROLLBACK
```

PostgreSQL does not automatically call `ROLLBACK` for your Node.js application. Your code should explicitly do it.

## 6. `SAVEPOINT`

A normal `ROLLBACK` cancels the entire transaction.

A **savepoint** is a named checkpoint that lets you undo only the work after that checkpoint.

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 1000
WHERE id = 1;

SAVEPOINT after_first_update;

UPDATE accounts
SET balance = balance + 1000
WHERE id = 2;

ROLLBACK TO SAVEPOINT after_first_update;

COMMIT;
```

Mental model:

```text
BEGIN
↓
work A
↓
SAVEPOINT
↓
work B
↓
ROLLBACK TO SAVEPOINT
↓
undo B
keep A
```

Difference:

```text
ROLLBACK
→ cancel whole transaction

ROLLBACK TO SAVEPOINT
→ cancel only work after checkpoint
```

## 7. Node.js + `pg` transaction pattern

```js
const client = await pool.connect();

try {
  await client.query("BEGIN");

  await client.query(/* query 1 */);
  await client.query(/* query 2 */);
  await client.query(/* query 3 */);

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
→ borrow one DB connection

BEGIN
→ start transaction on that connection

client.query(...)
→ run transaction queries

COMMIT / ROLLBACK
→ finish transaction

client.release()
→ return connection to pool
```

## 8. Why one transaction must use one connection

A transaction belongs to a specific PostgreSQL connection/session.

Suppose the pool contains:

```text
Connection A
Connection B
Connection C
Connection D
```

This:

```js
const client = await pool.connect();
```

might borrow:

```text
Connection B
```

Then:

```js
await client.query("BEGIN");
```

starts the transaction on Connection B.

Every later:

```js
await client.query(...)
```

uses the same connection.

PostgreSQL sees:

```text
Connection B

BEGIN
query 1
query 2
query 3
COMMIT
```

That is how PostgreSQL knows which statements belong to which transaction.

## 9. What does `client.release()` mean?

```js
const client = await pool.connect();
```

means:

```text
borrow a connection from the pool
```

Then:

```js
client.release();
```

means:

```text
return that connection to the pool
```

It does not shut down PostgreSQL.

Mental model:

```text
pool.connect()
→ borrow

client.query(...)
→ use

client.release()
→ return
```

## 10. Why not use `pool.query()` for the whole transaction?

This is unsafe:

```js
await pool.query("BEGIN");
await pool.query(query1);
await pool.query(query2);
await pool.query("COMMIT");
```

The pool could potentially use different connections:

```text
BEGIN   → Connection A
query 1 → Connection B
query 2 → Connection C
COMMIT  → Connection A
```

Correct:

```js
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(query1);
  await client.query(query2);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
} finally {
  client.release();
}
```

Rule:

> One explicit transaction = one PostgreSQL connection/client.

## 11. How does the application know something failed?

There are two main cases.

### PostgreSQL error

Examples:

```text
unique violation
foreign key violation
check violation
deadlock
serialization failure
SQL error
```

`client.query()` rejects its Promise, JavaScript enters `catch`, and you rollback.

### Business logic problem

Sometimes SQL is valid but the business condition failed.

Example:

```sql
UPDATE products
SET stock = stock - $1
WHERE id = $2
  AND stock >= $1
RETURNING stock;
```

If there is not enough stock, zero rows may be affected.

Then your code detects it:

```js
if (result.rowCount === 0) {
  throw new Error("Insufficient stock");
}
```

That enters the same `catch`, where you rollback.

Mental model:

```text
Database error
→ pg rejects
→ catch
→ rollback
```

or:

```text
Business rule fails
→ your code throws
→ catch
→ rollback
```

## 12. Real order example

```js
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const stockResult = await client.query(
    `
    UPDATE products
    SET stock = stock - $1
    WHERE id = $2
      AND stock >= $1
    RETURNING id, stock, price
    `,
    [quantity, productId]
  );

  if (stockResult.rowCount === 0) {
    throw new Error("Product not found or insufficient stock");
  }

  const product = stockResult.rows[0];
  const total = Number(product.price) * quantity;

  const orderResult = await client.query(
    `
    INSERT INTO orders (customer_id, total, status)
    VALUES ($1, $2, 'PENDING')
    RETURNING id
    `,
    [customerId, total]
  );

  await client.query(
    `
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price
    )
    VALUES ($1, $2, $3, $4)
    `,
    [
      orderResult.rows[0].id,
      productId,
      quantity,
      product.price
    ]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

## 13. PostgreSQL transaction boundary vs external APIs

A PostgreSQL transaction can rollback PostgreSQL changes.

It cannot automatically rollback external systems.

Example:

```text
charge card through external API ✓
database insert ✗
ROLLBACK PostgreSQL
```

The rollback cannot automatically undo the card charge.

This later connects to:

```text
idempotency
outbox pattern
queues
compensating actions
```

For now remember:

> PostgreSQL transactions protect work inside PostgreSQL. External services need separate safety patterns.

## 14. Final mental model

```text
Transaction
→ one logical unit of database work

BEGIN
→ start

COMMIT
→ keep changes

ROLLBACK
→ discard uncommitted changes

SAVEPOINT
→ partial rollback checkpoint

pool.connect()
→ borrow one connection

client.query()
→ use that same connection for transaction work

client.release()
→ return connection to pool
```
