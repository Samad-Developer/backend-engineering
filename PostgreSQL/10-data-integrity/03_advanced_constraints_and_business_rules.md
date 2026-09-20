# Stage 10 — Data Integrity
## Section 3 — Advanced Constraints

## 1. Why advanced constraints matter

Basic constraints protect individual values and relationships, but real systems often need rules involving combinations of columns or business requirements that must always remain true.

---

## 2. Composite Primary Keys

### Problem

Sometimes one column alone cannot uniquely identify a row.

Example:

```text
student_id | course_id
-----------+----------
1          | 10
1          | 20
2          | 10
```

Neither column is unique by itself, but the combination `(student_id, course_id)` should be unique.

### Definition

A **composite primary key** is a primary key made from two or more columns together.

```sql
CREATE TABLE student_courses (
    student_id BIGINT,
    course_id BIGINT,

    PRIMARY KEY (student_id, course_id)
);
```

This allows:

```text
1 | 10
1 | 20
```

but rejects another:

```text
1 | 10
```

Important:

> The individual columns do not need to be unique. The combination must be unique.

### Common junction-table example

```sql
CREATE TABLE order_items (
    order_id BIGINT REFERENCES orders(id),
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL,

    PRIMARY KEY (order_id, product_id)
);
```

This protects data integrity by preventing the same relationship from being stored twice.

---

## 3. Composite Unique Constraints

### Problem

Sometimes a combination must be unique, but that combination is not the table's primary key.

Example:

```text
user_id | role
--------+-------
1       | ADMIN
1       | EDITOR
2       | ADMIN
```

The same user may have different roles, but this should be rejected:

```text
1 | ADMIN
1 | ADMIN
```

### Definition

A **composite unique constraint** enforces uniqueness across two or more columns together.

```sql
CREATE TABLE user_roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role TEXT NOT NULL,

    UNIQUE (user_id, role)
);
```

Difference:

```text
Composite PRIMARY KEY
→ combination is the row's main identifier

Composite UNIQUE
→ another primary key identifies the row,
  but this combination still cannot repeat
```

---

## 4. Multi-Column Constraints

### Problem

Sometimes a rule depends on the relationship between multiple columns in the same row.

Example:

```text
original_price | discount_price
---------------+---------------
1000           | 800   → valid
1000           | 1200  → invalid
```

### Definition

A **multi-column constraint** is a constraint whose rule depends on more than one column together.

Example:

```sql
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    original_price NUMERIC NOT NULL,
    discount_price NUMERIC,

    CHECK (
        discount_price IS NULL
        OR discount_price <= original_price
    )
);
```

Another example:

```sql
CREATE TABLE bookings (
    id BIGINT PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    CHECK (end_date >= start_date)
);
```

Mental model:

```text
one row
→ compare multiple columns
→ rule true? store row
→ rule false? reject row
```

---

## 5. Database-Level Business Rules

### Problem

Applications have business requirements such as:

```text
stock cannot be negative
discount price cannot exceed original price
order total cannot be negative
end date cannot be before start date
```

If these rules exist only in application code, they can be bypassed by direct SQL, another service, a script, or an application bug.

### Definition

A **database-level business rule** is a business requirement enforced directly by the database using constraints.

Example:

```sql
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    stock INTEGER NOT NULL,

    CHECK (stock >= 0)
);
```

Business rule:

> Product stock must never be negative.

Another example:

```sql
CREATE TABLE bookings (
    id BIGINT PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    CHECK (end_date >= start_date)
);
```

Mental model:

```text
business requirement
→ database constraint
→ PostgreSQL rejects invalid data
```

Constraints commonly used for business rules:

```text
NOT NULL
→ required data

UNIQUE
→ value or combination cannot repeat

CHECK
→ custom row-level rule

FOREIGN KEY
→ relationship must remain valid
```

Developer takeaway:

> Important rules that must always remain true should be protected at the database level.

---

## 6. Application Validation vs Database Constraints

### Application validation

Application validation happens in the frontend, backend, or validation library such as Zod.

Example:

```ts
const productSchema = z.object({
  price: z.number().min(0),
});
```

Purpose:

```text
catch bad input early
→ show friendly errors
→ improve user experience
```

### Database constraints

PostgreSQL can enforce the same critical rule:

```sql
price NUMERIC NOT NULL
CHECK (price >= 0)
```

Purpose:

```text
guarantee invalid data cannot be stored
```

Even if someone bypasses the application and runs SQL directly, PostgreSQL still protects the rule.

---

## 7. Why use both?

They solve different problems.

```text
Application validation
→ early validation + friendly UX

Database constraints
→ guaranteed correctness + data integrity
```

Best pattern:

```text
Application validation
        ↓
friendly feedback

Database constraint
        ↓
final protection
```

### Example: unique email

Application code can check whether an email is already registered and return a friendly message.

But the database should still enforce:

```sql
email TEXT UNIQUE NOT NULL
```

because two requests can arrive almost simultaneously and both application checks could pass before either insert completes.

The database constraint is the final authority.

---

## 8. Practical rule for developers

Use application validation for:

```text
friendly error messages
early validation
better UX
request-specific validation
```

Use database constraints when a rule:

```text
must never be violated
protects relationships
protects uniqueness
protects valid values
must remain true regardless of the application
```

For critical rules:

> Validate in the application, but enforce the invariant in PostgreSQL.

---

## 9. Final Mental Model

```text
Composite Primary Key
→ multiple columns together identify one row

Composite Unique Constraint
→ multiple columns together must be unique,
  but another key identifies the row

Multi-Column Constraint
→ rule compares multiple columns in one row

Database-Level Business Rule
→ important business requirement enforced by PostgreSQL

Application Validation
→ friendly and early validation

Database Constraint
→ final guarantee that invalid data cannot be stored
```

Final developer takeaway:

```text
Application
→ help users submit valid data

Database
→ guarantee stored data remains valid
```
