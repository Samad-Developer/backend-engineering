# Foreign Keys and Relationship Implementation

## Topic 1: Foreign Keys and Relationships

A foreign key is a column or group of columns whose values reference a candidate key, usually the primary key, in another table or the same table, enforcing valid relationships between rows.

Foreign keys are the main relational mechanism used to connect normalized tables. For example, an order can store `customer_id` instead of duplicating the customer's name and email.

```sql
CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    total NUMERIC(10,2) NOT NULL
);
```

Here:

```text
orders.customer_id (FK) → customers.id (PK)
```

This relationship can later be used as a JOIN condition:

```sql
SELECT o.id, c.name, o.total
FROM orders AS o
JOIN customers AS c
    ON o.customer_id = c.id;
```

Joining through foreign keys means using the FK-to-referenced-key relationship to determine which rows belong together.

## Topic 2: One-to-One Relationship

A one-to-one relationship is a relationship where one row in table A can relate to at most one row in table B, and one row in table B can relate to at most one row in table A.

A common implementation uses a foreign key with a `UNIQUE` constraint.

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE user_profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
    bio TEXT
);
```

`UNIQUE` prevents multiple profile rows from referencing the same user.

## Topic 3: One-to-Many and Many-to-One Relationships

A one-to-many relationship means one row in the parent table can relate to many rows in the child table. Viewed from the child side, the same relationship is many-to-one.

```text
customers 1 ──────── M orders
orders    M ──────── 1 customers
```

The foreign key is normally stored on the many side.

```sql
CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    total NUMERIC(10,2) NOT NULL
);
```

One customer ID may therefore appear in many order rows.

## Topic 4: Many-to-Many Relationships and Junction Tables

A many-to-many relationship exists when rows on both sides can relate to many rows on the other side. In a relational database, it is normally implemented using a junction table containing foreign keys to both participating tables.

```text
orders
   1
   │
   M
order_items
   M
   │
   1
products

Overall: orders M:N products
```

```sql
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE order_items (
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

The junction table can also contain attributes that describe the relationship itself. `quantity` describes a particular product within a particular order, so it belongs in `order_items`.

## Topic 5: Composite Keys in Junction Tables

A composite key is a key made from multiple columns whose combined values uniquely identify a row.

In a junction table:

```sql
PRIMARY KEY (order_id, product_id)
```

means the same `(order_id, product_id)` pair cannot occur twice.

```text
order_id | product_id
---------+-----------
1        | 4
1        | 7
2        | 4
```

This is useful when the relationship itself is naturally identified by the combination of the two foreign keys.
