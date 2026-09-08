# PostgreSQL Configuration and Environment Variables

## Topic 1: PostgreSQL Connection Configuration

PostgreSQL connection configuration is the set of parameters a client
needs to locate a PostgreSQL server, authenticate with it, and select
the database it wants to access.

The most common connection values are:

  Setting      Purpose
  ------------ -------------------------------------------
  `host`       Where PostgreSQL is running
  `port`       Which PostgreSQL network endpoint to use
  `user`       PostgreSQL login role identity
  `password`   Credential used to authenticate that role
  `database`   Which database to connect to

Example with node-postgres:

``` ts
const client = new Client({
  host: "localhost",
  port: 5432,
  user: "backend_user",
  password: "strong_password",
  database: "bookeasy",
});
```

The same information can be represented as a PostgreSQL connection
string:

``` text
postgresql://backend_user:strong_password@localhost:5432/bookeasy
```

Connection string structure:

``` text
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

The application can use the same code locally and in production while
changing only the connection configuration.

## Topic 2: Environment Variables

Environment variables are external key-value configuration values
provided to a running process, allowing application configuration and
secrets to be separated from source code and changed between
environments without modifying application code.

Example:

``` env
DATABASE_URL=postgresql://backend_user:strong_password@localhost:5432/bookeasy
PORT=3000
NODE_ENV=development
```

Node.js can access them through `process.env`:

``` ts
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});
```

This is better than hardcoding database credentials directly in source
files.

## Topic 3: `.env` Files

A `.env` file is a convenient development file used to define
environment-variable values. The `.env` file itself is not the
environment-variable system; it is simply a common way to load values
into a process during development.

Example:

``` env
DATABASE_URL=postgresql://backend_user:strong_password@localhost:5432/bookeasy
```

With `dotenv`:

``` bash
npm install dotenv
```

Then:

``` ts
import "dotenv/config";
```

The application can read:

``` ts
process.env.DATABASE_URL
```

Sensitive `.env` files should not normally be committed to Git.

``` gitignore
node_modules
.env
```

A safe template can be committed instead:

``` env
DATABASE_URL=
PORT=
NODE_ENV=
```

## Topic 4: Development vs Production Configuration

Development and production environments usually use different database
connection values while the application code stays the same.

``` text
Development
DATABASE_URL → local PostgreSQL

Production
DATABASE_URL → cloud PostgreSQL
```

Example:

``` text
Local:
postgresql://backend_user:password@localhost:5432/bookeasy

Cloud:
postgresql://backend_user:password@remote-host:5432/bookeasy
```

The exact hostname, credentials, port, SSL requirements, and pooler
settings can differ by cloud provider, but the connection concept
remains the same.
