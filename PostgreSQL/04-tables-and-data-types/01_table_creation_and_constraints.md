# Tables and Core Constraints

## Topic 1: CREATE TABLE

`CREATE TABLE` is a SQL DDL statement used to define a new table by
specifying its columns, data types, and optional constraints.

A table defines the structure in which related records are stored. Each
column has a name and data type, and constraints can enforce rules on
the stored data.

``` sql
CREATE TABLE customers (
    id INTEGER,
    name TEXT,
    email TEXT
);
```

## Topic 2: NOT NULL

`NOT NULL` is a column constraint that prevents SQL `NULL` from being
stored in a column, ensuring that every row contains a value for that
column.

``` sql
CREATE TABLE customers (
    id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL
);
```

A constraint can also be added to an existing column:

``` sql
ALTER TABLE customers
ALTER COLUMN name SET NOT NULL;
```

Existing data must already satisfy the new constraint. If rows contain
`NULL`, PostgreSQL rejects the change until those rows are fixed or
removed.

``` sql
SELECT *
FROM customers
WHERE name IS NULL;

UPDATE customers
SET name = 'Unknown'
WHERE name IS NULL;
```

## Topic 3: PRIMARY KEY

A primary key is a constraint that uniquely identifies each row in a
table and enforces both uniqueness and non-nullability on the key column
or columns.

``` sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);
```

For an existing table:

``` sql
ALTER TABLE customers
ADD PRIMARY KEY (id);
```

A duplicate or `NULL` primary-key value is rejected.

## Topic 4: DEFAULT

A column default specifies the value PostgreSQL uses when an `INSERT`
does not provide a value for that column.

``` sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
```

``` sql
INSERT INTO customers (id, name)
VALUES (1, 'Ali');
```

`is_active` becomes `TRUE`. An explicitly supplied value overrides the
default. If `NULL` is explicitly supplied and the column permits `NULL`,
PostgreSQL stores `NULL`.

``` sql
is_active BOOLEAN NOT NULL DEFAULT TRUE
```

`DEFAULT` supplies an omitted value; `NOT NULL` prevents missing values.

## Topic 5: UNIQUE

`UNIQUE` is a constraint that prevents duplicate non-NULL values, or
duplicate combinations of values, in the constrained column or columns.

``` sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE
);
```

For an existing table:

``` sql
ALTER TABLE customers
ADD CONSTRAINT customer_email_unique UNIQUE (email);
```

`customer_email_unique` is simply the constraint name. Naming
constraints makes them easy to identify and manage later.

``` sql
ALTER TABLE customers
DROP CONSTRAINT customer_email_unique;
```

A normal PostgreSQL `UNIQUE` constraint can allow multiple `NULL`
values. If a value must both exist and be unique:

``` sql
email TEXT UNIQUE NOT NULL
```

## Topic 6: CHECK

`CHECK` is a constraint that requires inserted or updated data to
satisfy a Boolean condition.

``` sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    age INTEGER CHECK (age >= 18)
);
```

Values below 18 are rejected. A `CHECK` condition by itself does not
necessarily reject `NULL`, so combine it with `NOT NULL` when a value is
required.

``` sql
age INTEGER NOT NULL CHECK (age >= 18)
```

Constraints are enforced on both `INSERT` and `UPDATE`.

``` sql
UPDATE customers
SET age = 10
WHERE id = 1;
```

If the constraint requires `age >= 18`, this update is rejected.
