# Normal Forms and Practical Normalization

## Topic 1: First Normal Form (1NF)

**First Normal Form (1NF) is a relational design condition in which a
table has no repeating groups, each attribute contains a single value
from its defined domain, and rows can be uniquely distinguished.**

The practical idea is that one field should not hide a collection of
independent relational values.

    student_id student_name   courses
  ------------ -------------- ---------------------
             1 Ali            PostgreSQL, Node.js
             2 Sara           React, PostgreSQL

The `courses` field contains multiple independent values. A better
design separates students, courses, and their relationship.

``` sql
CREATE TABLE students (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE courses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE student_courses (
    student_id INTEGER NOT NULL REFERENCES students(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    PRIMARY KEY (student_id, course_id)
);
```

Avoid repeating columns such as `course_1`, `course_2`, and `course_3`.
Atomicity does not mean every multi-word string must be split;
independent relational facts are the concern.

## Topic 2: Second Normal Form (2NF)

**A table is in Second Normal Form (2NF) if it is already in 1NF and
every non-key attribute is fully functionally dependent on the entire
candidate key rather than only part of a composite candidate key.**

A **partial dependency** occurs when a non-key attribute depends on only
part of a composite candidate key.

    student_id   course_id student_name   course_name   grade
  ------------ ----------- -------------- ------------- -------
             1          10 Ali            PostgreSQL    A
             1          20 Ali            Node.js       B

With `(student_id, course_id)` as the key:

``` text
student_id -> student_name
course_id -> course_name
(student_id, course_id) -> grade
```

`student_name` and `course_name` are partial dependencies. `grade`
correctly depends on the complete pair.

The normalized structure is:

``` text
students(id, name)
courses(id, name)
student_courses(student_id, course_id, grade)
```

Practical rule: **when a key contains multiple columns, a non-key
attribute belonging in that table should depend on the complete key.**

## Topic 3: Third Normal Form (3NF)

**A table is in Third Normal Form (3NF) if it is already in 2NF and
non-key attributes do not have inappropriate transitive dependencies on
candidate keys through other non-key attributes.**

A **transitive dependency** occurs when a non-key attribute depends on
another non-key attribute that itself depends on a candidate key.

    employee_id employee_name     department_id department_name
  ------------- --------------- --------------- -----------------
              1 Ali                          10 Engineering
              2 Sara                         20 Marketing

``` text
employee_id -> department_id
department_id -> department_name

Therefore:
employee_id -> department_id -> department_name
```

`department_name` belongs in a separate `departments` table.

``` sql
CREATE TABLE departments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE employees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id)
);
```

Practical rule: **store a fact with the entity or relationship that
actually determines it.**

## Topic 4: Comparing 1NF, 2NF, and 3NF

  -----------------------------------------------------------------------
  Normal Form             Main Problem            Practical Rule
  ----------------------- ----------------------- -----------------------
  1NF                     Repeating groups /      Proper single-value
                          collections             relational structure

  2NF                     Partial dependency      Depend on the whole
                                                  composite key

  3NF                     Transitive dependency   Avoid inappropriate
                                                  non-key-to-non-key
                                                  dependency
  -----------------------------------------------------------------------

``` text
1NF -> no repeating groups / hidden collections
2NF -> no partial dependency
3NF -> no inappropriate transitive dependency
```

## Topic 5: Choosing an Appropriate Normalized Structure

**Choosing an appropriate normalized structure is the process of
identifying entities, assigning attributes to the entities or
relationships they describe, defining relationships, and analyzing
dependencies so each fact is stored in a logically appropriate
location.**

A practical process is:

``` text
1. Identify entities.
2. Identify their attributes.
3. Identify relationships.
4. Check 1NF.
5. Check partial dependencies for 2NF.
6. Check transitive dependencies for 3NF.
```

For example, employees belong to departments, while employees and
projects can have a many-to-many relationship. The assignment can store
`hours`.

``` sql
CREATE TABLE departments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    office_location TEXT NOT NULL
);

CREATE TABLE employees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id)
);

CREATE TABLE projects (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE employee_projects (
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    hours INTEGER NOT NULL,
    PRIMARY KEY (employee_id, project_id)
);
```

`hours` belongs in the junction table because:

``` text
(employee_id, project_id) -> hours
```

For a one-to-many relationship, the foreign key normally goes on the
many side. The goal of normalization is not to create as many tables as
possible; it is to store each fact where it logically belongs.
