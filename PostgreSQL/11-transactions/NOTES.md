# 11 — Transactions 
**Project:** BookEasy — PostgreSQL + raw SQL (Phase 1, Module 4 of backend roadmap)
**Stage:** D — Correctness and Safety
**Significance:** The most important correctness concept for a booking app — solves the double-booking race condition mentioned at the very start of this journey.

---

## The Core Problem

Some operations have multiple steps that are only correct if ALL happen or NONE do. A half-completed operation is worse than no operation.

Classic example — a money transfer:
1. Subtract 5,000 from Customer's wallet
2. Add 5,000 to VenueOwner's wallet

If step 1 succeeds and the server crashes before step 2, the customer lost 5,000 that went nowhere. The database is now in a broken, inconsistent state, with no automatic way to know.

---

## Definition (interview-ready)

**"A transaction is a group of one or more database operations treated as a single, indivisible unit — either all of them succeed and are saved together, or if any one fails, all of them are undone, leaving the database exactly as it was before."**

Short version: *"A set of operations that all succeed together or all fail together — never partially."*

---

## The Three Commands

- `BEGIN` — start a transaction (changes are held pending, not yet permanent)
- `COMMIT` — everything worked, save it all permanently, together
- `ROLLBACK` — something went wrong, undo everything since `BEGIN`

### Successful transaction (verified)
```sql
BEGIN;
UPDATE wallets SET balance = balance - 5000 WHERE owner = 'Customer';
UPDATE wallets SET balance = balance + 5000 WHERE owner = 'VenueOwner';
COMMIT;
```
Both changes saved together at `COMMIT`. Customer 5000→0, VenueOwner 1000→6000.

### Failed transaction — automatic rollback (verified)
```sql
BEGIN;
UPDATE wallets SET balance = balance - 5000 WHERE owner = 'Customer';    -- succeeded
UPDATE wallets SET balance = balance - 99999 WHERE owner = 'VenueOwner'; -- FAILED (CHECK: balance >= 0)
COMMIT;
```
Step 1 ran and subtracted 5000. Step 2 failed the check constraint. Postgres then **automatically rolled back the entire transaction** — output showed `ROLLBACK`, not `COMMIT`. Final balances: Customer still 5000 (NOT 0), VenueOwner still 1000. **The customer's money was fully protected** — step 1 was undone as if it never happened.

Without a transaction, each UPDATE saves independently — step 1 would have permanently taken the 5000, and step 2's failure would leave the money in limbo.

### Manual ROLLBACK (verified)
You can also roll back deliberately when your own logic decides to abort:
```sql
BEGIN;
UPDATE wallets SET balance = balance - 1000 WHERE owner = 'Customer';
ROLLBACK;   -- balance stays unchanged
```

---

## ACID — What Transactions Guarantee

**ACID is not separate from transactions — it's the four guarantees that transactions provide.** "Transaction" is the tool; "ACID" is the list of promises it makes.

| Letter | Guarantee | Meaning |
|---|---|---|
| **A** — Atomicity | All-or-nothing | The whole transaction happens or none of it does |
| **C** — Consistency | Valid → valid | Moves the DB from one valid state to another; all constraints (`CHECK`, `FOREIGN KEY`, `NOT NULL`) still hold. Can't leave data rule-breaking |
| **I** — Isolation | No cross-corruption | Concurrent transactions don't corrupt each other; each behaves as if running alone. (This is the double-booking protection) |
| **D** — Durability | Survives crashes | Once committed, permanently saved — survives a power failure a millisecond later (via the write-ahead log) |

**Conceptual or code?** Mostly conceptual — ACID describes what the database guarantees, not commands you write. You write transactions (`BEGIN`/`COMMIT`) and the DB automatically provides A, C, D. The only one you sometimes actively reach for is **I (Isolation)** — when you need stronger isolation than default (e.g. `FOR UPDATE` for booking).

There is no separate "ACID module" — ACID is just the vocabulary for what transactions do. In an interview: "transactions provide ACID guarantees" + being able to name the four = correct depth.

---

## Isolation & Locking — Solving the Double-Booking Race Condition

Atomicity is about steps WITHIN one transaction. The double-booking problem is about ISOLATION — two SEPARATE transactions running at the same time.

### The race condition
Two customers try to book the last slot simultaneously:
1. A checks "is the slot free?" → yes
2. B checks "is the slot free?" → yes (A hasn't booked yet)
3. A books it
4. B books it too → **double-booked**

### The fix: SELECT ... FOR UPDATE (row-level locking)
```sql
BEGIN;
SELECT id, is_booked FROM slots
  WHERE venue_name = 'Sunset Hall' AND slot_date = '2026-12-25'
  FOR UPDATE;                          -- locks THIS row
UPDATE slots SET is_booked = true
  WHERE venue_name = 'Sunset Hall' AND slot_date = '2026-12-25' AND is_booked = false;
COMMIT;                                -- releases the lock
```

**How it prevents the race:** the moment A runs `SELECT ... FOR UPDATE`, Postgres locks that slot row. If B tries `SELECT ... FOR UPDATE` on the same row, B is forced to **wait** until A commits. By the time B proceeds, `is_booked` is already true, so B's update finds nothing to book.

### FOR UPDATE details
- **Which rows?** Only the rows the `WHERE` matched — not the whole table. Locking is surgical.
- **Inside or outside a transaction?** Only meaningful INSIDE one. The lock is held until `COMMIT`/`ROLLBACK`; outside a transaction each statement auto-commits instantly, so the lock would release immediately and be useless.
- **Name?** Row-level locking. This form (`FOR UPDATE`) is a **pessimistic lock** ("assume conflict, lock preemptively"). Optimistic locking is a Phase 2/3 alternative.

### Does locking make everyone wait unnecessarily? NO.
`FOR UPDATE` locks only the specific rows matched by `WHERE`. Booking a *different* date or *different* venue = different row = not locked, proceeds freely. Only people fighting over the *exact same slot* wait — which is exactly when they should. The one mistake to avoid: locking too broadly (e.g. no `WHERE`) would lock every row and queue all bookings pointlessly. Rule: **lock the narrowest set of rows representing the contested resource.**

---

## The Real Booking Pattern (KEY — resolved a big confusion)

**You do NOT write two queries ("if last seat do this, else do that"). You do NOT ask "is this the last seat" first.** You write ONE pattern that's always safe, whether it's the last seat or one of a hundred:

```sql
BEGIN;
  SELECT ... FROM seats WHERE <specific seat> FOR UPDATE;    -- lock it
  UPDATE seats SET is_booked = true
    WHERE <specific seat> AND is_booked = false;             -- only books IF still free
COMMIT;
```

The `AND is_booked = false` in the UPDATE is what makes it safe. Then check **how many rows the UPDATE affected**:
- 1 row affected → success, you got it
- 0 rows affected → someone beat you to it, tell the user "just taken"

### Verified with a live two-session simulation
Two real concurrent sessions raced for one seat:
1. Session A ran `SELECT ... FOR UPDATE` → locked the row, held it
2. Session B tried the same → **forced to wait**, hung there blocked
3. A did `UPDATE 1` (booked), `COMMIT` → lock released
4. B unblocked, ran its UPDATE → **`UPDATE 0`** (zero rows) because `is_booked` was now true, so its `WHERE ... AND is_booked = false` matched nothing

Final: Customer A got the seat, Customer B got nothing, no double-booking.

### In real Node code (Module 13 preview)
```ts
const result = await client.query(
  `UPDATE seats SET is_booked = true, booked_by = $1
   WHERE venue_name = $2 AND slot_date = $3 AND is_booked = false`,
  [customerName, venue, date]
);
if (result.rowCount === 0) {
  throw new Error('Sorry, that slot was just booked.');  // lost the race
}
// else: won the race, success
```
`result.rowCount` tells you whether you won or lost — no need to ask in advance.

### Full transaction pattern in Node (the ROLLBACK you actually write)
In raw SQL, errors auto-rollback so you rarely type `ROLLBACK`. In app code you ALWAYS write it, in a catch block:
```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE wallets SET balance = balance - 5000 WHERE ...');
  await client.query('UPDATE wallets SET balance = balance + 5000 WHERE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');   // you write this
  throw error;
} finally {
  client.release();
}
```

---

## Judgment: When Do You Need What? (the actual skill)

The tell for needing a lock: **is there a check-then-act on data others could change at the same time?**

| Scenario | Answer | Why |
|---|---|---|
| Update a user's profile bio | Neither | Single update, one row, no check-then-act |
| Transfer loyalty points A→B | Transaction | Two ops must both happen or neither (atomicity). Becomes "both" if a balance check could race |
| Two users claim the same one-use discount code | Both | Check-then-act on a contested resource → lock + transaction |
| Insert a new venue | Neither | Independent insert, nothing to check first |
| Read order history to display | Neither | Pure read, nothing to make atomic or lock |

The distinction — transaction (atomicity) vs lock (isolation) vs both — is the real skill of this module.

---

## Module 9 — Complete
Transactions (`BEGIN`/`COMMIT`/`ROLLBACK`), atomicity proven via wallet rollback, the full ACID model as the guarantees transactions provide, row-level locking with `SELECT ... FOR UPDATE`, the double-booking fix verified with a live concurrent simulation, the "one safe pattern + check rowCount" approach, and the judgment of when each tool is needed.

---

## Next Up
**Module 10 — Indexes and Performance**: what an index really is, why lookups are slow without one, reading `EXPLAIN` output, and when to add an index (and the cost of over-indexing).