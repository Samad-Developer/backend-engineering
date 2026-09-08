# Core PostgreSQL Data Types

## Topic 1: INTEGER

`INTEGER` is a 4-byte signed numeric data type used to store whole
numbers without decimal places.

Its range is approximately -2.1 billion to +2.1 billion.

``` sql
stock INTEGER
quantity INTEGER
age INTEGER
```

Use it for ordinary bounded whole-number values.

## Topic 2: BIGINT

`BIGINT` is an 8-byte signed numeric data type used for whole numbers
requiring a much larger range than `INTEGER`.

``` sql
id BIGINT
views BIGINT
```

It is useful for identifiers and counters that may grow very large.

## Topic 3: TEXT

`TEXT` is a variable-length character data type used to store strings
without a declared character-length limit.

``` sql
name TEXT
email TEXT
description TEXT
```

`VARCHAR(n)` adds a maximum character limit:

``` sql
username VARCHAR(30)
```

In PostgreSQL, `TEXT` is a normal choice when no meaningful maximum
length needs to be enforced.

## Topic 4: BOOLEAN

`BOOLEAN` stores logical truth values: `TRUE`, `FALSE`, or `NULL` when
nullability is permitted.

``` sql
is_active BOOLEAN NOT NULL DEFAULT TRUE
```

Typical uses include flags such as `is_active`, `is_verified`, and
`is_available`.

## Topic 5: NUMERIC and DECIMAL

`NUMERIC` is an exact numeric data type used for decimal values where
precision must be preserved without floating-point approximation.
`DECIMAL` is equivalent to `NUMERIC` in PostgreSQL.

``` sql
price NUMERIC(10, 2)
```

In `NUMERIC(10,2)`, 10 is the maximum total number of digits and 2 is
the number of fractional digits.

``` sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE
);
```

Exact decimal arithmetic makes `NUMERIC` appropriate for many monetary
values.
