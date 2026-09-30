# Module 16 — Application Security

Notes on how to stop your app itself (Express + `pg`) from being the weak point in your database security, even when the database's own permissions are set up correctly.

---

## 1. SQL Injection

**What it is, in plain words:** SQL injection happens when you build a SQL query by gluing raw user input directly into a string, instead of treating the input as *data*. If you do this, a user can type something that isn't a normal value at all — it's actual SQL — and your database will run it as if you'd written it yourself.

**What breaks without protection — a concrete example**

Imagine a login lookup written like this (vulnerable, DO NOT use):

```js
const email = req.body.email; // comes straight from the user
const query = `SELECT * FROM users WHERE email = '${email}'`;
db.query(query);
```

If a normal user types `zara@x.com`, the query becomes:

```sql
SELECT * FROM users WHERE email = 'zara@x.com'
```

That looks fine. But if an attacker types this into the email field instead:

```
' OR '1'='1
```

the string gets glued in and becomes:

```sql
SELECT * FROM users WHERE email = '' OR '1'='1'
```

`'1'='1'` is always true, so this returns **every row in the table**, bypassing the whole point of filtering by email. That's a relatively mild example. A more dangerous one:

```
'; DROP TABLE users; --
```

becomes:

```sql
SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
```

Depending on how the driver handles multiple statements, this can delete your entire `users` table. The core problem: the database can't tell the difference between "text the user typed" and "SQL code" — because you concatenated them into one string.

**The fix: parameterized queries**

Instead of gluing the value into the SQL text, you send the SQL text and the value **separately**, using placeholders:

```js
const email = req.body.email;
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

`$1` is a placeholder. The `pg` driver sends the query text `SELECT * FROM users WHERE email = $1` and the value `email` to Postgres as two separate things. Postgres substitutes the value in *after* it has already parsed the query as SQL — so no matter what the user types (even `' OR '1'='1'`), it is only ever treated as a literal string value being compared, never as SQL syntax. There's no way for user input to "become" part of the query structure.

**Rule of thumb:** if you're ever building a query string with `+`, template literals (`` `...${x}...` ``), or string concatenation using data that came from a user, request body, query string, or anywhere outside your own code — stop, and use `$1`, `$2`, etc. instead.

---

## 2. Secrets and Environment Variables

**What it is, in plain words:** "Secrets" are values that must stay private — database passwords, API keys, JWT signing secrets. They should never be hardcoded directly into your source code, because source code ends up in Git, and Git remembers everything forever.

**What breaks without this**

```js
const pool = new Pool({
  user: 'postgres',
  password: 'my_real_password123', // hardcoded — bad
  host: 'localhost',
});
```

If this file gets committed to Git and later pushed to GitHub (even a private repo that later gets leaked, or made public by accident), the password is now in your Git *history* forever — even if you delete the line in a later commit, the old commit still has it, and anyone who clones the repo can check out that old commit and read it.

**The fix: `.env` files + `.gitignore`**

Store secrets in a `.env` file at your project root:

```
DB_USER=postgres
DB_PASSWORD=my_real_password123
DB_HOST=localhost
```

Then tell Git to never track that file, by adding it to `.gitignore`:

```
.env
```

In your code, read these values using the `dotenv` package instead of hardcoding them:

```js
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
});
```

Since `.env` is in `.gitignore`, it never gets committed — so the actual password never enters Git history at all.

**One more piece: `.env.example`**

Since `.env` itself is never committed, anyone else cloning your repo (including future-you on a new machine) won't know what variables they're supposed to set. So you commit a template file instead, with the variable *names* but no real values:

```
DB_USER=
DB_PASSWORD=
DB_HOST=
```

This file (`.env.example`) is safe to commit because it holds no secrets — just documentation of what's needed.

---

## 3. Secure Database Credentials

**What it is, in plain words:** even once secrets are out of Git, you still need to think about *which* database account your app uses to connect, and how those credentials are managed day to day.

**Key practices:**

- **Don't connect your app as `postgres`.** `postgres` is a superuser with unrestricted power. Instead, create a dedicated, limited-permission role for your app (this is exactly what we built in the PostgreSQL Security notes — `bookeasy_app`). If that connection is ever compromised, the damage is capped by whatever permissions that role actually has.
- **Rotate credentials after any exposure.** If a password is ever accidentally committed to Git, posted somewhere, or shared insecurely — even briefly — treat it as compromised and change it immediately. Deleting the leaked text later doesn't undo the exposure; the password itself is now untrustworthy.
- **Use different credentials per environment.** Your local dev database, your staging database, and your production database should not share the same password. If your local `.env` leaks (much more likely — it's on your own laptop, might get synced somewhere, etc.), it shouldn't also give access to production.
- **Never log credentials.** Be careful that connection strings, passwords, or full config objects don't accidentally end up in `console.log()` output or error logs — logs often get stored, searched, or shared more casually than people realize.

---

## 4. SSL/TLS (Encryption in Transit)

**What it is, in plain words:** SQL injection and credentials cover *who* can talk to your database and *what* they're allowed to do once connected. SSL/TLS covers a different question: is the actual network traffic between your app and the database encrypted while it travels, or can someone sitting on the network in between read it in plain text?

Without SSL/TLS, if your app and database aren't on the same trusted private network, anyone intercepting the connection (a compromised router, a malicious network operator, etc.) could potentially read your queries and results — including passwords being checked, personal data, everything — as plain, readable text.

**In practice, with `pg`:**

```js
const pool = new Pool({
  // ...other config
  ssl: { rejectUnauthorized: false },
});
```

This tells the driver to use an encrypted connection. `rejectUnauthorized: false` is a commonly-used relaxed setting for managed database providers with certificates that Node doesn't automatically trust — it still encrypts the connection, it just skips strict certificate verification. (A stricter production setup would supply the provider's actual CA certificate instead of loosening this check, but that's a refinement for later, not something to worry about yet.)

**Where this matters most in practice:** managed hosting providers like Supabase, Railway, and AWS RDS typically *require* SSL by default — if you try to connect without it, the connection will simply be refused. So in practice, once you deploy to one of these, you'll likely need this `ssl` option just to connect at all, not only as a "nice to have" security hardening step.

---

## Summary table

| Topic | Problem it solves | Key fix |
|---|---|---|
| SQL Injection | User input reinterpreted as SQL code | Parameterized queries (`$1`, `$2`, ...) |
| Secrets / env vars | Passwords hardcoded into source code end up in Git history forever | `.env` + `.gitignore` + `dotenv`, with `.env.example` as a safe template |
| Secure DB credentials | App using an over-powerful account; leaked/shared passwords | Dedicated least-privilege role, rotate on exposure, per-environment credentials, never log credentials |
| SSL/TLS | Data readable in plain text while traveling over the network | `ssl` option in `pg` Pool config; required by most managed providers |
