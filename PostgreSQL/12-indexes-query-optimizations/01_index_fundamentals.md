# Stage 12 — Database Performance
## 01 — Index Fundamentals

## 1. What Is an Index?

An **index is a separate data structure maintained by PostgreSQL that helps it locate matching rows efficiently without scanning the whole table**.

Example:

```sql
CREATE INDEX idx_users_email
ON users(email);
```

Mental model:

```text
TABLE
→ stores actual rows

INDEX
→ separate lookup structure
→ helps PostgreSQL locate matching rows
```

PostgreSQL stores the index separately and maintains it automatically when rows are inserted, updated, or deleted.

---

## 2. Why Indexes Improve Reads

Without a useful index:

```text
row 1 → check
row 2 → check
row 3 → check
...
```

PostgreSQL may perform a **Sequential Scan**.

With an appropriate index:

```text
search index
→ narrow down matching value
→ locate table row
→ fetch row
```

Main idea:

> An index can reduce the amount of unnecessary data PostgreSQL has to examine.

---

## 3. Index Storage Cost

Indexes consume disk space because PostgreSQL stores them separately from the table data.

Example:

```text
users table = 5 GB
email index = 700 MB
city index  = 400 MB
```

Mental model:

```text
more indexes
→ more storage
```

---

## 4. Index Write Cost

Indexes improve many reads but add work to writes.

If a table has indexes on `email` and `city`, an `INSERT` may require PostgreSQL to maintain:

```text
table
+ email index
+ city index
```

The same idea applies to relevant `UPDATE` and `DELETE` operations.

Mental model:

```text
indexes
→ faster reads
→ more storage
→ more write work
```

---

## 5. When to Create Indexes

Consider an index when:

- the table is large
- the query runs frequently
- a column is frequently used in `WHERE`
- a column is frequently used in `JOIN`
- a column is frequently used in `ORDER BY`
- the condition returns only a relatively small portion of the table
- the query is important enough to justify storage and write cost

Example:

```sql
SELECT *
FROM orders
WHERE customer_id = 100;
```

Possible index:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

### Selectivity

**Selectivity describes how strongly a condition narrows the table.**

```text
1 row out of 5,000,000
→ highly selective

4,900,000 rows out of 5,000,000
→ low selectivity
```

Highly selective conditions are often strong index candidates.

---

## 6. When NOT to Create Indexes

Avoid unnecessary indexes when:

- the table is tiny
- the column is rarely queried
- most rows match the condition
- the workload is write-heavy and the index gives little read benefit
- an equivalent or redundant index already exists
- you are indexing every column "just in case"

---

## 7. Over-Indexing

**Over-indexing means creating more indexes than the workload actually needs.**

Problems:

```text
extra storage
+ extra INSERT work
+ extra UPDATE work
+ extra DELETE maintenance
```

Rule:

> Every index should justify its cost by helping real, important queries.
