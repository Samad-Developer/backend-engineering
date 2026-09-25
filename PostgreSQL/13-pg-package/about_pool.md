# About Connection Pools (pg / node-postgres)

Personal notes — questions I had about connection pooling and the answers that resolved them.

---

## What I already understood correctly

A `Pool` keeps up to a max number of connections (e.g. 10). When a request comes in:
- If an idle connection exists → it's handed out, used, then returned to the pool
- If all connections are busy but max not reached → a new one is created
- If max is reached → the request queues and waits for a free connection

This part was correct from the start.

---

## Question 1 — Who "hits enter" / authenticates in production? There's no login prompt in my backend.

**The confusion:** Locally, connecting means typing `psql -U postgres` and entering a password, or clicking "Connect" in pgAdmin. In a deployed backend, there's no human and no enter button — so who does that step?

**The answer:** Nobody does it manually — it was never a special manual step to begin with. `psql` typing a password is just a *person* performing the same thing a program does: opening a TCP connection to Postgres and sending credentials to authenticate. `pg`'s `new Pool({...})` does the exact same handshake in code — host, port, user, password, database — using credentials read from environment variables instead of typed by a human. The very first time a connection is needed, `pg` opens the connection and authenticates automatically, in milliseconds, with zero human involvement. In production, the `host` in the config points to the real database server's network address instead of `localhost`, but the mechanism is identical.

---

## Question 2 — Only 10 connections max. So only 10 requests can ever be served? What about 1,000 requests at once — isn't that way too slow?

**The confusion:** If the pool caps at 10 connections, it seemed like only 10 requests could ever be handled at a time, and everyone else would be stuck waiting a long time — seemed like a bad design for real traffic.

**The answer:** The reasoning about queuing was correct, but the conclusion was based on not knowing how fast a single query actually is. A query typically takes single-digit milliseconds (proven earlier with `EXPLAIN ANALYZE` — an indexed lookup took 0.061 ms). At ~5ms per query, one connection can serve ~200 queries/second; 10 connections in parallel ≈ ~2,000 queries/second. For 1,000 simultaneous requests, the last one in line waits roughly (1000 ÷ 10) × 5ms ≈ 500ms in a worst-case all-at-once burst — not the minutes-long pile-up it sounded like.

**Why not just set max very high (e.g. 10,000) to avoid any wait?** Postgres itself has a hard connection limit (default ~100), and every open connection costs Postgres real memory/CPU even when idle. Too many connections makes Postgres slower, not faster. Pool size (commonly 10–20 per app instance) is tuned to what Postgres can handle efficiently.

**At genuinely massive scale:** the fix isn't raising the pool number — it's adding more app server instances (each with its own pool), using a dedicated connection pooler like PgBouncer in front of Postgres, or scaling the database itself (read replicas, etc.). These are real, standard, larger-scale solutions — not needed for a learning project's traffic level.

---

## Question 3 — Why use a Pool at all? What's actually wrong with a plain direct connection per request?

**The confusion:** Wanted a concrete reason a Pool is necessary instead of just connecting directly when a request comes in.

**The answer, with the actual failure mode:**

A naive direct-connection approach opens a brand-new connection on every single request:
```js
app.get('/venues', async (req, res) => {
  const client = new Client({ /* config */ });
  await client.connect();   // new connection, every request
  const result = await client.query('SELECT * FROM venues');
  await client.end();
  res.json(result.rows);
});
```

This is worse on two fronts:
1. **Slower per request** — opening a new TCP connection + doing Postgres's auth handshake takes real time (~20–50ms+, multiple network round trips) — paid on *every* request, on top of the query itself.
2. **Fails outright under real traffic** — if 200 requests arrive close together, this tries to open 200 brand-new connections at once. Postgres has a hard cap (~100 default) — the excess connection attempts don't queue, they get **rejected** with real errors shown to real users. This is a known failure mode called **connection exhaustion**.

**What the Pool fixes:**
- Reuses already-open, already-authenticated connections — the handshake cost is paid once per connection, not once per request
- Caps total connections so Postgres is never overwhelmed no matter how much traffic spikes
- Queues extra requests gracefully instead of rejecting them outright

So it isn't "pool = slower but safe vs. direct = fast but risky" — direct connections are both slower in normal operation AND fragile under load. The pool wins on both.

---

## Question 4 — When a connection is returned to the pool, does it stay connected, or does it disconnect and "wake up" again on the next request?

**The answer:** Stays connected. A connection returned to the pool remains open and authenticated the whole time it sits idle — it does not disconnect. The expensive handshake (TCP connect + Postgres auth) happens once, when a connection is first created; after that, the same live connection gets reused repeatedly.

- **First time a connection is needed** (no idle ones available) → a real new connection is opened, full handshake happens (~20–50ms, genuinely a bit slow)
- **Every time after that** → the pool hands out an already-connected, already-authenticated connection instantly — no handshake, no delay

An idle connection in the pool is a live, open connection to Postgres, not a disconnected one that reconnects on demand.

---

## The full request lifecycle, put together

```
Express app starts
   -> new Pool({...}) created ONCE at startup
      (connections are opened lazily as needed, up to max — not all 10 immediately)

User's browser sends an HTTP request -> Express receives it
   -> route handler calls pool.query('SELECT ...')
   -> pool hands out an already-open connection
      (or opens + authenticates a new one if none are idle and max not reached)
   -> Postgres runs the query (milliseconds), returns the result
   -> connection is returned to the pool, staying alive and idle, ready for next use
   -> Express sends the JSON response back to the browser
```

No manual "connect" step exists anywhere in this lifecycle — `psql` was always just a human performing the same handshake `pg` performs in code, thousands of times a second, each one taking milliseconds.
