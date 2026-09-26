# Module 13 — `pg` Driver & Database Integration

## 01 — PostgreSQL Connection

### 1. Installing and Configuring `pg`

**Definition:**  
`pg` (node-postgres) is the PostgreSQL driver used by Node.js applications to connect to PostgreSQL, send SQL queries, and receive results.

```bash
pnpm add pg dotenv
pnpm add -D @types/pg
```

- `pg` → PostgreSQL driver
- `dotenv` → loads environment variables
- `@types/pg` → TypeScript types for `pg`

Example `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/my_database
```

Do not hard-code database credentials in application code.

---

### 2. Creating a Connection

A PostgreSQL connection is one live session between the Node.js application and PostgreSQL.

A single connection can be created with `Client`:

```ts
import { Client } from "pg";
import "dotenv/config";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const result = await client.query("SELECT NOW()");
console.log(result.rows);

await client.end();
```

This is useful for scripts and one-off programs. A web API normally uses a connection pool instead of opening and closing a new connection for every request.

---

### 3. Connection Pool

**Definition:**  
A connection pool manages a limited number of reusable PostgreSQL connections.

Without pooling:

```text
request
→ create connection
→ run query
→ close connection
```

With pooling:

```text
request
→ borrow available connection
→ run query
→ return connection to pool
→ reuse it
```

Pooling avoids repeatedly creating PostgreSQL sessions.

---

### 4. `Pool`

Create one pool and reuse it across the application.

```ts
import { Pool } from "pg";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 2_000,
});
```

Important:

```text
Pool ≠ one connection
```

A pool manages multiple PostgreSQL connections.

---

### 5. Connection Reuse

When a query finishes, the connection normally stays alive and returns to the pool.

```text
connection
→ query finishes
→ returned to pool
→ becomes idle
→ reused by another request
```

Example:

```ts
const result = await pool.query(
  "SELECT id, name FROM customers"
);
```

`pool.query()` automatically:

1. gets an available connection,
2. executes the query,
3. returns the result,
4. releases the connection back to the pool.

---

### 6. Pool Sizing

`max` controls the maximum number of connections one pool may create.

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
```

`max: 10` means:

> At most 10 PostgreSQL connections can be active in this pool at the same time.

It does **not** mean the application can only serve 10 users.

A rough theoretical estimate is:

```text
DB operations/second
≈ pool size / average DB operation time in seconds
```

Example:

```text
10 connections
average DB operation = 10 ms

≈ 10 / 0.01
≈ 1000 DB operations/second
```

This is only an estimate. Real throughput depends on query complexity, indexes, locks, database CPU, network latency, and how many queries each request performs.

---

### 7. Connection Limits

There are two different limits.

#### Application Pool Limit

```ts
max: 10
```

This limits how many connections one backend instance can use.

#### PostgreSQL Server Limit

PostgreSQL also has a server-wide connection limit.

With several backend instances:

```text
Backend 1 → pool max 10
Backend 2 → pool max 10
Backend 3 → pool max 10
```

the database could potentially receive:

```text
30 connections
```

Pool sizing must therefore consider total connections across all application instances.

---

### 8. Connection Exhaustion

**Definition:**  
Connection exhaustion happens when every connection in the pool is busy and no idle connection is available.

```text
pool max = 10

10 busy
0 available
request 11 → waits
```

Additional requests wait until a connection is released.

---

### 9. Connection Timeout

**Definition:**  
A connection timeout limits how long the application waits to acquire or establish a PostgreSQL connection.

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2000,
});
```

```text
2000 ms = 2 seconds
```

If a connection cannot be provided within that time, the operation fails.

Mental model:

```text
connection exhaustion
→ no free connection exists right now

connection timeout
→ maximum time we are willing to wait for one
```

---

### 10. Query Timeout

**Definition:**  
A query timeout limits how long a SQL query is allowed to run before the client stops waiting.

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  query_timeout: 5000,
});
```

```text
5000 ms = 5 seconds
```

Example:

```ts
await pool.query("SELECT pg_sleep(10)");
```

With a 5-second query timeout, this fails before the 10-second sleep completes.

Important distinction:

```text
connectionTimeoutMillis
→ waiting for a database connection

query_timeout
→ waiting for the SQL query itself
```

---

## Connection Pool Mental Model

```text
HTTP requests
      ↓
Node.js / Express
      ↓
      Pool
   /   |   \
conn1 conn2 conn3 ...
   \   |   /
   PostgreSQL
```

The pool safely reuses a controlled number of PostgreSQL sessions instead of constantly creating and destroying connections.

---

## Key Rules

1. Use `Pool` for normal web APIs.
2. Create the pool once and reuse it.
3. Do not create a new pool for every request.
4. Pool connections normally stay alive and are reused.
5. `max` controls simultaneous PostgreSQL connections, not total users.
6. More connections are not automatically better.
7. Connection exhaustion means all pool connections are busy.
8. Connection timeout limits how long the app waits for a connection.
9. Query timeout limits how long a query is allowed to run.
10. Consider all backend instances when calculating total database connections.
