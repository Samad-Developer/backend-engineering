# 10 — Data Integrity Deep-Dive 
**Project:** BookEasy — PostgreSQL + raw SQL (Phase 1, Module 4 of backend roadmap)
**Stage:** D — Correctness and Safety

---

## The Core Idea

**Data integrity means: the database itself refuses to store data that breaks your rules — so bad data literally cannot get in, no matter what the app code does or forgets to do.**

Why this matters — the key mental shift:
- **App-level validation is a REQUEST** — "please don't send bad data." It relies on every piece of code remembering to check, and having no bugs.
- **A database constraint is a GUARANTEE** — "bad data physically cannot be stored." Enforced on every single write, forever, with no exceptions.

The database is the last line of defense. Unlike app code, it never has a bug that forgets to check. It also protects you when a *second* app writes to the same database, or someone runs a manual query.

**Constraints are the tools that let the database enforce data integrity itself, rather than trusting every piece of app code to remember the rules.**

---

## The Full Set of Integrity Tools

| Constraint | Guarantees |
|---|---|
| `NOT NULL` | Column can never be empty |
| `UNIQUE` | No two rows share this value |
| `PRIMARY KEY` | Unique + not null combined (the row's identity) |
| `CHECK` | Values must satisfy a custom condition |
| `FOREIGN KEY` | Value must match a real row in another table |
| Foreign key *actions* | What happens to child rows when a parent is deleted/updated |

The first five were used across earlier modules. Module 8's new depth is in `CHECK` (more powerful than the simple form seen before) and the full set of **foreign key actions**.

---

## CHECK — enforcing custom rules

A `CHECK` constraint defines any condition a value must satisfy. Four useful forms:

```sql
age INTEGER CHECK (age >= 18)                                   -- simple comparison
discount INTEGER CHECK (discount BETWEEN 0 AND 100)             -- a range
status TEXT CHECK (status IN ('active', 'inactive', 'pending')) -- a fixed set of allowed values
CHECK (end_date > start_date)                                   -- compares TWO columns (table-level)
```

**The two-column CHECK is the powerful new form.** Because it involves more than one column, it's written separately at the table level (not attached to a single column). It lets the database guarantee relationships *between* a row's own columns — e.g. an end date can never be before a start date.

**All four verified rejecting bad data** — every invalid insert was blocked by the database itself:
- `age = 15` → rejected (below 18)
- `discount = 150` → rejected (over 100)
- `status = 'banned'` → rejected (not in allowed set)
- `end_date` before `start_date` → rejected by the two-column check

**The point:** none of this validation lives in app code. Even if the Express app had a bug and tried to insert `age = 15`, Postgres slams the door. The rule is enforced at the deepest level, once, forever.

**Real BookEasy relevance:**
- `status IN ('pending', 'confirmed', 'cancelled')` on the `bookings` table
- `CHECK (booking_end > booking_start)` for a booking's time range
- `CHECK (capacity > 0)` on venues (already in use)

These make impossible data literally impossible to store.

---

## Foreign Key Actions — the full set

Controls what happens to CHILD rows when their PARENT is deleted. The action goes on the foreign key, in the child table.

| Action | Effect on child rows when parent is deleted |
|---|---|
| `NO ACTION` (default) | Block the parent delete if any children reference it |
| `RESTRICT` | Same practical effect — block the delete |
| `CASCADE` | Delete the child rows too |
| `SET NULL` | Keep child rows, set their foreign key column to NULL |
| `SET DEFAULT` | Keep child rows, set their foreign key column to its default value |

### SET NULL — demonstrated

```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL
);
```
Deleted author 1 (who wrote 2 posts). Result: the posts SURVIVED, but their `author_id` became NULL:
```
 id |    title    | author_id
----+-------------+-----------
  3 | Third Post  |         2      (different author, untouched)
  1 | First Post  |                (was author 1, now NULL)
  2 | Second Post |                (was author 1, now NULL)
```

**Important precision:** `SET NULL` does not set *the child row* to null — it sets the child's **foreign key column** to null. The row itself survives fully intact; only the link back to the deleted parent is removed. This is the whole distinction from `CASCADE` (which deletes the entire row).

### The three behaviors compared

For the same "delete the parent" action:
- `CASCADE` → child rows deleted too
- `NO ACTION` / `RESTRICT` → parent delete blocked entirely
- `SET NULL` → child rows kept, just orphaned (FK nulled)

### Choosing the right action is a design decision

There is no universally correct choice — it depends on what the data *means*:

| Relationship | Sensible action | Why |
|---|---|---|
| booking → user | `NO ACTION` / `RESTRICT` | Don't let a user be deleted while they have bookings; don't silently erase booking/payment history (matters for records, refunds, disputes) |
| session token → user | `CASCADE` | User gone, their tokens are meaningless — delete them |
| post → author | `SET NULL` | Keep the content, just detach the (deleted) author |

The question to ask for each relationship: **what should happen to the child data when the parent disappears?** Only the business logic can answer that.

---

## Module 8 — Complete

`CHECK` constraints in depth (simple, range, allowed-set, and two-column table-level checks), and the full set of foreign key actions (`NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`) with the reasoning for choosing between them. Consolidated the `NOT NULL` / `UNIQUE` / `PRIMARY KEY` / `FOREIGN KEY` constraints seen live in earlier modules.

---

## Next Up
**Module 9 — Transactions**: `BEGIN` / `COMMIT` / `ROLLBACK` and what "atomic" really means. Solves the double-booking race condition — the core correctness problem a booking app must get right. Arguably the most important database concept for BookEasy specifically.