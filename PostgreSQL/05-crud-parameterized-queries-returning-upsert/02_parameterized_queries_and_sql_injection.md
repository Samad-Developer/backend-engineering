# Parameterized Queries and SQL Injection

## Topic 1: Parameterized Queries

A parameterized query is a SQL query in which data values are supplied
separately from the SQL statement and referenced through parameter
placeholders instead of being concatenated directly into SQL source
text.

PostgreSQL uses positional parameters:

``` text
$1
$2
$3
```

With Node.js `pg`:

``` js
const result = await pool.query(
  `SELECT * FROM app_users WHERE email = $1`,
  [userEmail]
);
```

Multiple parameters:

``` js
await pool.query(
  `UPDATE app_users SET name = $1, email = $2 WHERE id = $3`,
  [name, email, id]
);
```

The mapping is positional:

``` text
$1 -> name
$2 -> email
$3 -> id
```

### How Parameterization Works

Parameterization is not ordinary JavaScript string replacement.

Unsafe construction:

``` js
const sql = `SELECT * FROM app_users WHERE email = '${userEmail}'`;
```

Parameterized form:

``` text
SQL:
SELECT * FROM app_users WHERE email = $1

Values:
[userEmail]
```

The `pg` driver sends the SQL statement and parameter values using
PostgreSQL's query protocol. PostgreSQL binds the supplied parameter as
a data value rather than treating its contents as new SQL syntax.

``` text
Node.js
  |
  +-- SQL with $1, $2...
  |
  +-- parameter values
           |
           v
        pg driver
           |
           v
      PostgreSQL
    parse / bind / execute
```

The value participates in evaluating the query, but it is not
concatenated into the SQL source text.

Parameterized queries are fundamentally supported by PostgreSQL; the
Node.js `pg` package provides the application API used to access that
capability.

Parameters are intended for data values. They should not be assumed to
replace arbitrary SQL structure such as table names, column names, or
SQL keywords.

## Topic 2: SQL Injection

SQL injection is a security vulnerability in which untrusted input is
interpreted as SQL syntax and changes the intended structure or meaning
of a query.

Unsafe example:

``` js
const email = req.body.email;
const sql = `SELECT * FROM app_users WHERE email = '${email}'`;
const result = await pool.query(sql);
```

Normal input creates the intended query:

``` sql
SELECT *
FROM app_users
WHERE email = 'samad@gmail.com';
```

But specially crafted input such as:

``` text
' OR '1'='1
```

can make direct concatenation produce:

``` sql
SELECT *
FROM app_users
WHERE email = '' OR '1'='1';
```

Because `'1'='1'` is true, the attacker has changed the intended
condition.

The parameterized version is:

``` js
const result = await pool.query(
  `SELECT * FROM app_users WHERE email = $1`,
  [email]
);
```

Now text resembling SQL syntax is treated as the value of `$1`, not as a
new SQL operator or clause.

``` text
Unsafe:
SQL + untrusted input -> one SQL source string

Parameterized:
SQL structure ------+
                    +--> PostgreSQL
parameter values ---+
                    |
                    -> values remain data
```

Parameterization and validation solve different problems:

``` text
Validation:
Is this acceptable application data?

Parameterization:
Prevent this value from becoming SQL syntax.
```

External values such as `req.body`, `req.params`, and `req.query` should
not be directly concatenated into raw SQL.
