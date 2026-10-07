# Auth Notes: Login, Sessions, Tokens and Permissions

Oct 7, 2026 · @Abdus samad

## 1. Authentication: proving who you are

HTTP forgets you after every request. The server sees each request as a stranger, so something must let a user prove who they are, once, and let the server believe it afterwards. Proving identity means showing something only that person should have: something they **know** (a password), **have** (a phone, a passkey) or **are** (a fingerprint that unlocks a passkey). Using two of these together is MFA.

### Email and password

**Signup**

1. Take the email and password.
2. Hash the password with **bcrypt** (cost 10 or more). Never store the password itself.
3. Insert `email` (lowercased) and `password_hash` into `users`. Make `email` `UNIQUE`. A duplicate raises Postgres error `23505`, which you turn into a `409`.

**Login**

1. Find the user by lowercased email.
2. Run `bcrypt.compare(typedPassword, storedHash)`.
3. If the email is unknown or the password is wrong, return the **same** message: "Invalid email or password". Different messages tell attackers which emails are registered.
4. On success the server gives the browser a credential (the next section).

**Why bcrypt and not a normal hash.** A fast hash such as SHA-256 lets an attacker try billions of guesses per second against a stolen table. bcrypt is slow on purpose and adds a random salt, so every guess is expensive and two identical passwords produce different hashes.

**A small leak to know about.** If the email does not exist, the server answers faster because it skips the bcrypt compare, so response time can reveal which emails exist. The fix is a dummy compare when the user is not found. Optional for a first build.

### Sign in with Google (described, not run)

Here you do not check a password at all. Google vouches for the person.

1. Your app sends the browser to Google, with a random `state` value.
2. The user logs in at Google and approves.
3. Google sends the browser back to your app with a one-time `code`.
4. Your **server** exchanges that `code` (plus a secret only the server knows) directly with Google and receives who the user is: a stable Google id and a verified email.
5. Your server finds or creates a local user, then continues exactly as if they had used a password: it issues its own credential.

Two rules matter. The identity key is Google's user id, not the email. And only link a Google login to an existing email account when Google says the email is verified, otherwise someone could claim an address that is not theirs. Store these logins in a separate table so one user can have several ways to sign in.

```sql
auth_accounts(id, user_id, provider, provider_user_id, UNIQUE(provider, provider_user_id))
```

### Other ways to answer "who are you"

Magic links and email codes (you prove you own the inbox), passkeys (a key pair on your device, the server stores only the public half) and company single sign-on. Whatever method is used, it ends the same way: the server is now sure who the user is, and moves on to remembering them.

## 2. Session management: how the server keeps knowing it is you

After a successful login the server gives the browser a **credential**, and the browser attaches it to every later request. Without it, the user would have to send the password again on every page load and every API call. The credential has to meet three needs: the server can **verify** it quickly, the user cannot **forge** it, and it can be **ended** (logout, expiry, stolen device).

There are two ways to build it. The difference is one question: does the server keep a record, or not?

### Design A: Sessions (the server stores a record)

The server creates a row, for example `{ id: 'a1b2c3', user_id: 5, expires_at }` in a `sessions` table, and sends only the random `id` to the browser in a cookie. The id means nothing by itself. On every request the server looks the id up in the database. If the row exists and has not expired, the request belongs to user 5.

### Design B: JWT (the server stores nothing)

The server builds a token with three parts, `header.payload.signature`. The payload carries facts such as `userId`, `role` and an expiry time `exp`. The signature is a hash of the header and payload made with a **secret that only the server knows**. On every request the server recomputes the signature from the token it received. If it matches, nobody changed the payload, so the claims can be trusted. **No database lookup happens.**

Two questions come up every time:

- **How does the server accept a token it never stored?** It does not remember tokens. It remembers one thing, its secret. Only someone holding that secret could produce a matching signature, so a valid signature is the proof.
- **Who counts the 15 minutes?** Nobody runs a timer. `exp` is just a timestamp inside the token. On each request the server compares `exp` to its own clock, and rejects the token once the time has passed.

A JWT payload is **readable by anyone**. It is signed, not encrypted. The signature stops changing it, not reading it, so never put secrets in it.

&#91;embedded content: session vs JWT · what is stored where\]

The only difference is whether the server keeps a record. The rest of this section follows from it.

### What lives in the database, and what does not

| Item | In the database? | What the browser holds |
| --- | --- | --- |
| Session (Design A) | Yes, a row per login | Random session id |
| Access JWT (Design B) | No | The token itself |
| Refresh token (section 3) | Yes, only its hash | The random token |
| Passwords | Yes, only the bcrypt hash | Nothing, ever |

### Issues with sessions

| Issue | What it means |
| --- | --- |
| A database read on every request | Each request costs a lookup, though a fast store such as Redis reduces it |
| Shared store when you scale | Every server instance must reach the same session store |
| Awkward across services | A second service must query the first one's session data |
| Cookie-based, so CSRF applies | The browser sends the cookie automatically, so forged cross-site requests need defending against |
| Dead rows pile up | Expired sessions must be cleaned out |
| Session fixation | Always issue a **new** id at login, never reuse one from before |

The strength of sessions is control: delete the row and the user is logged out immediately.

### Issues with JWT

| Issue | What it means |
| --- | --- |
| Cannot be revoked before `exp` | A stolen token works until it expires, and logout only makes the client forget it |
| Frozen claims | A role inside the token is stale if you change it on the server |
| Readable payload | Anyone can decode it, so it holds nothing secret |
| One secret protects everything | If it leaks, anyone can forge a token for any user |
| Storage temptation | Putting it in `localStorage` lets any XSS bug steal it |
| Larger than a session id | It travels on every request |

The strength of a JWT is that any service holding the secret can verify it without a shared database.

Neither design is wrong. Sessions give control and cost a lookup. A pure JWT gives speed and cannot be revoked. The next section combines their strengths.

## 3. The best model: a short access token plus a refresh token

The model that works best for a web app combines the two designs: **a short-lived access token for speed, and a long-lived refresh token for control.** Each one covers the other's weakness.

|  | Access token | Refresh token |
| --- | --- | --- |
| What it is | Signed JWT with `userId` and `role` | Random 32 bytes, meaningless alone |
| Lifetime | About 15 minutes | Days, for example 7 |
| Sent | On every request | Only to the refresh route |
| Stored on the server | No | Yes, only its SHA-256 hash |
| Job | Prove identity cheaply, no database | Get a new access token without a login |

**Why it works.** About 99% of requests are checked by signature alone, with no database. A stolen access token dies in minutes. The refresh token lives in the database, so you can delete it to end a login. The access token is stateless and the refresh token is stateful, so this is a deliberate hybrid. It is not a contradiction that a "JWT system" stores something in the database.

### How it runs

1. Login returns both tokens, as cookies.
2. Each request carries the access token. The server checks signature and `exp`. No database.
3. After 15 minutes the server rejects it with `401`.
4. The client calls `/auth/refresh`. The server looks up the refresh token's hash and checks that it exists and has not expired.
5. The server signs a **new** access token, and (rotation) issues a **new** refresh token.
6. The client retries the original request. The user notices nothing.
7. If the refresh token is missing, expired or already used, the user logs in again.

&#91;embedded content: token lifecycle · 2 decisions\]

The user sees a login screen only when the refresh token is missing, expired or already used.

**Rotation.** Every refresh deletes the old refresh token and issues a new one, so each works exactly once. The code is one atomic statement: `DELETE ... WHERE token_hash = $1 AND expires_at > now() RETURNING user_id`. The check and the single use are the same step. This also explains why refresh creates both tokens: the new refresh token replaces the one just used, and its expiry slides forward while the user stays active.

**Fresh data at refresh.** The refresh route reads the user (including the role) from the database, so role changes take effect within one access-token lifetime.

**SHA-256 for refresh tokens, bcrypt for passwords.** A refresh token is 32 random bytes, so there is nothing to guess and a fast hash is enough. A password is human-chosen and guessable, so it needs a slow hash.

### Where the browser keeps them

| Place | JavaScript can read it | Sent automatically | Verdict |
| --- | --- | --- | --- |
| `localStorage` | Yes | No | Any XSS bug steals it. Avoid |
| **HttpOnly cookie** | **No** | **Yes** | Best default for web apps |

| Cookie flag | What it does |
| --- | --- |
| `HttpOnly` | JavaScript cannot read it, so XSS cannot steal it |
| `Secure` | Sent only over HTTPS. Turn on in production |
| `SameSite=Lax` | Blocks most cross-site requests, which stops most CSRF |
| `path=/auth/refresh` | The refresh cookie travels to that one route only |

### What the frontend keeps

Only two things: `user` and `status` (`loading`, `authenticated` or `unauthenticated`). It never touches a token. On page load it calls `GET /auth/me`: `200` means logged in, `401` means logged out. When any call returns `401`, the API client calls `/auth/refresh` once, retries, and sends the user to `/login` only if refresh fails. If two tabs refresh at the same moment, the second fails because the first consumed the token, so the client should share one in-flight refresh call.

Route guards and hidden buttons are **UX, not security**. A user can call the API directly, so the server enforces every rule.

### Limits of this model

- A stolen access token still works until it expires. That is the accepted cost.
- A replayed refresh token returns `401`, but the simple version does not detect the theft and log the user out everywhere.
- Logout deletes the refresh token. The current access token stays valid until it expires.

### The auto-logout in banking apps

That is an **idle timeout**, a rule rather than a separate technology. Banks keep server-side sessions with a short idle limit that resets on activity, so they can end the session instantly. A short access token that stops being refreshed behaves the same way. A simpler model is also fine: plain sessions suit one backend with no mobile app or outside API users, and can be revoked instantly.

## 4. Authorization: what the user may do

Authentication proved who the user is. Authorization decides what that user may do, and **no login method does it for you**. `401` means "I do not know who you are". `403` means "I know who you are, and you may not do this".

Use layers. Each one catches what the previous one misses.

### Roles

A role says what kind of user this is. Store it in a column with a constraint, such as `role TEXT CHECK (role IN ('user','admin'))`, and read it from the verified token or database, never from the request body.

```js
function requireRole(role) {
  return (req, res, next) =>
    req.user.role === role ? next() : res.status(403).json({ error: 'Forbidden' });
}
app.get('/admin/stats', requireAuth, requireRole('admin'), handler);
```

### Ownership: the check people forget

A role check says "users may read notes". It does not say "this user may read **this** note". With a route like `GET /notes/:id`, a user who is only checked for login can change the id in the URL and read someone else's note. This bug is called IDOR and it is one of the most common real security holes. The fix is to put the owner into the query itself:

```js
SELECT * FROM notes WHERE id = $1 AND owner_id = $2   // [req.params.id, req.user.userId]
```

Return `404`, not `403`, when the row exists but belongs to someone else. A `403` would confirm that the row exists.

### The stale role

A role inside a JWT is frozen when the token is issued. If an admin is demoted, the old token still says admin until it expires. Defenses: short access tokens, reading the role fresh from the database at every refresh, and checking the database directly for very sensitive actions.

### Row-Level Security: the database as the last line of defense

RLS makes Postgres itself filter rows by who is asking. Even if a route forgets the ownership check, the database refuses. The hard part is telling the database who the user is, and this pattern does it. It was run and verified.

```sql
-- The app connects as a limited role, NOT postgres or the table owner (both bypass RLS)
CREATE ROLE app_user LOGIN PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON notes TO app_user;
GRANT USAGE, SELECT ON SEQUENCE notes_id_seq TO app_user;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_owner ON notes
  USING      (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int)
  WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int);
```

```js
// Run work as a user. set_config(..., true) lasts for this transaction only,
// so the user id cannot leak to another request on a pooled connection.
async function withUser(user, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(user.userId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
```

| Piece | Why it is there |
| --- | --- |
| `USING` | Filters which rows you can see, update or delete |
| `WITH CHECK` | Blocks writing a row you do not own. A buggy insert with someone else's `owner_id` is rejected with error `42501` |
| `set_config(..., true)` instead of `SET` | Plain `SET` lasts for the connection, and pooled connections are reused by other users |
| `NULLIF(..., '')` | After the transaction the setting reverts to an empty string, and `''::int` would throw. `NULLIF` makes it `NULL`, which matches no rows |
| Limited `app_user` role | Superusers and table owners bypass RLS entirely |
| `GRANT USAGE, SELECT ON SEQUENCE` | A `SERIAL` column takes its next number from a sequence object, and table permission does not include it |
| Index on `owner_id` | The policy filters on it in every query |

Observed in the run: the owner saw their rows, another user saw an empty list, a cross-user read gave `404`, a buggy insert was blocked by the database, and the superuser bypassed the policy, which is why the app uses `app_user`.

### The layers together

| Layer | Question | Where | Stops |
| --- | --- | --- | --- |
| 1. Authenticated | Is there a valid credential? | `requireAuth` | Anonymous callers |
| 2. Role | Is this kind of user allowed on this route? | `requireRole` | Normal users on admin routes |
| 3. Ownership | Is this row theirs? | `WHERE ... AND owner_id` | User A reading user B's data |
| 4. RLS | Can the database allow it even if the code is wrong? | Policy | Bugs in layers 2 and 3 |

## 5. The complete picture

&#91;embedded content: complete auth flow · 4 stages\]

Read it top to bottom. Login happens once. After it, every request is verified by the API without a database read. When the access token expires, one refresh call replaces it. Permissions are checked on every action, in the API and again in the database.

## 6. Building it by hand

This backend was run end to end against a real Postgres database, and the results are below. It uses the access plus refresh model, but the structure is the same whichever credential you choose: **identity, then remembering, then authorization.**

### Order of building

1. `users` table, then `POST /auth/signup` with bcrypt and lowercased emails.
2. `POST /auth/login` that issues the credentials.
3. `requireAuth` middleware and `GET /auth/me`.
4. `refresh_tokens` table, `POST /auth/refresh` with rotation, `POST /auth/logout`.
5. Frontend: `user` and `status` state, a login page, `/auth/me` on load, an API client that refreshes once on `401` and retries.
6. Authorization: role column, `requireRole`, ownership in every query.
7. Row-Level Security with `withUser` and the limited `app_user` role (section 4).
8. Google login last, once everything above is solid.

### Database

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (            -- any table owned by a user looks like this
  id       SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  content  TEXT NOT NULL
);
CREATE INDEX notes_owner_id_idx ON notes(owner_id);
```

Setup: `npm i express pg bcrypt jsonwebtoken cookie-parser dotenv`. In `.env` put `DATABASE_URL` and `JWT_SECRET` (32 or more random bytes, never committed).

### Server

```js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_DAYS = 7;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- tokens ----------
function makeAccessToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}
async function issueTokens(res, user) {
  const refreshToken = crypto.randomBytes(32).toString('hex');   // random, meaningless alone
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [user.id, sha256(refreshToken), String(REFRESH_DAYS)]        // store only the hash
  );
  res.cookie('access_token', makeAccessToken(user), { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true, sameSite: 'lax', secure: false,              // secure: true in production
    path: '/auth/refresh',                                       // sent only to the refresh route
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  });
}

// ---------- 1. identity ----------
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8)
    return res.status(400).json({ error: 'Email and a password of 8+ characters are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email',
      [email.toLowerCase(), hash]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err); res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT id, email, role, password_hash FROM users WHERE email = $1',
    [(email || '').toLowerCase()]);
  const user = r.rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' });   // same message either way
  await issueTokens(res, user);
  res.json({ id: user.id, email: user.email, role: user.role });
});

// ---------- 2. remembering ----------
function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies.access_token || '', process.env.JWT_SECRET);  // { userId, role, iat, exp }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', reason: err.name });
  }
}

app.post('/auth/refresh', async (req, res) => {
  const token = req.cookies.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  const found = await pool.query(          // DELETE ... RETURNING = check and single use, in one step
    'DELETE FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now() RETURNING user_id', [sha256(token)]);
  if (!found.rows[0]) return res.status(401).json({ error: 'Invalid or used refresh token' });
  const u = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [found.rows[0].user_id]); // fresh role
  await issueTokens(res, u.rows[0]);
  res.json({ ok: true });
});

app.post('/auth/logout', async (req, res) => {
  if (req.cookies.refresh_token)
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [sha256(req.cookies.refresh_token)]);
  res.clearCookie('access_token'); res.clearCookie('refresh_token', { path: '/auth/refresh' });
  res.json({ ok: true });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [req.user.userId]);
  res.json(r.rows[0]);
});

// ---------- 3. authorization ----------
function requireRole(role) {
  return (req, res, next) => req.user.role === role ? next() : res.status(403).json({ error: 'Forbidden' });
}
app.get('/admin/stats', requireAuth, requireRole('admin'), async (req, res) => {
  const r = await pool.query('SELECT count(*)::int AS users FROM users');
  res.json(r.rows[0]);
});

app.post('/notes', requireAuth, async (req, res) => {
  const r = await pool.query('INSERT INTO notes (owner_id, content) VALUES ($1,$2) RETURNING *',
    [req.user.userId, req.body.content]);        // owner comes from the token, never the body
  res.status(201).json(r.rows[0]);
});
app.get('/notes', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM notes WHERE owner_id = $1 ORDER BY id', [req.user.userId]);
  res.json(r.rows);
});
app.get('/notes/:id', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM notes WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.userId]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });   // 404, not 403
  res.json(r.rows[0]);
});
app.delete('/notes/:id', requireAuth, async (req, res) => {
  const r = await pool.query('DELETE FROM notes WHERE id = $1 AND owner_id = $2 RETURNING id',
    [req.params.id, req.user.userId]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: r.rows[0].id });
});

app.listen(process.env.PORT || 3000, () => console.log('listening'));
```

To add RLS on top, connect as `app_user`, enable the policy from section 4, and run the `notes` queries through `withUser`.

### Frontend (written, not run)

```js
// One shared refresh call prevents the two-tab race.
let refreshing = null;
async function api(path, options = {}) {
  const call = () => fetch(`/api${path}`, { ...options, credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers } });
  let res = await call();
  if (res.status === 401 && path !== '/auth/refresh') {
    refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .finally(() => { refreshing = null; });
    const r = await refreshing;
    if (r.ok) res = await call();
  }
  return res;
}
```

The auth state holder is only `user` and `status`. On load it calls `api('/auth/me')`, and a `401` sets `unauthenticated`.

### What happened when it was run

The access token lifetime was set to 2 seconds so expiry could be seen quickly.

| Step | Result |
| --- | --- |
| Signup `A@x.com` | `201`, stored lowercased |
| Signup the same email again | `409 Email already registered` |
| Login with a wrong password | `401 Invalid email or password` |
| Login correctly | `200`, cookies set |
| `GET /auth/me` | `200` with the user |
| Create a note | `201`, `owner_id` taken from the token |
| `GET /admin/stats` as a normal user | `403 Forbidden` |
| `GET /auth/me` after 3 seconds | `401`, reason `TokenExpiredError` |
| `POST /auth/refresh` | `200`, and `/auth/me` works again |
| Second user reads the first user's note by id | `404 Not found` |
| Second user lists notes | `[]` |
| Logout, then refresh | `401 No refresh token` |
| `GET /auth/me` with no cookie | `401`, reason `JsonWebTokenError` |

Earlier runs of the same pattern also confirmed that a replayed refresh token returns `401`, and that a role change reaches the token only at the next refresh.

## 7. Other things worth knowing

### Security checklist

| Item | Why it matters |
| --- | --- |
| bcrypt for passwords (cost 10 or more) | A leaked database must not reveal passwords |
| Same error for wrong password and unknown email | Stops attackers listing registered emails |
| Cookies: HttpOnly, Secure in production, SameSite=Lax | JavaScript cannot read the token, it travels only over HTTPS, most forgery is blocked |
| Short access token, about 15 minutes | A stolen token stops working quickly |
| Store only the hash of the refresh token | A leaked table is not a set of usable logins |
| Rate-limit login and signup | Slows password guessing |
| JWT secret in an environment variable, 32 or more random bytes | Anyone with the secret can forge any user |
| Ownership in the query, not only the role | Stops reaching another user's rows by changing an id |
| Never trust role or user id from the browser | Take them from the verified token only |
| HTTPS everywhere in production | Cookies and passwords are readable over plain HTTP |

### The cookie gotcha when the frontend and API are on different origins (not run)

With Next.js on `localhost:3000` and Express on `localhost:4000`, login works and then the next request has no cookie. Nothing is wrong with your auth code: the browser refuses cross-origin cookies unless both sides opt in.

- Express: `cors({ origin: 'http://localhost:3000', credentials: true })`. The origin must be exact, never `*`.
- Browser: `fetch(url, { credentials: 'include' })` on every call.
- On two different domains in production the cookie also needs `SameSite=None; Secure`. On subdomains of one parent domain, `Lax` works.
- Simplest fix: let Next.js proxy `/api/*` to Express with a rewrite, so the browser talks to one origin.

### Threats and the defense for each

| Threat | What it is | Defense |
| --- | --- | --- |
| Database leak | Attacker gets your tables | bcrypt for passwords, hash refresh tokens |
| Password guessing | Automated logins | Rate limiting, slow hashing, MFA |
| XSS | Injected script runs on your page | HttpOnly cookies, escape output, no tokens in `localStorage` |
| CSRF | Another site makes your browser send an authenticated request | `SameSite=Lax`, CSRF tokens on sensitive routes |
| Token theft | A credential is copied | Short access tokens, HTTPS, refresh rotation |
| Token forgery | Someone invents a token | A strong secret kept only on the server |
| IDOR | Changing an id to reach another user's data | Ownership in the query, RLS |
| Privilege escalation | Acting as admin | Role from the verified token or database only |

## 8. Libraries and managed services

Everything in sections 1 to 4 is what an auth library automates. A **library** runs inside your own app and uses your own database. It creates the tables, hashes passwords, runs the Google flow, sets the cookies, handles refresh or session expiry, and gives you a helper such as "get the current user". A **managed service** runs all of that as a hosted product, stores your users on its servers, and usually adds ready-made login screens, MFA and a dashboard.

| Kind | Examples | Where your users live |
| --- | --- | --- |
| Building blocks | jose (sign and verify JWTs), Iron Session (encrypted cookie sessions) | Your database, and you write the rest |
| Libraries in your app | Better Auth, Auth.js (NextAuth), Stack Auth, Logto, Ory | Your database |
| Managed services | Clerk, Auth0, Supabase Auth, WorkOS, Descope, Kinde, Stytch | The vendor's servers (Supabase: your Supabase project) |

| Job | By hand | Library | Managed service |
| --- | --- | --- | --- |
| Passwords, signup, login | You write it | Config | Vendor |
| Google and GitHub login | You write the flow | Turn on a provider | Dashboard toggle |
| Cookies, refresh, rotation | You write it | Built in | Vendor |
| Login pages, email verification, password reset | You build them | Sometimes provided | Prebuilt screens |
| **Authorization: roles, ownership, RLS** | **You** | **You** | **You** |

**Which to pick.** Build by hand once to learn the system. For a self-hosted TypeScript product, Better Auth is the usual choice. To ship fast without building login screens, Clerk. If you already use Supabase, Supabase Auth. For selling to companies that need single sign-on, WorkOS or Auth0. Plain sessions are enough for one backend with no mobile app or outside API users.

**Trade-off of managed services.** Fastest start and the least security code to own, but a cost that usually grows per user, and moving away is hard because the user records live with the vendor.

Not run here. Auth.js is reported to be in maintenance mode, with its team joining Better Auth, per [LogRocket](https://blog.logrocket.com/best-auth-library-nextjs-2026/) and the [Better Auth announcement](https://www.better-auth.com/blog/authjs-joins-better-auth). Check current status before choosing it for a new project.

## 9. Quick recall

| Term | One line |
| --- | --- |
| Authentication | Proving who you are |
| Authorization | Deciding what you may do |
| Session | A server-side record that you are logged in |
| JWT | Signed `header.payload.signature` token, readable but not encrypted |
| Access token | Short-lived, sent on every request |
| Refresh token | Long-lived, stored hashed, used only to get new tokens |
| Rotation | Each refresh token works once, then is replaced |
| bcrypt | Slow, salted password hash |
| HttpOnly | Cookie flag: JavaScript cannot read it |
| SameSite | Cookie flag: limits cross-site sending |
| RBAC | Permissions by role |
| IDOR | Reaching another user's data by changing an id |
| RLS | Row filtering enforced by the database |

**Questions to ask when something is confusing**

- Is this about who the user is, how the server keeps knowing, or what the user may do?
- Is the browser being trusted for something only the server should decide?
- If this credential is stolen, how long does it work and how do I end it?
- Is ownership checked on this exact row, or only that the user is logged in?
- If a route had a bug, what stops the data leaking? That is what RLS is for.

**What was not run:** the Google flow, the frontend code, the cross-origin cookie setup, and every library and managed service. Verify those against current documentation. Further reading, not read in full for these notes: the OWASP Authentication and Session Management cheat sheets.
