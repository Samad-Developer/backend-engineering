# SQL CRUD Operations

## Topic 1: CRUD

CRUD is a common application-development term describing the four
fundamental data operations: Create, Read, Update, and Delete.

``` text
Create -> INSERT
Read   -> SELECT
Update -> UPDATE
Delete -> DELETE
```

CRUD itself is simple. Real applications add filtering, joins,
validation, authorization, transactions, constraints, concurrency
control, and performance considerations around these operations.

## Topic 2: INSERT

`INSERT` is a SQL Data Manipulation Language statement used to add one
or more new rows to a table.

``` sql
INSERT INTO app_users (name, email)
VALUES ('Samad', 'samad@gmail.com');
```

Multiple rows:

``` sql
INSERT INTO app_users (name, email)
VALUES
    ('Ali', 'ali@gmail.com'),
    ('Sara', 'sara@gmail.com');
```

## Topic 3: SELECT

`SELECT` is a SQL statement used to retrieve data from one or more
tables.

``` sql
SELECT id, name, email
FROM app_users
WHERE id = 1;
```

Mental model:

``` text
SELECT -> Which columns?
FROM   -> From which table?
WHERE  -> Which rows?
```

## Topic 4: UPDATE

`UPDATE` is a SQL statement used to modify existing rows.

``` sql
UPDATE app_users
SET name = 'Abdus Samad'
WHERE id = 1;
```

Multiple columns can be changed in one statement. The `WHERE` clause
determines which rows are affected. Without `WHERE`, every row is
updated.

## Topic 5: DELETE

`DELETE` is a SQL statement used to remove existing rows.

``` sql
DELETE FROM app_users
WHERE id = 1;
```

Without `WHERE`:

``` sql
DELETE FROM app_users;
```

all rows are removed, while the table itself remains.
