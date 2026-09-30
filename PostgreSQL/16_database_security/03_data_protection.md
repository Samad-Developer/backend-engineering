# Module 16 — Data Protection

Notes on how to handle sensitive data responsibly in your app and database — separate from database roles/permissions (that was the "who can run what SQL" layer), this is about "what should exist in the database at all, and how it's treated once it's there."

---

## 1. Password Hashing

**The problem:** never store a user's password as plain text. If you did, anyone with `SELECT` access to the `users` table — a careless employee, an attacker who found any way in, even a leaked backup file — could read every user's real password. Since people reuse passwords across sites, one leak like this compromises far more than just your app.

**What hashing actually does:** a hash function takes an input (the password) and produces a scrambled, fixed-length output that can't practically be reversed back into the original. You store the *hash*, never the real password.

```
"mypassword123"  →  hash function  →  "$2b$10$N9qo8uLOickgx2ZMRZoMy..."
```

At login, you don't decrypt anything — you hash whatever the user just typed and compare the two hashes:

```
stored hash:            "$2b$10$N9qo8uLOickgx2ZMRZoMy..."
hash(typed password) →  "$2b$10$N9qo8uLOickgx2ZMRZoMy..."
                          ↑ match = correct password, without ever knowing/storing the real one
```

**Why a fast hash function (like plain SHA-256) is actually the wrong choice here:** "fast" sounds like a good property, but for passwords it's backwards. If an attacker steals your hash column, they try to guess the original password by hashing millions/billions of candidate passwords and checking for a match. A fast hash function lets them try an enormous number of guesses per second. Password hashing needs to be **deliberately slow**, so that guessing becomes impractically expensive — a billion guesses might take seconds with a fast hash, but years with a properly slow one.

**In practice (Node), use `bcrypt`** — a hashing algorithm purpose-built to be slow and resistant to this kind of brute-force guessing:

```js
const bcrypt = require('bcrypt');

// signup
const passwordHash = await bcrypt.hash(plainTextPassword, 10); // 10 = cost factor (how slow)
await pool.query(
  'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
  [email, passwordHash]
);

// login
const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
const isMatch = await bcrypt.compare(plainTextPassword, result.rows[0].password_hash);
```

Small but meaningful habit: name the column `password_hash`, not `password` — it's a constant reminder (for you and anyone reading the schema) that it's never plain text.

---

## 2. Sensitive Data Handling

Passwords aren't the only thing worth protecting — phone numbers, national ID numbers, addresses, payment details all deserve care. This shows up in a few different layers:

- **At rest (in the database):** for genuinely high-sensitivity fields, consider column-level encryption (Postgres has `pgcrypto` for this) — not applied blanket across a whole schema, since it adds real complexity (you now have to manage encryption keys securely too).
- **In transit:** already covered by SSL/TLS (see Application Security notes) — encrypts data moving between app and database, or app and browser.
- **In logs:** easy to accidentally `console.log(req.body)` while debugging and leak a password, card number, or ID straight into a log file — which often gets stored/searched/shared more casually than the database itself.
- **In error messages:** a generic error like "duplicate key value violates unique constraint" is safe to return to a client; the actual row data that caused it usually isn't.

---

## 3. Don't Store Unnecessary Sensitive Data

**The principle:** the safest sensitive data is the data you never collected. If it's never stored, it can't leak, doesn't need encrypting, and doesn't need a deletion/retention policy.

**Example against `bookeasy`:** a venue owner needs to get paid, so the tempting shortcut is adding a `bank_account_number` column directly to `users`. Better question first: *does the feature need the raw value, or just a reference to something held securely by a specialized provider (like Stripe)?* In almost every real case it's the latter — payment processors exist specifically so you never have to hold full card/bank details yourself. Storing them anyway just means more liability if you're ever breached, for data your app didn't actually need to function.

**General habit:** before adding a column for something like a government ID, full card number, or precise address, ask *"raw value, or reference to it stored elsewhere securely?"*

---

## 4. Access Control

**What it is:** the application-level counterpart to the database-role least-privilege work already done. The database role (`bookeasy_app`) defines the *outer* boundary — what the app as a whole is allowed to touch. Access control is making sure an individual logged-in *user* can only see and modify *their own* data, inside that boundary.

**What goes wrong without it — concretely:**

```js
// vulnerable — trusts the id in the URL with no ownership check
app.get('/bookings/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});
```

Any logged-in user can change the URL from `/bookings/12` to `/bookings/13`, and so on, and read someone else's booking — even though the database role's permissions were correctly set up, nothing stopped one user from reading another user's row.

**The fix:** scope every query to the currently authenticated user, not just the id from the URL:

```js
app.get('/bookings/:id', async (req, res) => {
  const userId = req.user.id; // set by auth middleware after verifying login
  const result = await pool.query(
    'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
    [req.params.id, userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  res.json(result.rows[0]);
});
```

Now trying every id in sequence only ever returns rows that actually belong to the requester — anything else comes back "not found," never someone else's data.

This is also the exact problem **Row-Level Security** solves at the *database* level instead — rather than remembering to add `AND user_id = $2` to every single query by hand, RLS lets Postgres enforce that automatically, even for a query you forgot to scope.

---

## Summary table

| Topic | Problem it solves | Key fix |
|---|---|---|
| Password hashing | Plain-text passwords readable by anyone with table access | `bcrypt.hash()` on signup, `bcrypt.compare()` on login — deliberately slow, never store/compare raw passwords |
| Sensitive data handling | Sensitive fields leaking via logs, errors, or weak storage | Encrypt truly sensitive columns when warranted; keep secrets out of logs/error responses; rely on SSL/TLS in transit |
| Don't store unnecessary sensitive data | Data you never collected can't leak | Ask if a feature needs the raw value or just a reference held by a specialized provider |
| Access control | App-level logic can still leak data across users even with correct DB permissions | Scope every query to `WHERE user_id = <current logged-in user>`, not just the id from the URL |
