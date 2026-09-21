# Stage 11 — Transactions & Concurrency
## Part 2 — Concurrency, Isolation and Locking

## 1. What is concurrency?

**Concurrency** means multiple transactions or SQL statements are running at the same time.

Example:

```text
User A buys a product
User B buys the same product

both requests reach PostgreSQL at nearly the same time
```

This is normal.

The important problem is:

> What happens when concurrent requests read or modify the same data?

PostgreSQL gives tools such as:

```text
transactions
isolation levels
row locks
atomic SQL statements
constraints
```

The developer chooses the correct tool for the business problem.

## 2. ACID

ACID stands for:

```text
A → Atomicity
C → Consistency
I → Isolation
D → Durability
```

### Atomicity

> All transaction operations succeed, or none are kept.

Short meaning:

```text
all or nothing
```

### Consistency

> A successful transaction should leave the database obeying its integrity rules.

Examples:

```text
PRIMARY KEY
FOREIGN KEY
UNIQUE
CHECK
NOT NULL
business invariants
```

PostgreSQL does not magically know every business rule. Developers define important rules using constraints and correct transaction logic.

### Isolation

> Concurrent transactions should not interfere with each other in unsafe ways.

Important distinction:

```text
Atomicity
→ protects one transaction from partial failure

Isolation
→ protects concurrent transactions from unsafe interaction
```

### Durability

> Once a transaction successfully commits, its changes are intended to remain saved even if the application crashes afterward.

Conceptually:

```text
COMMIT succeeds
→ committed changes remain
```

PostgreSQL supports this using internal mechanisms such as WAL and crash recovery.

## 3. Concurrency anomalies

### Dirty read

One transaction reads another transaction's uncommitted change.

Example:

```text
A changes balance 10000 → 5000
A has NOT committed

B reads 5000

A rolls back to 10000
```

B read a temporary value that never became permanent.

PostgreSQL does not allow dirty reads.

### Non-repeatable read

The same transaction reads the same row twice and sees different committed values.

Example:

```text
A reads price = 5000

B changes price to 7000 and commits

A reads again
→ 7000
```

### Phantom read

The same query is repeated, but the set of matching rows changes.

Example:

```text
A queries orders WHERE total > 5000
→ 3 rows

B inserts another matching order and commits

A runs same query again
→ 4 rows
```

The new matching row is called a phantom.

### Lost update

Two requests read the same old value and later overwrite each other's work.

Example:

```text
stock = 10

A reads 10
B reads 10

A calculates 8
B calculates 7

A writes 8
B writes 7
```

Final:

```text
7
```

Correct value should have been:

```text
10 - 2 - 3 = 5
```

One update was lost.

## 4. Atomic `UPDATE`

An **atomic `UPDATE`** means PostgreSQL checks and changes the row in one SQL statement instead of your application reading first and updating later.

Dangerous pattern:

```text
SELECT stock
↓
bring stock into Node.js
↓
calculate new stock
↓
UPDATE later
```

Another transaction can modify stock between `SELECT` and `UPDATE`.

Better:

```sql
UPDATE products
SET stock = stock - $1
WHERE id = $2
  AND stock >= $1
RETURNING stock;
```

Mental model:

```text
condition check
+
modification
→ one SQL statement
```

If no row is returned:

```js
if (result.rowCount === 0) {
  throw new Error("Insufficient stock");
}
```

Practical rule:

> If a concurrency-sensitive operation can safely be expressed in one SQL statement, prefer that before adding more complex locking.

## 5. Isolation levels

Isolation levels control how transactions observe concurrent database changes.

Important PostgreSQL levels:

```text
READ COMMITTED
REPEATABLE READ
SERIALIZABLE
```

PostgreSQL also accepts `READ UNCOMMITTED`, but it behaves like `READ COMMITTED`.

## 6. `READ COMMITTED`

This is PostgreSQL's default isolation level.

Definition:

> Each SQL statement sees data that was committed before that statement began.

Important:

```text
each statement
```

not:

```text
one fixed snapshot for the entire transaction
```

Example:

```text
price = 5000
```

Transaction A:

```sql
BEGIN;

SELECT price
FROM products
WHERE id = 1;
```

Result:

```text
5000
```

Transaction B:

```sql
UPDATE products
SET price = 7000
WHERE id = 1;

COMMIT;
```

Transaction A reads again and may now see:

```text
7000
```

Mental model:

```text
statement 1
→ committed snapshot A

statement 2
→ new committed snapshot B
```

Properties:

```text
dirty reads
→ prevented

non-repeatable reads
→ possible

result sets may change between statements
→ possible
```

Practical rule:

> Start with PostgreSQL's default `READ COMMITTED` unless a specific business requirement needs something stronger.

In Node.js:

```js
await client.query("BEGIN");
```

uses the default isolation level unless changed.

## 7. `REPEATABLE READ`

Definition:

> The transaction keeps a stable snapshot for its reads.

Start:

```sql
BEGIN TRANSACTION
ISOLATION LEVEL REPEATABLE READ;
```

Example:

```text
A reads price = 5000

B changes price to 7000
B commits

A reads again
→ still sees 5000
```

Mental model:

```text
transaction snapshot
↓
SELECT 1 → same snapshot
SELECT 2 → same snapshot
SELECT 3 → same snapshot
```

Useful when several related reads should represent one consistent point in time.

Examples:

```text
reports
multi-query calculations
consistent analytical reads
```

## 8. `SERIALIZABLE`

This is PostgreSQL's strongest standard isolation level.

Definition:

> Concurrent transactions must produce a result equivalent to some safe one-at-a-time execution order.

Important:

`SERIALIZABLE` does **not** mean PostgreSQL literally runs only one transaction at a time.

Transactions still run concurrently.

PostgreSQL detects unsafe interaction patterns.

If two transactions cannot both safely succeed:

```text
one may commit
one may fail with serialization error
```

Example:

```text
1 seat available
two transactions both try to book it
```

PostgreSQL may abort one transaction so the final result remains safe.

Start it:

```sql
BEGIN TRANSACTION
ISOLATION LEVEL SERIALIZABLE;
```

Node.js:

```js
await client.query(
  "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE"
);
```

Important consequence:

> Your application must be ready to retry serialization failures.

## 9. How to choose an isolation level

Practical rule:

```text
Most CRUD/API work
→ READ COMMITTED

Need one stable snapshot across multiple reads
→ REPEATABLE READ

Complex concurrent business rules that must behave like serial execution
→ SERIALIZABLE
```

Do not use `SERIALIZABLE` everywhere automatically.

Often better tools are:

```text
atomic UPDATE
row locks
constraints
unique constraints
correct transaction boundaries
```

## 10. Row locking with `SELECT ... FOR UPDATE`

Sometimes one atomic `UPDATE` is not enough.

You may need:

```text
read row
→ inspect values
→ make a decision
→ run more queries
→ update later
```

Problem:

> Another transaction may change the row after you read it but before you update it.

Solution:

```sql
SELECT ...
FOR UPDATE;
```

Definition:

> `SELECT ... FOR UPDATE` reads rows and acquires a row-level lock that blocks conflicting updates until the transaction finishes.

Example:

```sql
BEGIN;

SELECT id, stock, price
FROM products
WHERE id = 1
FOR UPDATE;

-- inspect and calculate

UPDATE products
SET stock = stock - 2
WHERE id = 1;

COMMIT;
```

Mental model:

```text
BEGIN
↓
SELECT ... FOR UPDATE
↓
row locked
↓
safe multi-step logic
↓
COMMIT / ROLLBACK
↓
lock released
```

## 11. What happens to another transaction?

Transaction A locks product 1.

Transaction B also asks:

```sql
SELECT *
FROM products
WHERE id = 1
FOR UPDATE;
```

By default, B waits until A finishes.

When A commits or rolls back, the lock is released and B can continue.

## 12. Does `FOR UPDATE` lock the whole table?

Normally no.

It locks the selected rows for conflicting operations.

Example:

```sql
SELECT *
FROM products
WHERE id = 1
FOR UPDATE;
```

locks product row `1`.

Other transactions can usually still work with unrelated rows.

## 13. Atomic `UPDATE` vs `FOR UPDATE`

Use an atomic `UPDATE` when one SQL statement can safely do the job:

```sql
UPDATE products
SET stock = stock - $1
WHERE id = $2
  AND stock >= $1
RETURNING stock;
```

Use `FOR UPDATE` when:

```text
you must read first
→ make a decision
→ perform multiple later operations
→ prevent the row from changing during that transaction
```

Rule:

```text
simple concurrency-sensitive change
→ atomic SQL

multi-step read-then-write logic
→ consider FOR UPDATE
```

## 14. `NOWAIT`

By default, a conflicting lock request waits.

`NOWAIT` means:

> If the row is already locked, fail immediately instead of waiting.

```sql
SELECT *
FROM orders
WHERE id = $1
FOR UPDATE NOWAIT;
```

Mental model:

```text
FOR UPDATE
→ wait if locked

FOR UPDATE NOWAIT
→ fail immediately if locked
```

## 15. `SKIP LOCKED`

`SKIP LOCKED` means:

> Ignore rows already locked by another transaction and return other available matching rows.

Common use case:

```text
background workers
job queues
order processors
notification workers
```

Example:

```sql
SELECT id, payload
FROM jobs
WHERE status = 'PENDING'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

If:

```text
Job 1 → locked by Worker A
Job 2 → available
```

Worker B can skip Job 1 and take Job 2.

Mental model:

```text
FOR UPDATE
→ wait

FOR UPDATE NOWAIT
→ fail

FOR UPDATE SKIP LOCKED
→ ignore locked rows and find another
```

## 16. `lock_timeout`

Sometimes waiting too long is not acceptable.

PostgreSQL allows:

```sql
SET LOCAL lock_timeout = '2s';
```

Example:

```sql
BEGIN;

SET LOCAL lock_timeout = '2s';

SELECT *
FROM products
WHERE id = 1
FOR UPDATE;

COMMIT;
```

Meaning:

```text
try to get lock
↓
wait if necessary
↓
2 seconds exceeded?
→ throw error
```

Difference:

```text
NOWAIT
→ wait 0 seconds

lock_timeout = '2s'
→ wait up to 2 seconds
```

## 17. `statement_timeout`

Different from `lock_timeout`.

```text
lock_timeout
→ how long may I wait to acquire a lock?

statement_timeout
→ how long may the SQL statement run overall?
```

## 18. Keep transactions short

Bad:

```text
BEGIN
→ lock rows
→ call external API
→ wait 20 seconds
→ do slow work
→ COMMIT
```

Locks may stay held during that entire time.

Better:

```text
do non-database preparation first

BEGIN
→ lock/check required rows
→ perform DB work quickly
→ COMMIT
```

Practical rule:

> Keep explicit transactions as short as reasonably possible.
