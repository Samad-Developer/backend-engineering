# Self JOIN and CROSS JOIN

## Topic 1: Self JOIN

A self join is a query pattern in which a table is joined to another reference of itself so rows in the table can be related to other rows in the same table.

There is no `SELF JOIN` keyword. A normal JOIN type such as `INNER JOIN` or `LEFT JOIN` is used with two aliases for the same table.

Example employee hierarchy:

```sql
CREATE TABLE employees (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    manager_id BIGINT REFERENCES employees(id)
);
```

The foreign key references the same table:

```text
employees.manager_id → employees.id
```

To return employees and their managers:

```sql
SELECT
    e.name AS employee_name,
    m.name AS manager_name
FROM employees AS e
LEFT JOIN employees AS m
    ON e.manager_id = m.id;
```

Here:

```text
e → employee role
m → manager role
```

Both aliases refer to the same physical table. The aliases distinguish its two logical roles.

Self joins are useful for structures such as employees and managers, parent and child categories, threaded comments, and referral relationships.

## Topic 2: CROSS JOIN

A `CROSS JOIN` combines every row from the first table with every row from the second table, producing the Cartesian product of the two sets.

```sql
SELECT
    c.name AS color,
    s.name AS size
FROM colors AS c
CROSS JOIN sizes AS s;
```

If `colors` contains 2 rows and `sizes` contains 3 rows, the result contains:

```text
2 × 3 = 6 rows
```

Example:

```text
Black | S
Black | M
Black | L
White | S
White | M
White | L
```

A cross join normally has no `ON` condition because it intentionally creates every possible combination.

It is useful when all combinations are required, such as generating product color-size combinations. It must be used carefully because result size grows multiplicatively.
