# Pagination

## Topic 1: LIMIT

`LIMIT` restricts the maximum number of rows returned by a SQL query.

It is commonly used when an application should return only a small portion of a larger result set.

```sql
SELECT id, name, price
FROM query_products
ORDER BY id ASC
LIMIT 5;
```

This returns at most five rows. `LIMIT 5` does not inherently mean "page 1"; it simply limits the result to five rows.

---

## Topic 2: OFFSET

`OFFSET` tells PostgreSQL how many rows to skip from the beginning of the ordered result before returning rows.

```sql
SELECT id, name, price
FROM query_products
ORDER BY id ASC
LIMIT 5
OFFSET 5;
```

The logical flow is:

```text
ORDER BY -> OFFSET -> LIMIT
```

PostgreSQL first establishes the requested ordering, skips five rows, and then returns at most five rows.

---

## Topic 3: Offset Pagination

Offset pagination divides a result set into pages by combining `LIMIT` and `OFFSET`.

For a page size of five:

```sql
-- Page 1
SELECT id, name, price
FROM query_products
ORDER BY id ASC
LIMIT 5 OFFSET 0;

-- Page 2
SELECT id, name, price
FROM query_products
ORDER BY id ASC
LIMIT 5 OFFSET 5;

-- Page 3
SELECT id, name, price
FROM query_products
ORDER BY id ASC
LIMIT 5 OFFSET 10;
```

The offset can be calculated as:

```text
OFFSET = (page - 1) * page_size
```

In Node.js:

```js
const page = 3;
const limit = 5;
const offset = (page - 1) * limit;

const result = await pool.query(
  `
    SELECT id, name, price
    FROM query_products
    ORDER BY id ASC
    LIMIT $1
    OFFSET $2
  `,
  [limit, offset]
);
```

### Why ORDER BY Is Important

Pagination works with row positions. Those positions are meaningful only when a predictable ordering is defined.

Without `ORDER BY`, PostgreSQL does not guarantee the order in which rows are returned. The apparent order can change because of query plans, indexes, updates, vacuuming, and other database operations.

Therefore:

```sql
SELECT id, name
FROM query_products
LIMIT 5 OFFSET 5;
```

should not be treated as reliable pagination ordering.

Instead, define the order explicitly:

```sql
SELECT id, name
FROM query_products
ORDER BY id ASC
LIMIT 5 OFFSET 5;
```

A useful mental model is:

> Pagination operates on positions, and `ORDER BY` defines those positions.

---

## Topic 4: Problems with Offset Pagination

Offset pagination is simple and useful, especially for small datasets and interfaces that need explicit page numbers. However, it has two important limitations.

### Deep Offsets Can Become Expensive

Consider:

```sql
SELECT id, name
FROM query_products
ORDER BY id
LIMIT 20
OFFSET 199980;
```

PostgreSQL generally has to visit or traverse enough matching rows to skip the first 199,980 positions before it can return the next 20 rows.

This does not necessarily mean PostgreSQL loads all skipped rows into application memory. With an appropriate index, PostgreSQL may traverse index entries efficiently. However, a larger offset still generally means more work.

The important distinction is:

> `OFFSET` describes how many result positions to skip; it does not provide a direct logical jump to the Nth result row.

### Data Changes Can Shift Positions

Suppose results are ordered newest first:

```text
10 9 8 7 6 5 4 3 2 1
```

Page 1:

```sql
ORDER BY id DESC
LIMIT 5 OFFSET 0;
```

returns:

```text
10 9 8 7 6
```

Now a new row with ID `11` is inserted:

```text
11 10 9 8 7 6 5 4 3 2 1
```

Page 2 uses:

```sql
ORDER BY id DESC
LIMIT 5 OFFSET 5;
```

It skips:

```text
11 10 9 8 7
```

and returns:

```text
6 5 4 3 2
```

Row `6` appears again even though it was already returned on page 1. The insertion changed the numerical positions on which `OFFSET` depends.

---

## Topic 5: Cursor / Keyset Pagination

Cursor pagination, also called keyset pagination, continues from a specific value or position in the ordered result instead of skipping a number of rows.

The main difference is:

```text
Offset pagination: "Skip N rows."
Cursor pagination: "Continue after this specific position."
```

Suppose the data is ordered by increasing numeric IDs in descending order:

```text
10 9 8 7 6 5 4 3 2 1
```

First page:

```sql
SELECT id, name
FROM query_products
ORDER BY id DESC
LIMIT 5;
```

returns:

```text
10 9 8 7 6
```

The last ID, `6`, becomes the cursor.

The next request uses:

```sql
SELECT id, name
FROM query_products
WHERE id < 6
ORDER BY id DESC
LIMIT 5;
```

which returns:

```text
5 4 3 2 1
```

The query does not ask PostgreSQL to skip five rows. It asks PostgreSQL to continue below a known key value.

### DESC Is Not Required

`DESC` is used when larger IDs represent newer rows and the application wants newest rows first.

Cursor pagination can also use ascending order:

```sql
SELECT id, name
FROM query_products
WHERE id > $1
ORDER BY id ASC
LIMIT $2;
```

The comparison operator must match the chosen ordering and the meaning of "next" in that ordering.

---

## Topic 6: Cursor Pagination and Newly Inserted Rows

Cursor pagination prevents earlier insertions from shifting the continuation point, but it does not automatically inject new rows that appear before the cursor into an existing forward traversal.

Suppose page 1 returns:

```text
10 9 8 7 6
```

and the cursor is `6`.

If row `11` is inserted before the next request, this query:

```sql
SELECT id, name
FROM query_products
WHERE id < 6
ORDER BY id DESC
LIMIT 5;
```

still returns:

```text
5 4 3 2 1
```

It does not return `11`, because `11` is before the saved cursor position.

This is intentional. Cursor pagination solves:

> Continue reliably from where the previous page ended.

It does not solve:

> Continuously inject every newly created row above the user's current scroll position.

Applications such as feeds commonly handle newer rows separately—for example, by refreshing from the beginning, polling for newer records, or displaying a message such as "3 new posts".

---

## Topic 7: Stable Pagination Ordering

Stable pagination ordering means the `ORDER BY` clause deterministically establishes the position of every row.

A single ordering column may not be unique.

For example:

```sql
ORDER BY price DESC;
```

Suppose the data contains:

```text
price | id
------+---
5000  | 17
5000  | 16
5000  | 15
5000  | 1
2500  | 2
```

If a page ends at price `5000` and the cursor stores only:

```text
cursor = 5000
```

then the next query might be:

```sql
WHERE price < 5000
ORDER BY price DESC
```

That would skip any remaining rows whose price is also `5000`.

The problem is that `price` alone does not uniquely identify the last row's position.

### Add a Unique Tie-Breaker

Use a unique column such as the primary key after the main sorting column:

```sql
ORDER BY price DESC, id DESC;
```

Now rows with the same price are ordered by ID.

```text
price | id
------+---
5000  | 17
5000  | 16
5000  | 15
5000  | 1
```

The sorting priority is left to right:

1. `price DESC`
2. `id DESC` only when prices are equal

This produces a deterministic position for every row.

A practical rule is:

> For stable pagination, the ordering should end with a unique tie-breaker.

A common production ordering is:

```sql
ORDER BY created_at DESC, id DESC;
```

`created_at` provides chronological ordering, while the unique `id` resolves rows that have exactly the same timestamp.

---

## Topic 8: Composite Cursors

When the ordering depends on multiple columns, the cursor must contain the values needed to represent the last row's position in that same ordering.

For simple ordering:

```sql
ORDER BY id DESC;
```

the cursor can contain only:

```js
const cursor = lastProduct.id;
```

But with:

```sql
ORDER BY price DESC, id DESC;
```

the cursor becomes a composite cursor:

```js
const cursor = {
  price: lastProduct.price,
  id: lastProduct.id,
};
```

This is why a cursor is not necessarily a single ID. It represents the position needed to continue the exact ordering used by the query.

For example, if the previous page ends at:

```text
price = 5000
id = 16
```

then the cursor is conceptually:

```text
(5000, 16)
```

The next page can be queried explicitly as:

```sql
SELECT id, name, price
FROM query_products
WHERE
    price < 5000
    OR (price = 5000 AND id < 16)
ORDER BY price DESC, id DESC
LIMIT 4;
```

This means:

- take rows with a lower price, or
- if the price is still `5000`, take rows whose ID comes after `16` according to `id DESC`.

PostgreSQL supports a cleaner row-value comparison:

```sql
SELECT id, name, price
FROM query_products
WHERE (price, id) < (5000, 16)
ORDER BY price DESC, id DESC
LIMIT 4;
```

For this ordering, it expresses the same continuation rule much more compactly.

### Cursor Shape Follows the Ordering

```text
ORDER BY id
-> cursor: id

ORDER BY created_at, id
-> cursor: { created_at, id }

ORDER BY price, id
-> cursor: { price, id }
```

The core rule is:

> The cursor must contain the values required to uniquely represent the last row's position in the query's ordering.

---

## Topic 9: Cursor Pagination with UUIDs

Cursor pagination does not require an auto-incrementing numeric ID. It requires a stable and sortable ordering.

With an increasing numeric ID, a simple condition is natural:

```sql
WHERE id < $1
ORDER BY id DESC
```

A random UUID does not normally represent creation order, so using the UUID alone as the chronological cursor is usually not appropriate.

Instead, use a meaningful sortable column such as `created_at`, followed by the unique UUID as a tie-breaker:

```sql
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT $3;
```

The cursor can contain:

```json
{
  "created_at": "2026-09-09T14:30:00Z",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Here:

- `created_at` determines chronological position.
- `id` uniquely resolves ties when two rows have the same timestamp.

The UUID's order does not need to represent time when it is being used only as the unique tie-breaker.

---

## Topic 10: Cursor Pagination in Express and PostgreSQL

A backend API can return the last row's cursor to the frontend. The frontend sends that cursor back when requesting the next page.

Assume the required ordering is:

```sql
ORDER BY price DESC, id DESC
```

A complete Express route can be implemented as follows:

```js
import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get("/products", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 4;

    const cursorPrice = req.query.cursorPrice
      ? Number(req.query.cursorPrice)
      : null;

    const cursorId = req.query.cursorId
      ? Number(req.query.cursorId)
      : null;

    let query;
    let values;

    if (cursorPrice === null || cursorId === null) {
      query = `
        SELECT id, name, category, price, rating
        FROM query_products
        ORDER BY price DESC, id DESC
        LIMIT $1
      `;

      values = [limit];
    } else {
      query = `
        SELECT id, name, category, price, rating
        FROM query_products
        WHERE (price, id) < ($1, $2)
        ORDER BY price DESC, id DESC
        LIMIT $3
      `;

      values = [cursorPrice, cursorId, limit];
    }

    const result = await pool.query(query, values);
    const products = result.rows;
    const lastProduct = products[products.length - 1];

    const nextCursor = lastProduct
      ? {
          price: lastProduct.price,
          id: lastProduct.id,
        }
      : null;

    res.json({
      products,
      nextCursor,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### First Request

```text
GET /products?limit=4
```

There is no cursor yet, so the backend runs:

```sql
SELECT id, name, category, price, rating
FROM query_products
ORDER BY price DESC, id DESC
LIMIT $1;
```

Suppose the last returned product is:

```json
{
  "id": 6,
  "name": "Desk",
  "price": "15000.00"
}
```

The API returns a cursor containing both ordering values:

```json
{
  "nextCursor": {
    "price": "15000.00",
    "id": 6
  }
}
```

### Next Request

The frontend sends those values back:

```text
GET /products?limit=4&cursorPrice=15000&cursorId=6
```

The backend runs:

```sql
SELECT id, name, category, price, rating
FROM query_products
WHERE (price, id) < ($1, $2)
ORDER BY price DESC, id DESC
LIMIT $3;
```

with parameters:

```js
[15000, 6, 4]
```

The complete flow is:

```text
First request
    ↓
ORDER BY price DESC, id DESC
LIMIT 4
    ↓
Return products
    ↓
Take last product
    ↓
nextCursor = { price, id }
    ↓
Frontend sends cursor back
    ↓
WHERE (price, id) < (cursorPrice, cursorId)
    ↓
Return next page
```

---

## Topic 11: Offset Pagination vs Cursor Pagination

Offset pagination and cursor pagination solve the same broad problem—returning data in smaller portions—but use different continuation strategies.

| Feature | Offset Pagination | Cursor Pagination |
|---|---|---|
| Continuation | Skip N rows | Continue after a known position |
| Typical SQL | `LIMIT ... OFFSET ...` | `WHERE key < cursor LIMIT ...` |
| Page numbers | Easy | Not naturally page-number based |
| Deep-page performance | Can degrade with large offsets | Usually better for sequential traversal |
| Inserts before current position | Can shift rows and cause duplicates/skips | Does not shift the saved continuation point |
| Implementation | Simpler | Requires cursor design |
| Common use | Admin tables, small datasets, numbered pages | Feeds, infinite scroll, large/changing datasets |

Neither approach is universally correct. The choice depends on the application's navigation requirements, data size, ordering, and how frequently the underlying data changes.
