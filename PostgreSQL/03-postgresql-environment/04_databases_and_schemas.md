# PostgreSQL Databases and Schemas

## Topic 1: PostgreSQL Database

A PostgreSQL database is a named logical database managed by a
PostgreSQL server and containing schemas, tables, views, functions, and
other database objects that belong to that database.

One PostgreSQL server can manage multiple databases.

``` text
PostgreSQL Server
├── bookeasy
├── hospital_db
└── learning_db
```

When a client connects, it normally selects one specific database.

``` bash
psql -h localhost -p 5432 -U postgres -d bookeasy
```

A useful hierarchy is:

``` text
PostgreSQL Server
  ↓
Database
  ↓
Schema
  ↓
Table
  ↓
Rows
```

## Topic 2: PostgreSQL Schema

A PostgreSQL schema is a named namespace inside a database used to
organize and logically separate database objects, avoid naming
conflicts, and help control access.

For everyday table design, it is useful to think of a schema as a
logical container inside a database.

``` text
bookeasy database
├── public
│   ├── users
│   └── products
├── auth
│   ├── sessions
│   └── roles
└── sales
    ├── orders
    └── order_items
```

PostgreSQL schemas can contain more than tables, including views,
functions, sequences, and custom types. For application development,
tables are usually the first objects encountered.

## Topic 3: Main Jobs of a Schema

### Organization

Schemas group related tables and other database objects together so a
large database is easier to navigate and maintain.

``` text
auth.users
auth.sessions
sales.orders
sales.order_items
```

### Name separation

Schemas act as namespaces, which means two tables can have the same
table name as long as they are in different schemas.

``` text
sales.users
admin.users
```

The full names are different, so PostgreSQL can distinguish them.

### Access control

Permissions can be applied at the schema level so PostgreSQL roles can
be allowed or denied access to particular parts of a database.

For example, one role may be allowed to use `sales` while another may
only use `reports`.

### Logical separation

Schemas separate different modules or domains while keeping them inside
the same PostgreSQL database. Because they remain in the same database,
tables in different schemas can still participate in joins and
foreign-key relationships.

## Topic 4: Creating and Using Schemas

A schema can be created directly:

``` sql
CREATE SCHEMA sales;
```

A table can then be created inside it:

``` sql
CREATE TABLE sales.orders (
    id INTEGER PRIMARY KEY,
    total_amount NUMERIC NOT NULL
);
```

Query it using the schema-qualified table name:

``` sql
SELECT *
FROM sales.orders;
```

At the basic level, no additional configuration is required just to
create a schema and use `schema_name.table_name`.

## Topic 5: The `public` Schema

PostgreSQL commonly creates a schema named `public` in a new database.

When this is used:

``` sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY
);
```

PostgreSQL will commonly create or resolve the table as:

``` text
public.users
```

Therefore these often refer to the same table:

``` sql
SELECT * FROM users;
```

``` sql
SELECT * FROM public.users;
```

Using the schema-qualified form is more explicit and avoids ambiguity.

Whether PostgreSQL can resolve an unqualified name such as `users`
depends on the current `search_path`.

## Topic 6: Relationships Across Schemas

Tables in different schemas of the same PostgreSQL database can join and
reference each other normally.

Example:

``` sql
CREATE SCHEMA patients;
CREATE SCHEMA appointments;

CREATE TABLE patients.patients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE appointments.appointments (
    id INTEGER PRIMARY KEY,
    patient_id INTEGER NOT NULL
        REFERENCES patients.patients(id)
);
```

Cross-schema join:

``` sql
SELECT p.name, a.id
FROM patients.patients AS p
JOIN appointments.appointments AS a
    ON p.id = a.patient_id;
```

Schemas are therefore organizational and security boundaries inside one
database, not separate databases.
