# PostgreSQL Roles, Permissions, and Security Basics

## Topic 1: PostgreSQL Roles and Users

A PostgreSQL role is a database-level identity that can own database
objects and receive privileges. A role with the `LOGIN` attribute can
authenticate and connect to PostgreSQL and is commonly called a
PostgreSQL user.

PostgreSQL fundamentally uses roles. The word "user" normally means a
role that can log in.

``` text
ROLE
├── without LOGIN → cannot directly connect
└── with LOGIN    → can connect; commonly called a user
```

This is completely separate from application signup/login.

``` text
Application user
Ali / Sara / John
→ people using the application
→ application authentication

PostgreSQL login role
backend_user / postgres
→ database identity used to connect to PostgreSQL
→ PostgreSQL authentication
```

The backend itself normally uses a PostgreSQL login role to connect to
the database.

``` text
Person
  ↓ application login
Frontend
  ↓ HTTPS
Backend
  ↓ PostgreSQL role + password
PostgreSQL
```

At the database connection level, PostgreSQL sees the PostgreSQL role
executing SQL. The backend is responsible for determining which
application user is making the HTTP request.

## Topic 2: `CREATE ROLE` vs `CREATE USER`

`CREATE ROLE` creates a PostgreSQL role. By default, the role does not
have login capability unless `LOGIN` is explicitly added.

``` sql
CREATE ROLE app_role;
```

A login role can be created with:

``` sql
CREATE ROLE backend_user
WITH LOGIN
PASSWORD 'strong_password';
```

`CREATE USER` is convenient PostgreSQL syntax that creates a role with
`LOGIN` capability.

``` sql
CREATE USER backend_user
WITH PASSWORD 'strong_password';
```

Conceptually:

``` text
CREATE USER = CREATE ROLE + LOGIN
```

A role can therefore exist, own privileges, and still be unable to
connect directly if it does not have `LOGIN`.

## Topic 3: What `LOGIN` Means

`LOGIN` means the PostgreSQL role is allowed to authenticate and
establish connections to the PostgreSQL server.

It does not mean website login and there is no normal signup flow like
application authentication.

A login role is usually created once:

``` sql
CREATE USER backend_user
WITH PASSWORD 'strong_password';
```

The backend can then repeatedly connect using those credentials.

The password can later be changed:

``` sql
ALTER ROLE backend_user
WITH PASSWORD 'new_password';
```

The role can also be renamed:

``` sql
ALTER ROLE backend_user
RENAME TO api_user;
```

## Topic 4: Role Scope

PostgreSQL roles belong to the PostgreSQL server cluster, not to a
single database.

``` text
PostgreSQL Server / Cluster
│
├── Roles
│   ├── postgres
│   ├── backend_user
│   └── reporting_role
│
├── database_a
├── database_b
└── database_c
```

A role can therefore exist independently of any one database. Actual
access to databases, schemas, and tables is controlled by privileges.

## Topic 5: Inspecting Roles

Existing PostgreSQL roles can be inspected through `pg_roles`.

``` sql
SELECT rolname, rolcanlogin, rolsuper
FROM pg_roles;
```

For one role:

``` sql
SELECT rolname, rolcanlogin, rolsuper
FROM pg_roles
WHERE rolname = 'backend_user';
```

Important columns:

  Column          Meaning
  --------------- --------------------------------------------
  `rolname`       Role name
  `rolcanlogin`   Whether the role can connect directly
  `rolsuper`      Whether the role is a PostgreSQL superuser

## Topic 6: The `postgres` Role

A typical local PostgreSQL installation creates an initial role named
`postgres` with the `SUPERUSER` attribute.

The role name itself does not create the power. The `SUPERUSER`
attribute does.

``` sql
SELECT rolname, rolsuper
FROM pg_roles
WHERE rolname = 'postgres';
```

A PostgreSQL superuser bypasses most ordinary permission checks and can
perform powerful administrative operations.

In local development, the `postgres` role is commonly used for
administrative tasks such as creating roles and granting privileges.

A normal application should not usually connect using a superuser
account.

## Topic 7: PostgreSQL Privileges

A PostgreSQL privilege is an authorization granted to a role that
determines which operations that role is permitted to perform on a
specific database object or resource.

The core distinction is:

``` text
Role       → WHO are you?
LOGIN      → Can you connect?
Privileges → WHAT can you do?
```

Common table privileges include:

  Privilege      Meaning
  -------------- -------------------------------------------
  `SELECT`       Read rows
  `INSERT`       Add rows
  `UPDATE`       Modify rows
  `DELETE`       Delete rows
  `TRUNCATE`     Remove all rows quickly
  `REFERENCES`   Create foreign keys referencing the table
  `TRIGGER`      Create triggers on the table

For ordinary application CRUD, the most common privileges are `SELECT`,
`INSERT`, `UPDATE`, and `DELETE`.

## Topic 8: `GRANT`

`GRANT` gives a privilege to a PostgreSQL role.

Example:

``` sql
GRANT SELECT
ON TABLE public.users
TO backend_user;
```

Multiple privileges can be granted together:

``` sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.orders
TO backend_user;
```

If the table can be resolved through the current `search_path`, the
schema name may sometimes be omitted:

``` sql
GRANT SELECT
ON TABLE users
TO backend_user;
```

Using `public.users` is more explicit and avoids ambiguity.

Permissions can also be granted on all existing tables in a schema:

``` sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO backend_user;
```

This applies to tables that already exist. Future-table permissions can
be handled separately with default privileges.

## Topic 9: `REVOKE`

`REVOKE` removes a previously granted privilege from a PostgreSQL role.

Example:

``` sql
REVOKE DELETE
ON TABLE public.users
FROM backend_user;
```

After this, the role may still have `SELECT`, `INSERT`, and `UPDATE`,
while PostgreSQL rejects `DELETE` operations.

## Topic 10: Who Can Grant, Revoke, or Manage Roles

A normal role cannot simply grant itself permissions it does not already
control. Otherwise database security would have no meaning.

Administrative SQL must be executed by a role with sufficient authority.

For example, when connected as a restricted role:

``` sql
SELECT current_user;
```

may return:

``` text
backend_user
```

If that role does not own the table and does not have grant authority,
this will fail:

``` sql
GRANT SELECT
ON TABLE public.users
TO backend_user;
```

The command should instead be run as the table owner or another
sufficiently privileged administrative role, such as the local
`postgres` superuser in a development installation.

Likewise, role-management commands such as:

``` sql
CREATE ROLE ...;
DROP ROLE ...;
```

require appropriate PostgreSQL role-management privileges. Superuser can
perform them, but superuser is not technically required for every
administrative operation if another role has the necessary authority.

## Topic 11: Common Permission Errors

If a login role connects successfully but receives:

``` text
ERROR: permission denied for table users
```

that means authentication succeeded, but authorization failed. The role
exists and can connect, but it does not have the required table
privilege.

For example:

``` text
backend_user
→ LOGIN ✅
→ SELECT on users ❌
```

The fix is not to reconnect differently as the same restricted role. An
authorized role must grant the missing privilege.

Example as an administrator:

``` sql
GRANT SELECT
ON TABLE public.users
TO backend_user;
```

Then connect again as `backend_user` and test:

``` sql
SELECT *
FROM public.users;
```

Another common mistake is:

``` sql
SELECT * FROM user;
```

In PostgreSQL, `USER` is a special SQL value related to the current
database role. For clarity, use:

``` sql
SELECT current_user;
```

To query an actual table named `users`, use:

``` sql
SELECT * FROM public.users;
```

## Topic 12: Schema Privileges

Table privileges and schema privileges are separate concepts.

A role may need permission to use a schema before it can access objects
inside it.

Example:

``` sql
GRANT USAGE
ON SCHEMA public
TO backend_user;
```

Then table privileges can be granted separately:

``` sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.users
TO backend_user;
```

For identity-generated columns or sequences, sequence privileges may
also be necessary in some designs:

``` sql
GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO backend_user;
```

## Topic 13: Practical Backend Role Setup

A production-style application should use a dedicated PostgreSQL login
role instead of connecting as a superuser.

Example administrative setup:

``` sql
CREATE ROLE backend_user
WITH LOGIN
PASSWORD 'strong_password_here';

GRANT USAGE
ON SCHEMA public
TO backend_user;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.users
TO backend_user;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.orders
TO backend_user;

GRANT SELECT
ON TABLE public.products
TO backend_user;
```

The backend connection string would conceptually be:

``` text
postgresql://backend_user:strong_password_here@localhost:5432/bookeasy
```

This means the application connects using `backend_user`, not the
powerful administrative `postgres` role.

## Topic 14: Principle of Least Privilege

The principle of least privilege is a security principle in which a
user, role, application, or process is granted only the minimum
permissions necessary to perform its required responsibilities, and no
additional permissions.

A backend that only needs normal CRUD operations should not connect as a
PostgreSQL superuser.

Bad design:

``` text
Express Backend
      ↓
postgres SUPERUSER
      ↓
Can perform nearly every database operation
```

Better design:

``` text
Express Backend
      ↓
backend_user
      ↓
Only required privileges
```

Permissions should be based on actual application requirements rather
than automatically granting everything.

For a read-only table:

``` sql
GRANT SELECT
ON TABLE public.countries
TO backend_user;
```

For an orders table that requires normal CRUD:

``` sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.orders
TO backend_user;
```

The security model to remember is:

``` text
Role
  ↓
WHO are you?

LOGIN
  ↓
Can you connect?

Privileges
  ↓
WHAT can you do?

GRANT
  ↓
Give privileges

REVOKE
  ↓
Remove privileges

Least privilege
  ↓
Give only what is actually required
```
