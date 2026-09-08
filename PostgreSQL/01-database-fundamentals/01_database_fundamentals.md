# Database Fundamentals

## Topic 1: Database

A **database** is an organized collection of persistent data that is
logically structured and stored so that it can be efficiently created,
accessed, queried, updated, managed, and maintained while preserving the
consistency and integrity of the stored information.

Applications continuously create information such as users, products,
orders, payments, posts, and messages. This information must continue to
exist after a request finishes, an application restarts, or a user
closes the application.

A database provides persistent storage for this information.

For example, an online store may need to store:

``` text
users
products
orders
order_items
payments
```

Instead of keeping information only in application memory:

``` js
const users = [
  { id: 1, name: "Ali", email: "ali@example.com" }
];
```

the information can be stored persistently in a database.

A relational database may represent the same information as:

``` text
users

id | name  | email
---|-------|------------------
1  | Ali   | ali@example.com
2  | Sara  | sara@example.com
```

The database becomes the persistent source of application data.

### Example

After creating a PostgreSQL database and connecting to it, data can be
stored in a table:

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL
);

INSERT INTO users (name, email)
VALUES ('Ali', 'ali@example.com');

SELECT *
FROM users;
```

Expected result:

``` text
id | name | email
---|------|----------------
1  | Ali  | ali@example.com
```

The inserted row remains stored in the database until it is explicitly
changed or deleted.

------------------------------------------------------------------------

## Topic 2: Database Management System (DBMS)

A **Database Management System (DBMS)** is software that provides an
interface and mechanisms for defining, creating, storing, retrieving,
modifying, securing, and administering databases while managing concerns
such as data integrity, concurrent access, transactions, storage,
permissions, and recovery.

A database is the organized data. A DBMS is the software responsible for
managing that data.

Common database management systems include:

-   PostgreSQL
-   MySQL
-   Microsoft SQL Server
-   Oracle Database
-   SQLite
-   MongoDB

When an application requests data, it does not normally manipulate
database files directly. It communicates with the DBMS.

For example:

``` text
Application
     ↓
Database query
     ↓
PostgreSQL
     ↓
Stored database data
     ↓
PostgreSQL
     ↓
Result returned to application
```

The DBMS performs important work behind the scenes. It can:

-   create databases and tables;
-   read and modify stored data;
-   enforce database constraints;
-   manage transactions;
-   coordinate concurrent operations;
-   maintain indexes;
-   control database permissions;
-   write data to persistent storage;
-   recover from certain failures.

### Example

The following SQL is sent to PostgreSQL:

``` sql
SELECT id, name, email
FROM users
WHERE id = 1;
```

PostgreSQL receives the statement, determines how to execute it,
accesses the appropriate stored data, and returns the matching row.

The SQL statement describes **what data is required**. PostgreSQL, as
the DBMS, manages **how the database operation is executed**.

------------------------------------------------------------------------

## Topic 3: Database vs Database Management System

A **database** is the organized collection of persistent data, whereas a
**Database Management System (DBMS)** is the software system responsible
for creating, accessing, modifying, controlling, and maintaining that
database.

The distinction can be represented as:

``` text
DBMS
 │
 │ manages
 ▼
Database
 │
 ├── tables
 ├── records
 └── relationships
```

For example:

``` text
PostgreSQL
    │
    ├── ecommerce
    ├── analytics
    └── inventory
```

In this example:

``` text
PostgreSQL → DBMS
ecommerce  → database
analytics  → database
inventory  → database
```

A single PostgreSQL server can manage multiple databases.

In everyday software-development language, developers commonly say:

``` text
"We use PostgreSQL as our database."
```

This is accepted shorthand. More technically, PostgreSQL is the database
management system, while the application's database is managed by
PostgreSQL.

### Example

After connecting to PostgreSQL, databases can be listed in `psql` with:

``` text
\l
```

A database can be created with:

``` sql
CREATE DATABASE ecommerce;
```

The relationship is then:

``` text
PostgreSQL
    ↓ manages
ecommerce database
```

------------------------------------------------------------------------

## Topic 4: Relational Database

A **relational database** is a database based on the relational model in
which data is represented as relations, commonly presented as tables
consisting of rows and columns, and associations between data can be
represented through matching key values and enforced using relational
constraints.

A relational database separates different kinds of information into
appropriate tables instead of storing everything together.

Consider customers and orders.

``` text
customers

id | name
---|------
1  | Ali
2  | Sara
```

``` text
orders

id  | customer_id | total
----|-------------|------
101 | 1           | 5000
102 | 1           | 2500
103 | 2           | 4000
```

The value:

``` text
orders.customer_id
```

connects each order to a customer.

For example:

``` text
orders.customer_id = 1
```

refers to:

``` text
customers.id = 1
```

Therefore, customers and orders are related without repeatedly copying
all customer information into every order.

### Example

``` sql
CREATE TABLE customers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    total NUMERIC(10, 2) NOT NULL
);

INSERT INTO customers (name)
VALUES ('Ali');

INSERT INTO orders (customer_id, total)
VALUES (1, 5000.00);

SELECT
    customers.name,
    orders.total
FROM customers
INNER JOIN orders
    ON customers.id = orders.customer_id;
```

Expected result:

``` text
name | total
-----|--------
Ali  | 5000.00
```

------------------------------------------------------------------------

## Topic 5: Relational Database Management System (RDBMS)

A **Relational Database Management System (RDBMS)** is a DBMS that
implements the relational model and provides mechanisms for defining,
storing, querying, relating, constraining, and transactionally managing
data represented primarily through relations such as tables.

PostgreSQL is an RDBMS.

Other examples include:

-   MySQL
-   Microsoft SQL Server
-   Oracle Database

The hierarchy is:

``` text
DBMS
 │
 └── RDBMS
      │
      ├── PostgreSQL
      ├── MySQL
      ├── SQL Server
      └── Oracle Database
```

An RDBMS provides more than table storage. It manages:

-   relationships;
-   constraints;
-   transactions;
-   concurrent operations;
-   indexes;
-   permissions;
-   query execution;
-   data integrity.

The term **relational** refers to the relational model, not simply to
the fact that tables happen to be connected.

### Example

``` sql
CREATE TABLE departments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE employees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    department_id INTEGER REFERENCES departments(id)
);
```

PostgreSQL can enforce the relationship between
`employees.department_id` and `departments.id`.

------------------------------------------------------------------------

## Topic 6: PostgreSQL

**PostgreSQL** is an open-source object-relational database management
system that implements relational database concepts, supports SQL, and
provides capabilities including transactions, constraints, indexing,
concurrency control, extensible data types, security, recovery
mechanisms, and advanced query processing.

PostgreSQL is the software responsible for managing databases.

A PostgreSQL server can manage multiple databases:

``` text
PostgreSQL Server
│
├── ecommerce
├── accounting
└── analytics
```

Inside a database are database objects such as:

``` text
tables
views
indexes
sequences
functions
schemas
```

PostgreSQL accepts commands from applications and database clients,
performs the requested operations, and manages how the underlying data
is stored and accessed.

### Example

Connect to PostgreSQL using `psql`:

``` bash
psql -U postgres
```

Create a database:

``` sql
CREATE DATABASE company;
```

Connect to it from `psql`:

``` text
\c company
```

Create a table:

``` sql
CREATE TABLE employees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);
```

Insert data:

``` sql
INSERT INTO employees (name)
VALUES ('Ali'), ('Sara');
```

Read the data:

``` sql
SELECT *
FROM employees;
```

------------------------------------------------------------------------

## Topic 7: SQL

**SQL (Structured Query Language)** is a declarative language
standardized for defining database structures, querying and manipulating
relational data, controlling access, and managing transactional
operations in relational database systems.

SQL is a language. It is not a database and it is not a DBMS.

The relationship is:

``` text
SQL
 ↓
PostgreSQL
 ↓
Database
 ↓
Tables and data
```

SQL is described as **declarative** because a query generally specifies
the desired result rather than manually specifying every low-level step
required to obtain it.

For example:

``` sql
SELECT name
FROM users
WHERE id = 1;
```

The query describes the required result:

``` text
Find the name of the user whose id is 1.
```

PostgreSQL determines an execution strategy for retrieving it.

SQL includes several categories of operations, including:

``` text
CREATE TABLE
INSERT
SELECT
UPDATE
DELETE
ALTER TABLE
GRANT
COMMIT
ROLLBACK
```

### Example

``` sql
CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (name, price)
VALUES
    ('Keyboard', 5000.00),
    ('Mouse', 2500.00);

SELECT name, price
FROM products
WHERE price > 3000;

UPDATE products
SET price = 4500.00
WHERE name = 'Keyboard';

DELETE FROM products
WHERE name = 'Mouse';
```

------------------------------------------------------------------------

## Topic 8: Table

A **table** is a named relation in a relational database whose structure
defines a set of columns and whose data consists of rows conforming to
that structure and its associated constraints.

A table normally stores data about one type of concept.

For example:

``` text
users
products
orders
payments
```

A `products` table could contain:

``` text
id | name     | price
---|----------|-------
1  | Keyboard | 5000
2  | Mouse    | 2500
```

The table defines the structure that each stored product record follows.

Unlike a simple in-memory array, a database table can have:

-   data types;
-   primary keys;
-   foreign keys;
-   unique constraints;
-   validation constraints;
-   indexes;
-   permissions.

### Example

``` sql
CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (name, price)
VALUES ('Keyboard', 5000.00);

SELECT *
FROM products;
```

------------------------------------------------------------------------

## Topic 9: Row

A **row**, also called a **tuple** in the relational model and commonly
called a **record** in application development, is one complete set of
attribute values represented within a table.

Consider:

``` text
users

id | name | email
---|------|----------------
1  | Ali  | ali@example.com
2  | Sara | sara@example.com
```

This:

``` text
1 | Ali | ali@example.com
```

is one row.

It represents one stored user record.

Another row:

``` text
2 | Sara | sara@example.com
```

represents another user.

### Example

Insert one row:

``` sql
INSERT INTO users (name, email)
VALUES ('Ali', 'ali@example.com');
```

Retrieve rows:

``` sql
SELECT *
FROM users;
```

Retrieve one specific row:

``` sql
SELECT *
FROM users
WHERE id = 1;
```

------------------------------------------------------------------------

## Topic 10: Column

A **column** is a named component of a table's structure that represents
an attribute of the relation and has an associated data type and
potentially additional constraints governing the values that may appear
in that column.

Consider:

``` text
users

id | name | email
```

The columns are:

``` text
id
name
email
```

Each column describes one kind of value stored for every applicable row.

PostgreSQL also requires columns to have data types.

For example:

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL
);
```

Here:

``` text
id    → INTEGER
name  → TEXT
email → TEXT
```

### Example

Retrieve selected columns:

``` sql
SELECT name, email
FROM users;
```

Instead of retrieving every column:

``` sql
SELECT *
FROM users;
```

This becomes important when writing precise and efficient application
queries.

------------------------------------------------------------------------

## Topic 11: Entity

An **entity** is a distinguishable real-world object, concept, event, or
domain object about which a system needs to represent and store
information.

Entities belong to the **data model or application domain**. Tables are
database structures used to represent data about those entities.

Examples of entities include:

``` text
Customer
Product
Order
Employee
Department
Payment
```

During relational database design, an entity often leads to a table:

``` text
Customer   → customers
Product    → products
Order      → orders
```

However, entity and table are not strictly identical concepts.

An entity describes **what exists in the domain**.

A table describes **how related data is represented in the relational
database**.

### Example

Suppose the domain contains a `Product` entity with:

``` text
Product
├── id
├── name
├── price
└── stock
```

It can be represented as:

``` sql
CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL
);
```

------------------------------------------------------------------------

## Topic 12: Attribute

An **attribute** is a named property or characteristic that describes an
entity or relationship in a data model and is represented by values for
individual entity instances.

For example:

``` text
Employee
├── id
├── name
├── email
└── salary
```

`name`, `email`, and `salary` are attributes describing an employee.

When the entity is represented in a relational table, those attributes
commonly become columns.

``` text
Entity       → Employee
Attributes   → id, name, email, salary
Table        → employees
Columns      → id, name, email, salary
```

### Example

``` sql
CREATE TABLE employees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    salary NUMERIC(12, 2) NOT NULL
);

INSERT INTO employees (name, email, salary)
VALUES ('Ali', 'ali@example.com', 80000.00);
```

The inserted row contains values for the employee's represented
attributes.

------------------------------------------------------------------------

## Topic 13: Schema

A **database schema** is the formal logical definition and organization
of database structures, including objects such as tables, columns,
relationships, constraints, indexes, and other database objects; in
PostgreSQL, a **schema** also specifically refers to a named namespace
inside a database used to organize database objects.

The word `schema` therefore depends on context.

When discussing database design generally, schema may mean:

``` text
What tables exist?
What columns do they contain?
How are the tables related?
What constraints exist?
What indexes exist?
```

In PostgreSQL specifically, schemas are namespaces inside a database.

For example:

``` text
company database
│
├── public
│   ├── users
│   └── products
│
└── accounting
    ├── invoices
    └── payments
```

`public` and `accounting` are PostgreSQL schemas.

### Example

Create a PostgreSQL schema:

``` sql
CREATE SCHEMA accounting;
```

Create a table inside it:

``` sql
CREATE TABLE accounting.invoices (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL
);
```

Query it using its schema-qualified name:

``` sql
SELECT *
FROM accounting.invoices;
```

------------------------------------------------------------------------

## Topic 14: Primary Key

A **primary key** is a table constraint that designates one column or a
combination of columns as the primary identifier for rows in that table,
requiring every primary-key value to be unique and non-null.

A table may contain records with identical values in ordinary columns.

For example:

``` text
id | name
---|------
1  | Ali
2  | Ali
```

The name cannot reliably identify a particular row.

The primary key can:

``` text
id = 1
id = 2
```

Primary keys are important because applications and relationships
frequently need an unambiguous way to reference individual records.

### Example

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO users (name)
VALUES ('Ali'), ('Ali');

SELECT *
FROM users;
```

Possible result:

``` text
id | name
---|------
1  | Ali
2  | Ali
```

Trying to explicitly create duplicate primary-key values in a table
where explicit ID insertion is permitted would violate the primary-key
constraint.

------------------------------------------------------------------------

## Topic 15: Foreign Key

A **foreign key** is a referential constraint defined on one or more
columns in a table that requires their non-null values to correspond to
values of a referenced candidate key, typically a primary key or unique
key, in another table or in the same table.

A foreign key is one of the primary mechanisms used to represent and
enforce relationships between relational data.

Consider:

``` text
customers

id | name
---|------
1  | Ali
```

and:

``` text
orders

id  | customer_id
----|------------
101 | 1
```

`orders.customer_id = 1` refers to `customers.id = 1`.

Conceptually:

``` text
customers.id
      │
      │ referenced by
      ▼
orders.customer_id
```

### Example

``` sql
CREATE TABLE customers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    total NUMERIC(10, 2) NOT NULL,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
);
```

Insert a customer:

``` sql
INSERT INTO customers (name)
VALUES ('Ali');
```

Create a valid order:

``` sql
INSERT INTO orders (customer_id, total)
VALUES (1, 5000.00);
```

Now try:

``` sql
INSERT INTO orders (customer_id, total)
VALUES (999, 5000.00);
```

If customer `999` does not exist, PostgreSQL rejects the operation
because it violates the foreign-key constraint.

------------------------------------------------------------------------

## Topic 16: Relationship

A **relationship** is a defined association between entity types or
their instances in a data model; in a relational database, such
associations are commonly represented through matching key values and
may be enforced using foreign-key and uniqueness constraints.

Real application data is usually connected.

Examples:

``` text
Customer → Orders
Department → Employees
Order → Order Items
Post → Comments
```

The database must represent these associations.

For example:

``` text
customers.id
      │
      ▼
orders.customer_id
```

The matching key values express which customer owns a particular order.

### Example

``` sql
SELECT
    customers.name,
    orders.id,
    orders.total
FROM customers
INNER JOIN orders
    ON customers.id = orders.customer_id;
```

This query uses the relationship to combine information from the two
tables.

------------------------------------------------------------------------

## Topic 17: Cardinality

**Cardinality**, in data modeling, specifies the numerical relationship
between entity sets by describing how many instances of one entity may
or must be associated with instances of another entity, such as
one-to-one, one-to-many, or many-to-many.

Cardinality answers questions such as:

``` text
How many orders can one customer have?
How many customers can one order belong to?
How many courses can one student take?
```

Common relationship shapes are:

### One-to-One

``` text
Person ─── Passport
```

One record is associated with at most one corresponding record according
to the model.

### One-to-Many

``` text
Customer
   │
   ├── Order 1
   ├── Order 2
   └── Order 3
```

One customer can have many orders.

### Many-to-One

The same relationship viewed from the other direction:

``` text
Many Orders
     │
     ▼
One Customer
```

### Many-to-Many

``` text
Students ↔ Courses
```

A student can take many courses and a course can contain many students.

A relational design commonly introduces a junction table:

``` text
students
    │
    ▼
student_courses
    ▲
    │
courses
```

### Example

One-to-many:

``` sql
CREATE TABLE customers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id)
);
```

Many-to-many:

``` sql
CREATE TABLE students (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE courses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL
);

CREATE TABLE student_courses (
    student_id INTEGER REFERENCES students(id),
    course_id INTEGER REFERENCES courses(id),
    PRIMARY KEY (student_id, course_id)
);
```

------------------------------------------------------------------------

## Topic 18: Referential Integrity

**Referential integrity** is the property of a relational database that
ensures references between related records remain valid according to
defined referential constraints, preventing foreign-key values from
referring to nonexistent or otherwise invalid referenced keys.

Suppose:

``` text
customers

id | name
---|------
1  | Ali
```

An order containing:

``` text
customer_id = 1
```

has a valid reference.

An order containing:

``` text
customer_id = 999
```

would be invalid if no customer with ID `999` exists.

Without referential integrity, databases can accumulate orphaned or
inconsistent records.

### Example

``` sql
CREATE TABLE customers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id)
);
```

This succeeds after customer `1` exists:

``` sql
INSERT INTO orders (customer_id)
VALUES (1);
```

This fails if customer `999` does not exist:

``` sql
INSERT INTO orders (customer_id)
VALUES (999);
```

The database itself protects the validity of the relationship.

------------------------------------------------------------------------

## Topic 19: Constraint

A **constraint** is a declarative rule defined as part of a database
schema that restricts the values or relationships permitted in stored
data so that specified integrity requirements are enforced by the DBMS.

Common PostgreSQL constraints include:

``` text
PRIMARY KEY
FOREIGN KEY
NOT NULL
UNIQUE
CHECK
```

Constraints move important data rules into the database itself.

For example, suppose an application requires:

``` text
Every user must have an email.
Emails must be unique.
Age cannot be negative.
```

These rules can be represented directly in the database.

### Example

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    age INTEGER CHECK (age >= 0)
);
```

Valid:

``` sql
INSERT INTO users (email, age)
VALUES ('ali@example.com', 25);
```

Invalid negative age:

``` sql
INSERT INTO users (email, age)
VALUES ('sara@example.com', -5);
```

Invalid duplicate email:

``` sql
INSERT INTO users (email, age)
VALUES ('ali@example.com', 30);
```

PostgreSQL rejects operations that violate the defined constraints.

------------------------------------------------------------------------

## Topic 20: Data Integrity

**Data integrity** is the degree to which stored data remains accurate,
valid, consistent, complete according to defined rules, and reliable
throughout its creation, modification, storage, and use.

A database should not merely store data. It should help prevent invalid
states.

Examples of invalid states include:

``` text
Two users with an email that must be unique
An order referring to a nonexistent customer
A required value being NULL
A negative quantity where only non-negative quantities are allowed
```

Application-level validation is useful, but important database
invariants should also be enforced at the database level when
appropriate.

A frontend validation rule alone is not sufficient because data may
reach the backend from different clients or application processes.

### Example

``` sql
CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0)
);
```

This is valid:

``` sql
INSERT INTO products (name, price, stock)
VALUES ('Keyboard', 5000.00, 10);
```

This is invalid:

``` sql
INSERT INTO products (name, price, stock)
VALUES ('Keyboard', -5000.00, -10);
```

The constraints help maintain data integrity.

------------------------------------------------------------------------

## Topic 21: Persistence

**Persistence** is the property by which data survives beyond the
lifetime of the process, request, session, or in-memory object that
created or accessed it, typically through storage on durable media
managed by a database system.

Consider:

``` js
let user = {
  name: "Ali"
};
```

This object exists in application memory.

If the process terminates, the in-memory object disappears.

Persisting the information means storing it in durable storage through
the database:

``` sql
INSERT INTO users (name, email)
VALUES ('Ali', 'ali@example.com');
```

The data can then be retrieved by a later request or after an
application restart.

### Example

Store data:

``` sql
INSERT INTO users (name, email)
VALUES ('Ali', 'ali@example.com');
```

Disconnect from PostgreSQL, reconnect, and execute:

``` sql
SELECT *
FROM users;
```

The previously inserted row remains available because it was persisted
in the database.

------------------------------------------------------------------------

## Topic 22: CRUD

**CRUD** is a common abstraction for the four fundamental categories of
persistent data operations: **Create, Read, Update, and Delete**, which
in relational SQL applications are commonly implemented using `INSERT`,
`SELECT`, `UPDATE`, and `DELETE`.

The mapping is:

``` text
Create → INSERT
Read   → SELECT
Update → UPDATE
Delete → DELETE
```

Most application features ultimately perform one or more of these
operations.

For example:

``` text
Register user      → Create
View user profile  → Read
Edit user profile  → Update
Delete user        → Delete
```

### Example

Create:

``` sql
INSERT INTO users (name, email)
VALUES ('Ali', 'ali@example.com');
```

Read:

``` sql
SELECT *
FROM users
WHERE email = 'ali@example.com';
```

Update:

``` sql
UPDATE users
SET name = 'Ali Khan'
WHERE email = 'ali@example.com';
```

Delete:

``` sql
DELETE FROM users
WHERE email = 'ali@example.com';
```
