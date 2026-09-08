# Database Keys

## Topic 1: Primary Key

A **primary key** is a table constraint that designates one column or a
combination of columns as the main identifier for rows in that table.
Every primary-key value must be unique, and no primary-key column can
contain `NULL`.

The primary key answers:

> Which value uniquely identifies this exact row?

Consider this table:

``` text
users

id | name
---|------
1  | Ali
2  | Sara
3  | Ali
```

The `name` column cannot identify a row reliably because different users
can have the same name.

The `id` column can:

``` text
id = 1
id = 2
id = 3
```

Each value identifies exactly one row.

A table can have only one primary-key constraint, although that primary
key can consist of more than one column.

### Example

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);
```

Insert rows:

``` sql
INSERT INTO users (name)
VALUES
    ('Ali'),
    ('Sara');
```

Read the data:

``` sql
SELECT *
FROM users;
```

Possible result:

``` text
id | name
---|------
1  | Ali
2  | Sara
```

The database generated the `id` values and uses them as the primary
identifiers.

------------------------------------------------------------------------

## Topic 2: Foreign Key

A **foreign key** is a referential constraint defined on one or more
columns whose non-null values must match values of a referenced
candidate key, usually a primary key or unique key, in another table or
in the same table.

A foreign key is mainly used to represent and enforce relationships
between records.

Suppose there are two tables:

``` text
users

id | name
---|------
1  | Ali
2  | Sara
```

``` text
orders

id  | user_id
----|--------
101 | 1
102 | 1
103 | 2
```

`orders.user_id` refers to `users.id`.

Conceptually:

``` text
users.id
   │
   │ referenced by
   ▼
orders.user_id
```

The foreign key makes sure an order cannot refer to a user that does not
exist.

### Example

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
);
```

Insert users:

``` sql
INSERT INTO users (name)
VALUES
    ('Ali'),
    ('Sara');
```

Insert a valid order:

``` sql
INSERT INTO orders (user_id)
VALUES (1);
```

This works because user `1` exists.

Now try:

``` sql
INSERT INTO orders (user_id)
VALUES (999);
```

PostgreSQL rejects the operation if user `999` does not exist.

The foreign key therefore helps enforce **referential integrity**.

### Inline syntax

The same foreign key can also be written more compactly:

``` sql
CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id)
);
```

Both forms create a foreign-key constraint.

------------------------------------------------------------------------

## Topic 3: Candidate Key

A **candidate key** is a minimal column or minimal combination of
columns whose values uniquely identify every row in a table. A table can
have multiple candidate keys, but only one of them is chosen as the
primary key.

The word **candidate** means:

> This key is eligible to become the primary key.

Consider:

``` text
users

id | email              | username
---|--------------------|---------
1  | ali@example.com    | ali01
2  | sara@example.com   | sara01
```

Suppose all of these are guaranteed unique:

``` text
id
email
username
```

Then each one can uniquely identify a user.

Therefore all three can be candidate keys.

If `id` is selected as the primary key:

``` text
id       → candidate key + primary key
email    → candidate key
username → candidate key
```

A candidate key must also be **minimal**.

For example, if `email` alone uniquely identifies a user, then:

``` text
(email, username)
```

is not considered a minimal candidate key because `email` alone is
already sufficient.

### Example

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL
);
```

Here:

``` text
id
email
username
```

can all serve as candidate keys because each is unique and non-null.

The chosen primary key is:

``` text
id
```

Candidate key is primarily a **database-design concept** rather than a
separate PostgreSQL constraint named `CANDIDATE KEY`.

In PostgreSQL, candidate keys are normally implemented using:

``` text
PRIMARY KEY
UNIQUE + NOT NULL
```

------------------------------------------------------------------------

## Topic 4: Unique Key

A **unique key** is a constraint that requires the values in one column
or a combination of columns to be unique among rows, preventing
duplicate values according to the database system's uniqueness rules.

A unique constraint is useful when a value must not repeat even though
it is not the table's primary identifier.

For example:

``` text
users

id | email
---|-----------------
1  | ali@example.com
2  | sara@example.com
```

The primary key may be:

``` text
id
```

while the email must also be unique.

### Example

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
);
```

Insert:

``` sql
INSERT INTO users (email)
VALUES ('ali@example.com');
```

This works.

Now try:

``` sql
INSERT INTO users (email)
VALUES ('ali@example.com');
```

PostgreSQL rejects it because the email already exists.

A table can have:

``` text
one primary-key constraint
multiple UNIQUE constraints
```

### Multi-column unique constraint

Uniqueness can also apply to a combination of columns:

``` sql
CREATE TABLE room_bookings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id INTEGER NOT NULL,
    booking_date DATE NOT NULL,

    UNIQUE (room_id, booking_date)
);
```

This means:

``` text
room_id + booking_date
```

must be unique together.

So room `5` cannot have two rows for the same date.

------------------------------------------------------------------------

## Topic 5: Composite Key

A **composite key** is a key composed of two or more columns whose
combined values uniquely identify a row or satisfy a uniqueness
requirement.

The important point is:

> The individual columns may repeat, but their combination must be
> unique.

Example:

``` text
student_courses

student_id | course_id
-----------|----------
1          | 10
1          | 20
2          | 10
```

`student_id` is not unique.

`course_id` is not unique.

But this pair:

``` text
(student_id, course_id)
```

can uniquely identify each enrollment row.

### Example

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
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(id),

    FOREIGN KEY (course_id)
        REFERENCES courses(id),

    PRIMARY KEY (student_id, course_id)
);
```

The primary key consists of two columns:

``` sql
PRIMARY KEY (student_id, course_id)
```

That is a **composite primary key**.

Insert data:

``` sql
INSERT INTO students (name)
VALUES ('Ali');

INSERT INTO courses (title)
VALUES
    ('PostgreSQL'),
    ('Node.js');
```

Create enrollments:

``` sql
INSERT INTO student_courses (student_id, course_id)
VALUES
    (1, 1),
    (1, 2);
```

Now try to insert the same pair again:

``` sql
INSERT INTO student_courses (student_id, course_id)
VALUES (1, 1);
```

PostgreSQL rejects it because:

``` text
(1, 1)
```

already exists.

A composite key can be:

``` text
composite primary key
```

or a:

``` text
composite unique key
```

Example:

``` sql
UNIQUE (room_id, booking_date)
```

------------------------------------------------------------------------

## Topic 6: Natural Key

A **natural key** is a key based on meaningful real-world or business
data that already exists in the problem domain and can uniquely identify
a record without requiring an artificial identifier to be created solely
for database purposes.

Examples can include:

``` text
ISBN for a book
VIN for a vehicle
ISO country code
passport number
email address in some systems
```

A natural key has meaning outside the database.

For example:

``` text
ISBN = 9780131103627
```

identifies a specific book edition and is meaningful in the real world.

### Example

``` sql
CREATE TABLE books (
    isbn TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);
```

Insert:

``` sql
INSERT INTO books (isbn, title, price)
VALUES (
    '9780131103627',
    'The C Programming Language',
    49.99
);
```

Query:

``` sql
SELECT *
FROM books
WHERE isbn = '9780131103627';
```

Here:

``` text
isbn
```

is both:

``` text
natural key
primary key
```

Natural keys can be useful, but they should be chosen carefully.

A natural value may:

-   change;
-   be entered incorrectly;
-   have formatting rules;
-   be large;
-   stop being unique because business rules change.

Because of this, many application databases use surrogate primary keys
while keeping natural business identifiers under `UNIQUE` constraints.

Example:

``` sql
CREATE TABLE books (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    isbn TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL
);
```

Here:

``` text
id   → surrogate primary key
isbn → natural candidate key
```

------------------------------------------------------------------------

## Topic 7: Surrogate Key

A **surrogate key** is an artificial, system-generated identifier
created solely to uniquely identify a database row and carrying no
intrinsic business or domain meaning.

Common surrogate keys include:

``` text
auto-generated integer IDs
UUIDs
```

Example:

``` text
id = 1
id = 2
id = 3
```

These values do not describe the user, product, or order.

Their job is simply:

> uniquely identify the row.

### Example using identity columns

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);
```

Insert:

``` sql
INSERT INTO users (email, name)
VALUES ('ali@example.com', 'Ali');
```

PostgreSQL generates the `id`.

Possible result:

``` text
id | email           | name
---|-----------------|-----
1  | ali@example.com | Ali
```

Here:

``` text
id
```

is a surrogate key.

### Example using UUID

``` sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total NUMERIC(10, 2) NOT NULL
);
```

Insert:

``` sql
INSERT INTO orders (total)
VALUES (5000.00)
RETURNING *;
```

Possible result:

``` text
id                                   | total
-------------------------------------|-------
b8a6b7ea-91fa-4f10-a129-5d8867e4aabc | 5000
```

The UUID is also a surrogate key because it was generated only to
identify the row.

### Natural key vs surrogate key

Consider:

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
);
```

Here:

``` text
id
→ surrogate key

email
→ natural/business value
```

Suppose the email changes:

``` text
ali@example.com
        ↓
ali.khan@example.com
```

The user's identity can remain:

``` text
id = 1
```

That stability is one major reason surrogate primary keys are widely
used in application databases.
