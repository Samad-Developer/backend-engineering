# PostgreSQL Clients and Connections

## Topic 1: PostgreSQL Client

A PostgreSQL client is a program or library that connects to a
PostgreSQL server, sends SQL or protocol commands, and receives results
from the server.

PostgreSQL is a client-server system. The server stores and manages the
data, while clients are the tools or applications that communicate with
it.

Common PostgreSQL clients include:

  Client                 Purpose
  ---------------------- --------------------------------------------
  `psql`                 Command-line PostgreSQL client
  `pg` / node-postgres   Node.js PostgreSQL driver
  pgAdmin                Graphical PostgreSQL administration client
  DBeaver                General-purpose database GUI
  DataGrip               Database IDE
  psycopg                Python PostgreSQL driver
  JDBC                   Java database driver interface
  Npgsql                 .NET PostgreSQL driver

Postman is normally not a PostgreSQL client because Postman is designed
for HTTP APIs, while PostgreSQL uses its own database wire protocol.

``` text
Postman → HTTP → Express API
Express → PostgreSQL protocol → PostgreSQL
```

## Topic 2: `psql`

`psql` is PostgreSQL's command-line client application used to connect
to a PostgreSQL server, execute SQL statements, run PostgreSQL-specific
commands, and inspect or administer databases interactively.

`psql` is not the PostgreSQL server. It is a client that talks to the
server.

``` text
psql
  ↓
PostgreSQL Server
```

A typical connection command is:

``` bash
psql -h localhost -p 5432 -U postgres -d bookeasy
```

The options mean:

  Option   Meaning
  -------- ----------------------------
  `-h`     PostgreSQL host
  `-p`     PostgreSQL port
  `-U`     PostgreSQL login role/user
  `-d`     Database to connect to

To connect as another PostgreSQL login role:

``` bash
psql -h localhost -p 5432 -U backend_user -d bookeasy
```

To verify the current PostgreSQL identity:

``` sql
SELECT current_user;
```

To exit `psql`:

``` text
\q
```

To list tables:

``` text
\dt
```

To list tables specifically in the `public` schema:

``` text
\dt public.*
```

## Topic 3: `pg` Driver for Node.js

`pg`, commonly called node-postgres, is a PostgreSQL client library and
driver for Node.js that allows Node.js applications to establish
connections to PostgreSQL servers, execute SQL statements, manage
transactions, and receive query results programmatically.

The architecture is:

``` text
Express → pg → PostgreSQL
```

Example:

``` ts
import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "your_password",
  database: "bookeasy",
});

await client.connect();

const result = await client.query("SELECT current_user");
console.log(result.rows);
```

A PostgreSQL driver exists because Node.js does not automatically know
how to speak PostgreSQL's wire protocol. The driver handles the database
protocol and exposes convenient JavaScript APIs.

## Topic 4: PostgreSQL Connection Process

A PostgreSQL connection is a network session established between a
PostgreSQL client and a PostgreSQL server using connection configuration
and database authentication.

A connection generally needs:

``` text
host
port
user/role
password
database
```

The flow is:

``` text
Client
  ↓
Find PostgreSQL server using host + port
  ↓
Authenticate using PostgreSQL role + password
  ↓
Select database
  ↓
Connection established
  ↓
Send SQL
```

A PostgreSQL login role is not the same as an application user who signs
into a website. The backend itself usually connects to PostgreSQL using
a database login role.

``` text
Application user
   ↓ app authentication
Frontend / Backend
   ↓ database authentication
PostgreSQL login role
   ↓
PostgreSQL
```
