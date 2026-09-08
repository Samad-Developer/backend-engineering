# 07 — Foreign Keys and JOINs 
**Project:** BookEasy — PostgreSQL + raw SQL (Phase 1, Module 4 of backend roadmap)
**Stage:** C — Relationships (The Heart of Relational Databases)

---

## The Problem JOINs Solve

`SELECT * FROM bookings` returns raw foreign key numbers:
```
 id | user_id | venue_id | booking_date
----+---------+----------+--------------
  1 |       1 |        1 | 2026-09-10
```

Useless to a human — you see `user_id = 1` but not the person's name. Without JOINs, you'd have to run a separate `SELECT` per row just to look up who "user 1" is.

**A JOIN combines rows from multiple tables into one result**, matched by their foreign key relationship, in a single query.

---

## Practice Data Used Throughout

- 10 users. Users **with** bookings: Ali(1), Sara(2 — has two), Hina(4), Usman(5), Ayesha(6), Fahad(7). Users **without**: Bilal(3), Zara(8), Hamza(9), Mahnoor(10).
- 10 venues. Venues **with** bookings: Sunset Hall(1), Grand Ballroom(2), Garden View(3), Palm Terrace(5), Marina Point(6). Venues **without**: Riverside Lawn(4), Hilltop Manor(7), City Center Hall(8), Blue Orchid(9), Elite Banquet(10).
- 7 bookings.

This deliberate imbalance (some rows matched, some unmatched) is what makes each JOIN type's difference visible.

---

## Why `users.id` and not just `id`?

Both `users` and `bookings` have a column named `id`. Writing bare `id` is ambiguous — Postgres cannot know which table you mean, and errors. **Whenever multiple tables are combined in one query, prefix every column as `tablename.columnname`.** Good practice even for unambiguous columns, so anyone reading the query knows exactly where each column comes from.

---

## 1. INNER JOIN

**Definition:** returns ONLY rows that have a match on both sides. Unmatched rows on either side are excluded entirely — not shown blank, just absent.

```sql
SELECT bookings.id, users.full_name, bookings.booking_date
FROM bookings
INNER JOIN users ON bookings.user_id = users.id
ORDER BY bookings.id;
```
Result: 7 rows — all bookings, now with real names instead of ids. **Bilal, Zara, Hamza, and Mahnoor do not appear at all**, because they have no matching booking row.

**`JOIN` alone = `INNER JOIN`** — the word `INNER` is optional in Postgres; they are identical.

**Table order doesn't matter for INNER JOIN** — personally verified: `FROM bookings INNER JOIN venues` and `FROM venues INNER JOIN bookings` returned identical results. The relationship is symmetric.

**`FROM` does not control output columns.** Which table sits after `FROM` has nothing to do with which columns you get back — that's decided entirely by the `SELECT` list. (This stops being irrelevant for LEFT/RIGHT JOIN — see below.)

---

## 2. LEFT JOIN

**Definition:** returns ALL rows from the LEFT table (the one right after `FROM`), matched or not. Where there's no match, the right table's columns come back empty (`NULL`).

```sql
SELECT users.id, users.full_name, bookings.id AS booking_id, bookings.booking_date
FROM users
LEFT JOIN bookings ON users.id = bookings.user_id
ORDER BY users.id;
```
Result: **11 rows** (vs INNER JOIN's 7). Bilal, Zara, Hamza, and Mahnoor all reappear, with blank `booking_id` and `booking_date`.

**Table order DOES matter here — personally tested:** swapping to `FROM bookings LEFT JOIN users` returned only 7 rows. Reason: `bookings` became the left table, and since every booking already has a valid user, there were no unmatched rows to "rescue." A LEFT JOIN only preserves unmatched rows from whichever table is on the LEFT — it can't preserve rows from the right table that were never there.

---

## 3. RIGHT JOIN

**Definition:** the exact mirror of LEFT JOIN — returns ALL rows from the RIGHT table (the one after `RIGHT JOIN`), matched or not.

```sql
SELECT users.id, users.full_name, bookings.id AS booking_id, bookings.booking_date
FROM bookings
RIGHT JOIN users ON users.id = bookings.user_id
ORDER BY users.id;
```
Result: 11 rows — identical to the earlier LEFT JOIN.

**Key realization (self-derived):** `A LEFT JOIN B` and `B RIGHT JOIN A` always produce identical results. Anything RIGHT JOIN can do, LEFT JOIN with the tables swapped does too — which is why **RIGHT JOIN is rarely used in real code.** Worth recognizing if encountered; LEFT JOIN is what you'll actually reach for.

---

## 4. FULL OUTER JOIN

**Definition:** LEFT JOIN + RIGHT JOIN combined — keeps ALL rows from BOTH tables, matched or not. Nothing is ever excluded.

```sql
SELECT venues.id AS venue_id, venues.name, bookings.id AS booking_id
FROM venues
FULL OUTER JOIN bookings ON venues.id = bookings.venue_id
ORDER BY venues.id;
```
Result: 12 rows — every venue appears, including all 5 with zero bookings (blank `booking_id`), AND every booking appears.

**Real use:** data audits — finding all mismatches on both sides at once ("show me everything, and highlight whatever doesn't connect"). Less common than INNER/LEFT in everyday work.

---

## 5. SELF JOIN

**Definition:** not a keyword — just a regular JOIN where a table is joined **to itself**. Needed when rows in a table relate to *other rows in that same table*.

**When it applies:** an employee's manager is also an employee; a user referred by another user; a subcategory pointing to a parent category; a comment replying to another comment. Anytime a foreign key points back into its own table.

**Demo table:**
```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id INTEGER REFERENCES employees(id)
);
INSERT INTO employees (name, manager_id) VALUES
('Sarah', NULL), ('John', 1), ('Mia', 1), ('Tom', 2);
```

**The self join:**
```sql
SELECT e1.name AS employee_name, e2.name AS manager_name
FROM employees e1
LEFT JOIN employees e2 ON e1.manager_id = e2.id
ORDER BY e1.id;
```
Result:
```
 employee_name | manager_name
---------------+--------------
 Sarah         |
 John          | Sarah
 Mia           | Sarah
 Tom           | John
```

### Table aliases — the mechanism that makes this work

A **table alias** is a temporary nickname for a table, valid only inside one query: `employees e1`. Two reasons to use them: shorter typing, and — critically here — **required when the same table appears twice**, since Postgres otherwise has no way to tell the two copies apart.

**Mental model that made it click:** imagine photocopying the table twice, then labeling one stack "e1" and the other "e2." They're two identical copies of the same paper — the labels exist purely so you can point at one or the other. Postgres assigns no meaning to `e1` or `e2`; **YOU** define what each represents by how you write the `ON` clause.

### Direction of the ON clause changes the question entirely

Personally discovered by testing both:

| `ON` clause | Question it answers | Result |
|---|---|---|
| `ON e1.manager_id = e2.id` | "Who is THIS person's manager?" | John → Sarah, Mia → Sarah, Tom → John (4 rows) |
| `ON e1.id = e2.manager_id` | "Who reports TO this person?" | Sarah → John, Sarah → Mia, John → Tom (5 rows) |

Both are valid SQL — they just answer different questions. **Before writing a self join, state the question in plain English first, then write the `ON` clause to match that sentence exactly.**

`LEFT JOIN` (not `INNER`) was used so Sarah — who has no manager — still appears with a blank, instead of vanishing.

---

## 6. CROSS JOIN

**Definition:** every possible combination of rows from both tables. No `ON` clause, no matching logic, no relationship required. 2 rows × 3 rows = 6 rows.

**Syntax — always exactly this shape:**
```sql
SELECT columns
FROM table1
CROSS JOIN table2;
```

**Worked example:**
```sql
CREATE TABLE days (day_label TEXT);
INSERT INTO days (day_label) VALUES ('Monday'), ('Tuesday'), ('Wednesday');

SELECT venues.name, days.day_label
FROM venues
CROSS JOIN days;
```
Result: 3 venues × 3 days = 9 rows, every venue paired with every day.

**Real use case — availability grids.** The `bookings` table only contains rows for dates that ARE booked; nothing says "Sunset Hall is free on Sep 11." CROSS JOIN generates the complete universe of venue×date possibilities first; you then check which of those combinations already has a booking.

Other real examples: generating every product variant (5 sizes × 4 colors = 20 combos) before inventory exists; generating every test combination (3 browsers × 4 OSes = 12 runs).

**Danger to recognize:** forgetting the `ON` clause on a normal JOIN doesn't error — Postgres silently treats it as a CROSS JOIN, multiplying row counts massively (two 1,000-row tables → 1,000,000 rows). Knowing what CROSS JOIN looks like helps spot this mistake immediately.

---

## Modeling Relationships in Real SQL

Module 1 covered these conceptually. Here they are as actual working SQL.

### One-to-Many — plain foreign key on the "many" side

Already built in Module 3: `users` → `bookings`.
```sql
user_id INTEGER NOT NULL REFERENCES users(id)
```
The same `user_id` can repeat across many booking rows — that repetition IS the "many."

### One-to-One — foreign key + UNIQUE

```sql
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  bio TEXT,
  avatar_url TEXT
);
```

**`UNIQUE` on the foreign key is the ONLY difference between one-to-many and one-to-one.** Verified: first profile for user 1 inserted fine; a second profile for the same user was rejected:
```
ERROR:  duplicate key value violates unique constraint "user_profiles_user_id_key"
DETAIL:  Key (user_id)=(1) already exists.
```

**Real use:** splitting optional/rarely-used data (bio, avatar) out of the core `users` table.

### Many-to-Many — a third join table with a composite primary key

**A third table is genuinely REQUIRED — there is no way around it.** A column holds only one value per row, so neither side can store multiple ids. The join table is the only place a *pair* of ids can repeat freely. (Postgres `ARRAY` columns could technically hold multiple ids, but that breaks normalization, loses foreign key enforcement, and makes querying painful — not the right tool for relationships.)

```sql
CREATE TABLE amenities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE venue_amenities (
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  amenity_id INTEGER NOT NULL REFERENCES amenities(id),
  PRIMARY KEY (venue_id, amenity_id)
);
```

**No `id SERIAL` column.** Instead, `PRIMARY KEY (venue_id, amenity_id)` makes the *pair* the primary key — the composite key concept from Module 1, now real. Each id can repeat individually; the exact pair cannot.

Verified rejection of a duplicate pair:
```
ERROR:  duplicate key value violates unique constraint "venue_amenities_pkey"
DETAIL:  Key (venue_id, amenity_id)=(1, 1) already exists.
```

**The 3-table JOIN payoff** — a 3-table join is just two `JOIN ... ON ...` clauses chained in one query. No new syntax:
```sql
SELECT venues.name AS venue, amenities.name AS amenity
FROM venue_amenities
JOIN venues ON venue_amenities.venue_id = venues.id
JOIN amenities ON venue_amenities.amenity_id = amenities.id
ORDER BY venues.name;
```
```
     venue      | amenity
----------------+----------
 Grand Ballroom | Parking
 Grand Ballroom | Catering
 Grand Ballroom | Pool
 Sunset Hall    | Parking
 Sunset Hall    | WiFi
```

### How to decide which JOIN type to use

1. **Do you want to exclude unmatched rows, or keep everything?** Only real matches → `INNER JOIN`. Keep everything from one side → `LEFT JOIN`. Keep everything from both → `FULL OUTER JOIN`.
2. **Which tables connect, through which columns?** For many-to-many, always start `FROM` the join table (it holds both foreign keys), then chain one `JOIN` per related table.

---

## Independent Practice Completed

Built a brand-new many-to-many from scratch (students ↔ courses) without step-by-step syntax:
```sql
CREATE TABLE students (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE courses (id SERIAL PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE student_courses (
  student_id INTEGER NOT NULL REFERENCES students(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  PRIMARY KEY (student_id, course_id)
);
```
Enrollments inserted, duplicate pair correctly rejected, and the 3-table join written independently on the first attempt:
```sql
SELECT students.name, courses.title
FROM student_courses
INNER JOIN students ON student_courses.student_id = students.id
INNER JOIN courses ON student_courses.course_id = courses.id;
```
```
  name  |   title
--------+-----------
 Zainab | Math
 Zainab | Physics
 Omer   | Math
 Rida   | Physics
 Rida   | Chemistry
```

---

## Seen But Not Formally Taught Yet

- **`CASE WHEN ... THEN ... ELSE ... END`** — SQL's if/else. Appeared in an availability-grid example (labeling rows "Booked" / "Available") but is NOT a named item on the roadmap and wasn't formally taught. Will likely come up naturally in Module 7 or later. No need to have absorbed it yet.

---

## Module 6 — Complete

All 6 JOIN types (`INNER`, `LEFT`, `RIGHT`, `FULL OUTER`, `SELF`, `CROSS`) built and verified with real data, plus all 3 relationship types modeled in working SQL (one-to-many, one-to-one via `UNIQUE`, many-to-many via join table with composite primary key).

---

## Next Up
**Module 7 — Aggregation and Grouping**: `COUNT`, `SUM`, `AVG`, `GROUP BY`, `HAVING` — answering questions like "how many bookings per venue" without looping in Node.