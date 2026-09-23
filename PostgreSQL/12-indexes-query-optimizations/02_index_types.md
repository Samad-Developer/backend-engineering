# Stage 12 — Database Performance
## 02 — Index Types

## 1. B-tree

A **B-tree is PostgreSQL's default and most common index type**.

```sql
CREATE INDEX idx_users_email
ON users(email);
```

is normally a B-tree index.

Explicit form:

```sql
CREATE INDEX idx_users_email
ON users USING BTREE(email);
```

B-tree keeps indexed values ordered in a tree-like structure.

Simplified visual:

```text
          50
        /    \
      20      80
     /  \    /  \
   10   30  60   90
```

Searching for `60`:

```text
60 > 50 → right
60 < 80 → left
→ 60
```

B-tree is useful for:

```text
=
<
<=
>
>=
BETWEEN
ORDER BY
```

Examples:

```sql
WHERE email = 'samad@gmail.com'
WHERE price > 5000
WHERE price BETWEEN 1000 AND 5000
ORDER BY created_at
```

Developer role:

> You choose the indexed column(s). PostgreSQL builds and maintains the B-tree internally.

---

## 2. Hash Index

A **Hash index is mainly designed for equality (`=`) searches**.

```sql
CREATE INDEX idx_users_email_hash
ON users USING HASH(email);
```

Conceptually:

```text
value
→ hash function
→ bucket
→ matching index entry
→ table row location
```

Comparison:

```text
B-tree → =, <, >, BETWEEN, ORDER BY
Hash   → mainly =
```

B-tree is more common because it is more flexible.

---

## 3. GIN

GIN stands for **Generalized Inverted Index**.

Useful for:

- arrays
- JSONB
- full-text search

Example:

```sql
CREATE INDEX idx_products_tags_gin
ON products USING GIN(tags);
```

Useful query:

```sql
WHERE tags @> ARRAY['gaming']
```

Conceptually:

```text
electronics → rows 1, 2
office      → rows 1, 3
gaming      → row 2
```

GIN is useful when you need to search **inside** complex values containing multiple searchable pieces.

---

## 4. GiST

GiST stands for **Generalized Search Tree**.

Useful for:

- ranges
- geometric data
- spatial queries
- overlap checks
- nearest-neighbor-style searches

Example:

```sql
CREATE INDEX idx_reservations_period
ON reservations
USING GIST(reserved_period);
```

Mental model:

```text
B-tree → normal ordered comparisons
GIN    → elements inside complex values
GiST   → specialized relationships such as ranges and geometry
```

---

## 5. BRIN

BRIN stands for **Block Range Index**.

Useful for very large tables where values roughly follow the physical row order.

Common examples:

- logs
- events
- audit records
- append-only tables
- time-series data

Example:

```sql
CREATE INDEX idx_logs_created_at_brin
ON logs USING BRIN(created_at);
```

Conceptually:

```text
Block range 1 → Jan 1 to Jan 5
Block range 2 → Jan 6 to Jan 10
Block range 3 → Jan 11 to Jan 15
```

Mental model:

```text
B-tree → precise general-purpose lookup
BRIN   → small summary index for huge naturally ordered tables
```

---

## 6. Index Type Summary

| Type | Main Use |
|---|---|
| B-tree | Equality, ranges, sorting |
| Hash | Equality |
| GIN | Arrays, JSONB, full-text search |
| GiST | Ranges, geometry, specialized search |
| BRIN | Huge naturally ordered tables |

For normal backend development, **B-tree is the main index type**.
