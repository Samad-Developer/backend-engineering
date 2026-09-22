# Stage 11 — Transactions & Concurrency Decision Map

Use this file when you remember the problem but forget which PostgreSQL tool to use.

---

## 1. Main Categories

| Category | Options | Purpose |
|---|---|---|
| Transaction control | `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` | Make multiple SQL operations act as one unit |
| Isolation levels | `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE` | Control what a transaction can see while others run |
| Row locking | `FOR UPDATE`, `FOR UPDATE NOWAIT`, `FOR UPDATE SKIP LOCKED` | Control access to specific rows |
| SQL concurrency technique | Atomic `UPDATE` | Check + modify safely in one SQL statement |
| Application concurrency strategy | Optimistic versioning | Detect stale updates |
| Failure handling | Retry, lock timeout, consistent lock order | Handle deadlocks and concurrency failures |

### Important distinction

```text
READ COMMITTED
REPEATABLE READ
SERIALIZABLE
    → transaction isolation levels

FOR UPDATE
FOR UPDATE NOWAIT
FOR UPDATE SKIP LOCKED
    → row-locking tools
```

They solve different kinds of concurrency problems.

---

# 2. Concurrency Anomalies — Problem List

Keep this section as a quick reminder of the problems themselves.

| Anomaly | Short explanation |
|---|---|
| Dirty Read | Transaction A reads data changed by Transaction B before B commits |
| Non-Repeatable Read | A reads the same row twice and gets different committed values |
| Phantom Read | A runs the same condition/query twice and new or removed matching rows appear |
| Lost Update | Two transactions read the same old value, then one update overwrites the other |

### Tiny examples

#### Dirty Read

```text
B changes balance: 1000 → 500
B has NOT committed

A reads 500

B rolls back
```

A saw data that never really became committed.

PostgreSQL prevents dirty reads even at its lowest practical isolation level.

---

#### Non-Repeatable Read

```text
A reads price = 100

B updates price = 150
B commits

A reads same row again
→ 150
```

The same row changed between A's two reads.

---

#### Phantom Read

```text
A:
SELECT * FROM orders WHERE status = 'PENDING';
→ 5 rows

B inserts another PENDING order
B commits

A runs same query again
→ 6 rows
```

A new matching row appeared.

---

#### Lost Update

```text
stock = 10

A reads 10
B reads 10

A calculates 10 - 2 = 8
B calculates 10 - 3 = 7

A writes 8
B writes 7
```

Correct result should have been:

```text
5
```

One update was effectively lost.

---

# 3. Transaction Control

## `BEGIN` / `COMMIT` / `ROLLBACK`

Use when multiple SQL operations belong to one business action.

Examples:

- order + order items + stock update
- bank transfer
- booking + related records

```sql
BEGIN;

-- related SQL statements

COMMIT;
```

If something fails:

```sql
ROLLBACK;
```

Mental model:

```text
all succeed → COMMIT
anything fails → ROLLBACK
```

---

# 4. Atomic UPDATE

Use when the check and modification can happen safely in one SQL statement.

Example:

```sql
UPDATE products
SET stock = stock - $1
WHERE id = $2
  AND stock >= $1
RETURNING stock;
```

Choose this when:

```text
simple condition
+
simple update
+
one SQL statement can solve it
```

Prefer it over:

```text
SELECT
→ calculate in Node.js
→ UPDATE
```

because another request could change the row in between.

---

# 5. Row Locking Family

These belong to the same category.

## `FOR UPDATE`

Use when you must:

```text
read row
→ inspect/calculate
→ do more work
→ update row
```

Example:

```sql
BEGIN;

SELECT *
FROM accounts
WHERE id = $1
FOR UPDATE;

-- business logic
-- update row

COMMIT;
```

Conflicting transactions normally wait.

---

## `FOR UPDATE NOWAIT`

Use when:

```text
row free
→ lock it

row already locked
→ fail immediately
```

Example:

```sql
SELECT *
FROM orders
WHERE id = 500
FOR UPDATE NOWAIT;
```

Good for cases where the UI should immediately say:

```text
"This record is currently being modified."
```

---

## `FOR UPDATE SKIP LOCKED`

Use when locked rows should be skipped.

Example:

```sql
SELECT *
FROM jobs
WHERE status = 'PENDING'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

Good for background workers:

```text
Worker A locks Job 1
Worker B skips Job 1
Worker B takes Job 2
```

---

# 6. Isolation Levels

Isolation levels control how a transaction sees concurrent database changes.

## `READ COMMITTED`

PostgreSQL default.

Use for:

```text
normal CRUD
most APIs
standard transactions
```

Each statement sees committed data available when that statement starts.

---

## `REPEATABLE READ`

Use when several reads inside one transaction must see the same snapshot.

Example:

```text
financial report
→ total orders
→ revenue
→ refunds
→ customers
```

```sql
BEGIN TRANSACTION
ISOLATION LEVEL REPEATABLE READ;

SELECT ...;
SELECT ...;
SELECT ...;

COMMIT;
```

Mental model:

```text
same transaction
→ same snapshot
```

---

## `SERIALIZABLE`

Use for complex concurrent business rules where you want the result to behave as if transactions ran one after another.

```sql
BEGIN TRANSACTION
ISOLATION LEVEL SERIALIZABLE;

-- complex reads and writes

COMMIT;
```

PostgreSQL may reject one transaction with:

```text
40001
serialization_failure
```

Then:

```text
ROLLBACK
→ retry whole transaction
```

Do not automatically use `SERIALIZABLE` for every concurrency problem.

---

# 7. Last Seat / Booking Decision

The phrase "last seat" does not automatically mean `SERIALIZABLE`.

## Simple seat counter

```sql
UPDATE events
SET available_seats = available_seats - 1
WHERE id = $1
  AND available_seats > 0
RETURNING available_seats;
```

Use:

```text
Atomic UPDATE
```

---

## Multi-step seat logic

If you must read the seat, inspect it, create related records, then update it:

```text
Transaction
+
FOR UPDATE
```

---

## Complex booking invariant

If correctness depends on several rows/queries interacting concurrently:

```text
SERIALIZABLE
+
retry
```

---

# 8. Optimistic Concurrency — Version Column

Use when a user reads data, keeps it for some time, then saves later.

Example:

```text
Admin A loads version 3
Admin B saves → version becomes 4
Admin A submits old version 3
```

Column:

```sql
version INTEGER NOT NULL DEFAULT 1
```

Update:

```sql
UPDATE products
SET
  price = $1,
  version = version + 1
WHERE id = $2
  AND version = $3
RETURNING *;
```

Zero rows updated means:

```text
someone changed the row after you loaded it
```

Good for:

```text
admin forms
profiles
CMS editing
long-lived browser forms
```

---

# 9. Pessimistic vs Optimistic

| Strategy | Meaning | Main tool |
|---|---|---|
| Pessimistic | Prevent conflict before it happens | `FOR UPDATE` |
| Optimistic | Allow work, detect stale save later | `version` column |

Memory rule:

```text
protect row now
→ FOR UPDATE

user may edit for minutes
→ version column
```

---

# 10. Deadlocks

Deadlock:

```text
A locks row 1
B locks row 2

A waits for row 2
B waits for row 1
```

PostgreSQL detects this and aborts one transaction.

SQLSTATE:

```text
40P01
```

Reduce deadlocks by locking shared rows in a consistent order.

Example:

```text
accounts 3 and 8

always:
3 → 8
```

even if the transfer direction is:

```text
8 → 3
```

Also:

- keep transactions short
- lock only required rows
- avoid slow external API calls while holding locks

---

# 11. Retry Strategy

Usually retry:

```text
40001 → serialization failure
40P01 → deadlock detected
```

Pattern:

```text
BEGIN
→ run whole transaction
→ error
→ ROLLBACK
→ retry whole transaction
```

Do not blindly retry normal business errors such as:

```text
invalid input
insufficient stock
foreign-key violation
real unique conflict
```

---

# 12. Quick Decision Map

```text
Multiple SQL statements must succeed together?
→ TRANSACTION

Check + update can happen in one SQL statement?
→ ATOMIC UPDATE

Need to read a row, decide, then update?
→ FOR UPDATE

Need lock but do not want to wait?
→ FOR UPDATE NOWAIT

Need to ignore locked rows and take another?
→ FOR UPDATE SKIP LOCKED

Multiple reads need the same snapshot?
→ REPEATABLE READ

Complex concurrent transaction must behave serially?
→ SERIALIZABLE + RETRY

User loaded data earlier and saves later?
→ OPTIMISTIC VERSION COLUMN

Several transactions lock the same rows?
→ CONSISTENT LOCK ORDER

PostgreSQL returns 40001 or 40P01?
→ ROLLBACK + RETRY WHOLE TRANSACTION
```

---

# 13. Real-World Scenario Table

| Problem | Usually choose |
|---|---|
| Reduce stock safely | Atomic `UPDATE` |
| Bank transfer | Transaction + `FOR UPDATE` |
| Old admin form save | Optimistic versioning |
| Multi-query financial report | `REPEATABLE READ` |
| Simple last-seat counter | Atomic `UPDATE` |
| Multi-step seat booking | Transaction + `FOR UPDATE` |
| Complex booking invariant | `SERIALIZABLE` + retry |
| Fail immediately if row locked | `FOR UPDATE NOWAIT` |
| Multiple queue workers | `FOR UPDATE SKIP LOCKED` |
| Order + items + stock | Transaction |
| Same rows locked by several transactions | Consistent lock order |

---

# 14. Final Mental Model

```text
one-statement race
→ Atomic UPDATE

multi-step row logic
→ FOR UPDATE

do not wait for lock
→ NOWAIT

skip locked work
→ SKIP LOCKED

same read snapshot
→ REPEATABLE READ

complex transaction-wide concurrency rule
→ SERIALIZABLE

stale browser/form save
→ optimistic versioning

multiple dependent writes
→ transaction
```
