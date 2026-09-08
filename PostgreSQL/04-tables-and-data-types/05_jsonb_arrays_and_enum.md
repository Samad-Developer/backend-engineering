# JSONB, Arrays, and ENUM

## Topic 1: JSONB

`JSONB` is a PostgreSQL data type that stores JSON data in a binary
structured representation that PostgreSQL can query, manipulate, and
index.

It is useful for flexible or semi-structured attributes whose fields may
vary between records.

``` sql
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    specifications JSONB
);
```

``` sql
INSERT INTO products (name, specifications)
VALUES (
    'Laptop',
    '{"ram": "16GB", "storage": "512GB", "touchscreen": true}'
);
```

PostgreSQL can query values inside the JSON structure:

``` sql
SELECT specifications->>'ram'
FROM products;
```

`->` extracts a JSON/JSONB value. `->>` is the JSON/JSONB
text-extraction operator and returns the selected value as text.

``` sql
SELECT *
FROM products
WHERE specifications->>'ram' = '16GB';
```

Stable core attributes such as names, emails, prices, and relational
keys should normally remain regular columns. `JSONB` should not be used
merely to avoid relational design.

## Topic 2: Arrays

A PostgreSQL array is a data type that allows one column to store
multiple values of the same element type.

``` sql
supported_languages TEXT[]
```

Example:

``` sql
CREATE TABLE applications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    supported_languages TEXT[]
);

INSERT INTO applications (name, supported_languages)
VALUES (
    'Example App',
    ARRAY['English', 'Urdu', 'Pashto']
);
```

PostgreSQL arrays use 1-based indexing:

``` sql
SELECT supported_languages[1]
FROM applications;
```

An array can be searched with `ANY`:

``` sql
SELECT *
FROM applications
WHERE 'Urdu' = ANY(supported_languages);
```

Arrays are appropriate for small list-like attributes belonging directly
to one record.

They should not normally replace real relationships. For example,
storing course IDs directly in a student's array makes referential
integrity and relationship attributes such as `enrolled_at` and `grade`
awkward.

A proper many-to-many design is:

``` sql
CREATE TABLE student_courses (
    student_id BIGINT REFERENCES students(id),
    course_id BIGINT REFERENCES courses(id),
    enrolled_at DATE,
    grade TEXT,
    PRIMARY KEY (student_id, course_id)
);
```

Each relationship row can now carry its own attributes without relying
on matching array positions.

## Topic 3: ENUM

An ENUM is a PostgreSQL data type that restricts a column to one value
from a predefined set of named values.

``` sql
CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled'
);
```

Use it as a column type:

``` sql
CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status order_status NOT NULL DEFAULT 'pending'
);
```

Only values defined by the ENUM are valid. A default value must also be
one of the valid ENUM values.

``` sql
INSERT INTO orders DEFAULT VALUES;

UPDATE orders
SET status = 'confirmed'
WHERE id = 1;
```

An invalid value is rejected:

``` sql
UPDATE orders
SET status = 'unknown'
WHERE id = 1;
```

ENUM is an actual data type, while `CHECK` is a constraint. Both can
restrict values, but they model the rule differently.

ENUM is most suitable for a small, predefined, relatively stable set of
states such as payment status or order status. Dynamic
application-managed values such as categories or departments are usually
better represented by tables.
