# Stage 11 — Transactions & Concurrency
## Part 3 — Deadlocks, Concurrency Strategies and Retries

## 1. Deadlocks

A **deadlock** happens when transactions wait on each other's locks in a cycle.

Example:

```text
Transaction A
→ holds row X
→ waits for row Y

Transaction B
→ holds row Y
→ waits for row X
```

Now:

```text
A waits for B
B waits for A
```

Neither can continue.

## 2. Simple deadlock example

Accounts:

```text
id | name
---+------
1  | Samad
2  | Ali
```

Transaction A:

```text
lock account 1
then wants account 2
```

Transaction B:

```text
lock account 2
then wants account 1
```

Possible state:

```text
Transaction A              Transaction B

owns account 1             owns account 2
waits for account 2        waits for account 1
```

That is a deadlock.

## 3. What does PostgreSQL do?

PostgreSQL does not wait forever.

It detects the deadlock and aborts one transaction.

Conceptually:

```text
Transaction A
→ continues

Transaction B
→ ERROR: deadlock detected
```

The aborted transaction should be rolled back.

In Node.js:

```js
try {
  await client.query("BEGIN");

  // locking queries

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}
```

## 4. Preventing deadlocks with consistent lock ordering

The most important practical technique:

> If multiple transactions need the same resources, acquire those locks in the same deterministic order.

Bad:

```text
Transaction A
→ lock 1
→ lock 2

Transaction B
→ lock 2
→ lock 1
```

This can create:

```text
A owns 1, waits for 2
B owns 2, waits for 1
```

Better:

```text
Transaction A
→ lock 1
→ lock 2

Transaction B
→ lock 1
→ lock 2
```

If A gets row 1 first, B waits before owning anything A needs.

No circular wait is formed.

## 5. What does "lower ID first" mean?

It is only one example of a deterministic order.

Suppose two account rows are:

```text
id = 1
id = 2
```

Both transactions follow:

```text
lock 1 first
lock 2 second
```

even if account 2 is logically the sender.

The important rule is not "lower ID" itself.

The rule is:

> Every transaction that needs the same resources should acquire them in the same order.

Possible ordering rules:

```text
smaller ID first
alphabetical key
sorted resource list
another deterministic rule
```

## 6. Inventory example

Order requires:

```text
Product 10 → Burger
Product 20 → Coke
```

Bad:

```text
Transaction A
→ lock Burger
→ lock Coke

Transaction B
→ lock Coke
→ lock Burger
```

Possible deadlock.

Better:

```text
Always lock by product_id ascending

10
then
20
```

Both transactions follow the same order.

## 7. Main ways to reduce deadlocks

```text
1. Lock rows/resources in a consistent order.

2. Keep transactions short.

3. Lock only what you actually need.

4. Avoid unnecessary SELECT ... FOR UPDATE.

5. Avoid slow external API calls while holding locks.

6. Use NOWAIT or lock_timeout when long waiting is undesirable.

7. Handle deadlock errors with rollback + retry when appropriate.
```

Deadlocks can still happen in complex systems, so applications should handle them instead of assuming they are impossible.

---

# 8. Pessimistic concurrency control

Pessimistic concurrency assumes:

> A conflict might happen, so lock the row before doing multi-step work.

Main PostgreSQL tool:

```sql
SELECT ...
FOR UPDATE;
```

Example:

```sql
BEGIN;

SELECT id, stock
FROM products
WHERE id = 1
FOR UPDATE;

-- make decisions

UPDATE products
SET stock = stock - 2
WHERE id = 1;

COMMIT;
```

Mental model:

```text
prevent conflict first
→ lock
→ do work
→ release lock at transaction end
```

Useful when:

```text
conflicts are likely
data is highly contested
you must safely read before updating
waiting is acceptable
```

Examples:

```text
inventory
seat booking
bank balance operations
shared job processing
```

---

# 9. Optimistic concurrency control

Optimistic concurrency assumes:

> Conflicts are rare, so do not lock while the user is working. Detect stale data when saving.

A common implementation uses a `version` column.

Example:

```sql
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
);
```

Initial row:

```text
id = 1
price = 5000
version = 1
```

Admin A reads:

```text
version = 1
```

Admin B also reads:

```text
version = 1
```

Admin A saves first:

```sql
UPDATE products
SET
    price = 6000,
    version = version + 1
WHERE id = 1
  AND version = 1;
```

Now:

```text
version = 2
```

Admin B later tries:

```sql
UPDATE products
SET
    price = 7000,
    version = version + 1
WHERE id = 1
  AND version = 1;
```

No row matches because the actual version is now `2`.

That detects stale data.

## 10. Node.js optimistic concurrency example

Read:

```js
const result = await pool.query(
  `
  SELECT id, name, price, version
  FROM products
  WHERE id = $1
  `,
  [productId]
);
```

Later update:

```js
const updateResult = await pool.query(
  `
  UPDATE products
  SET
    price = $1,
    version = version + 1
  WHERE id = $2
    AND version = $3
  RETURNING *
  `,
  [newPrice, productId, originalVersion]
);
```

Detect conflict:

```js
if (updateResult.rowCount === 0) {
  throw new Error(
    "This product was changed by another user. Refresh and try again."
  );
}
```

An API may return something such as:

```text
409 Conflict
```

## 11. Important UI clarification

Typing in a frontend form does **not** automatically lock the database.

Example:

```text
2:00 PM
Admin A opens product form
price = 5000
version = 1

Admin A types locally in browser for 5 minutes

Meanwhile Admin B saves
price = 6000
version = 2

2:05 PM
Admin A submits old form with version = 1
```

A short lock taken only when Admin A submits cannot tell you that Admin A originally loaded stale data five minutes earlier.

Optimistic version checking can detect it:

```text
submitted version = 1
database version = 2
→ stale update
→ reject
```

Do **not** keep a database transaction open while a human thinks or types in a browser form.

## 12. Pessimistic vs optimistic

```text
Pessimistic
→ prevent conflict before it happens
→ lock now
→ others may wait

Optimistic
→ do not lock during long user work
→ detect conflict when saving
```

Use pessimistic concurrency when:

```text
conflict likely
critical short-lived operation
safe read-before-write required
```

Use optimistic concurrency when:

```text
conflict relatively rare
users may edit for a long time
holding DB locks would be wasteful
stale updates can be detected and rejected
```

---

# 13. Retryable concurrency failures

Some errors are temporary concurrency conflicts rather than permanent business failures.

Important PostgreSQL SQLSTATE codes:

```text
40001
→ serialization_failure

40P01
→ deadlock_detected
```

With Node.js `pg`, they are usually available as:

```js
error.code
```

These can often be retried.

## 14. Why retry the whole transaction?

After a concurrency failure, database state may have changed.

So do not only retry the single failed query.

Retry the entire transaction using fresh state.

Mental model:

```text
attempt 1
→ BEGIN
→ read/check
→ write
→ concurrency failure
→ ROLLBACK

attempt 2
→ BEGIN again
→ read current state again
→ make decision again
→ write again
```

## 15. Node.js retry pattern

```js
async function runWithRetry(pool, work) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = await pool.connect();

    try {
      await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE"
      );

      const result = await work(client);

      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");

      const retryable =
        error.code === "40001" ||
        error.code === "40P01";

      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }
    } finally {
      client.release();
    }
  }
}
```

Important:

```text
serialization failure
deadlock
→ potentially retry

duplicate email
insufficient stock
invalid input
foreign key violation
→ normally do not blindly retry
```

## 16. Limit retries

Never retry forever.

Use a small limit such as:

```text
2 or 3 attempts
```

Production systems may also wait briefly between retries.

Reason:

```text
retry immediately
→ may collide again

brief backoff
→ reduce repeated collision
```

You do not need to master backoff algorithms yet.

## 17. Be careful with external side effects during retries

Dangerous:

```text
BEGIN

charge external payment API

database work
→ serialization failure

ROLLBACK

retry transaction

charge external API again
```

The user may be charged twice.

PostgreSQL cannot rollback external systems.

This later connects to:

```text
idempotency
outbox pattern
queues
compensating actions
```

Practical rule:

> Retried database transaction code should be safe to run again, especially when external side effects are involved.

---

# 18. Normal SQL statements also use transactions

Concurrency issues are not limited to explicit:

```sql
BEGIN;
...
COMMIT;
```

A standalone statement such as:

```sql
UPDATE products
SET stock = stock - 1;
```

still runs inside an implicit transaction managed by PostgreSQL.

Therefore issues such as:

```text
lock waiting
concurrent updates
deadlocks
race conditions
```

can also involve normal standalone SQL statements.

Explicit transactions mainly give you control over a larger multi-statement unit of work.

---

# 19. PostgreSQL tools vs developer responsibility

| Problem | PostgreSQL provides | Developer decides/implements |
|---|---|---|
| Group related operations | Transactions | Where transaction begins/ends |
| Failed statement | Aborted transaction state | Catch + rollback |
| Concurrent users | Concurrent DB engine | Which operations need protection |
| Normal visibility | `READ COMMITTED` | Usually use default |
| Stable snapshot | `REPEATABLE READ` | Choose when needed |
| Strongest isolation | `SERIALIZABLE` | Handle retries |
| Protect row during multi-step work | `FOR UPDATE` | Which rows to lock |
| Safe simple decrement | Atomic `UPDATE` | Write correct SQL |
| Avoid stale UI update | Version column pattern | Check version on save |
| Lock collision | Wait / `NOWAIT` / `SKIP LOCKED` | Choose desired behavior |
| Deadlock | Detection + error | Consistent order + rollback/retry |

---

# 20. Practical decision guide

Start simple.

```text
1. Can one atomic SQL statement safely do the work?
   → use it

2. Are several SQL operations one business operation?
   → use a transaction

3. Do you need to read a row and then make a critical multi-step decision?
   → consider SELECT ... FOR UPDATE

4. Does a user edit data for a long time in the UI?
   → consider optimistic version checking

5. Do multiple reads need one stable snapshot?
   → consider REPEATABLE READ

6. Is the concurrent business rule complex and must behave like serial execution?
   → consider SERIALIZABLE + retries
```

Do not automatically choose the strongest tool.

Good default thinking:

```text
READ COMMITTED
+ correct atomic SQL
+ short transactions
+ constraints
+ row locks only where needed
```

---

# 21. Final Stage 11 mental model

```text
Transaction
→ group related SQL operations

Atomicity
→ all or nothing

Consistency
→ valid database state

Isolation
→ safe interaction between concurrent transactions

Durability
→ committed changes stay saved

READ COMMITTED
→ fresh committed view per statement

REPEATABLE READ
→ stable transaction snapshot

SERIALIZABLE
→ strongest logical isolation; may require retry

Atomic UPDATE
→ check + modify in one SQL statement

FOR UPDATE
→ lock selected rows during a transaction

NOWAIT
→ fail immediately if row is locked

SKIP LOCKED
→ skip locked rows

Deadlock
→ circular lock waiting

Pessimistic concurrency
→ prevent conflict with locks

Optimistic concurrency
→ detect stale update when saving

Retry
→ rerun whole transaction after retryable concurrency failure
```

## 22. Most important developer takeaway

Do not think:

```text
"Transactions are just BEGIN and COMMIT."
```

Think:

```text
Business operation
↓
Which database operations belong together?
↓
Could concurrent requests touch the same data?
↓
Can one atomic SQL statement solve it?
↓
Do I need a lock?
↓
Do I need a stable snapshot?
↓
Could this transaction need a retry?
```

That is the practical mindset behind transactions and concurrency.
