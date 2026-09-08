# PostgreSQL Server and Architecture

## Topic 1: PostgreSQL Server

The PostgreSQL server is the running PostgreSQL database management
system process that accepts client connections, authenticates them,
executes SQL statements, manages transactions and concurrency, enforces
database rules, reads and writes persistent data, and returns results to
clients.

PostgreSQL is not just a set of database files. The PostgreSQL software
must be running as a server process so applications and tools can send
SQL commands to it. That running server is the DBMS doing the actual
database work.

A backend application does not directly open PostgreSQL data files. It
sends SQL to PostgreSQL, and PostgreSQL handles parsing, execution,
constraints, transactions, locking, indexes, storage, and recovery.

``` text
Client/Application
       ↓
PostgreSQL Server
       ↓
Database files on disk
```

A useful mental model is:

``` text
PostgreSQL software installed
        ↓
PostgreSQL server process running
        ↓
Server manages one or more databases
```

### Real-world architecture

``` text
Browser
   ↓ HTTP/HTTPS
Express Backend
   ↓ PostgreSQL protocol
PostgreSQL Server
   ↓
Database storage
```

The Express server and PostgreSQL server are both server programs, but
they have different jobs. Express handles HTTP requests and application
logic. PostgreSQL handles SQL, data integrity, transactions, storage,
and database access.

## Topic 2: Local PostgreSQL vs Cloud PostgreSQL

Local PostgreSQL means the PostgreSQL server runs on your own
development machine. Cloud PostgreSQL means the PostgreSQL server runs
on infrastructure managed by a hosting provider or cloud platform.

The application code can remain nearly the same in both environments.
Usually the connection details change.

``` text
Local development
Node.js → localhost:5432 → PostgreSQL

Cloud deployment
Node.js → remote-database-host:5432 → PostgreSQL
```

With local PostgreSQL, you install and control the PostgreSQL server
yourself. With managed cloud PostgreSQL, services such as Supabase,
Neon, Railway, or AWS RDS install, run, patch, monitor, and operate the
PostgreSQL infrastructure for you.

Managed cloud PostgreSQL still behaves like PostgreSQL from the
application's point of view. The backend connects using a host, port,
database name, role/user, password, and sometimes SSL settings.

## Topic 3: PostgreSQL Deployment Model

A PostgreSQL deployment usually consists of the application server and
database server running as separate services, even though they can run
on the same machine in small or local setups.

``` text
Frontend
   ↓
Backend Server
   ↓ network connection
PostgreSQL Server
```

The backend communicates with PostgreSQL using PostgreSQL's
client/server wire protocol. The frontend normally does not connect
directly to PostgreSQL in a traditional backend architecture.

This separation allows the backend and database to be deployed, secured,
scaled, and maintained independently.

## Topic 4: Port 5432

A port is a numbered transport-layer endpoint used by the operating
system, together with an IP address and protocol, to route network
connections to the correct listening application or service on a
machine.

PostgreSQL uses TCP port `5432` by default.

``` text
Host/IP → which machine?
Port    → which service on that machine?
Protocol→ how the two programs communicate?
```

Example:

``` text
localhost:5432
```

means:

``` text
localhost → this computer
5432      → PostgreSQL's listening endpoint
```

Other common examples are:

  Service        Common Port
  ------------ -------------
  HTTP                    80
  HTTPS                  443
  SSH                     22
  PostgreSQL            5432
  MySQL                 3306
  Redis                 6379

A port is an operating-system/networking concept, not something unique
to PostgreSQL.

A TCP connection also has a source port and destination port. For
example:

``` text
Backend source port 51842 → PostgreSQL destination port 5432
```

The source port is usually temporary. PostgreSQL listens on the
destination port.
