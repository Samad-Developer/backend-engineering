# Normalization Fundamentals

## Topic 1: Database Design

**Database design is the process of deciding how data should be
structured into tables, columns, keys, relationships, and constraints so
that the data remains accurate, consistent, maintainable, and efficient
to work with.**

A database does not become well designed simply because the required
data can be stored in it. The structure must represent each fact in an
appropriate place.

A useful design question is:

> What entity does this fact actually belong to?

``` text
Customer email -> customer
Product name   -> product
Order date     -> order
Item quantity  -> relationship between an order and a product
```

Poor design often stores unrelated facts together and repeatedly
duplicates information. Normalization provides a systematic way to
improve such designs.

## Topic 2: Data Redundancy

**Data redundancy is the unnecessary duplication of the same fact in
multiple places within a database.**

Consider:

    order_id customer_name   customer_email   product      price
  ---------- --------------- ---------------- ---------- -------
         101 Ali             ali@gmail.com    Keyboard      5000
         102 Ali             ali@gmail.com    Mouse         2000
         103 Sara            sara@gmail.com   Keyboard      5000
         104 Ali             ali@gmail.com    Monitor      30000

Ali's name and email are facts about the customer, but they are stored
repeatedly in multiple order rows. That is harmful redundancy.

A better structure stores the customer once:

### customers

    id name   email
  ---- ------ ----------------
     1 Ali    ali@gmail.com
     2 Sara   sara@gmail.com

### orders

     id   customer_id
  ----- -------------
    101             1
    102             1
    103             2
    104             1

Not every repeated value is harmful. Repeating `customer_id = 1` across
several orders is legitimate because each occurrence represents a
separate relationship.

## Topic 3: Update Anomaly

**An update anomaly occurs when the same fact is stored in multiple
places and changing that fact requires multiple updates, creating the
possibility of inconsistent data.**

If Ali changes his email but only some duplicated rows are updated:

    order_id customer_name   customer_email
  ---------- --------------- --------------------
         101 Ali             ali.khan@gmail.com
         102 Ali             ali.khan@gmail.com
         104 Ali             ali@gmail.com

The database now contains conflicting versions of the same fact.

With a separate customer table, one authoritative row can be updated:

``` sql
UPDATE customers
SET email = 'ali.khan@gmail.com'
WHERE id = 1;
```

## Topic 4: Insert Anomaly

**An insert anomaly occurs when a table design prevents one valid fact
from being stored unless another unrelated fact is also available.**

If customer information exists only inside an `orders` table, a newly
registered customer who has not ordered anything has no appropriate
place to be stored.

With a separate customer table:

``` sql
INSERT INTO customers (name, email)
VALUES ('Ahmed', 'ahmed@gmail.com');
```

The customer can exist independently of an order.

## Topic 5: Delete Anomaly

**A delete anomaly occurs when deleting one fact unintentionally removes
another independent fact that should have been preserved.**

Suppose Sara has only one order:

    order_id customer_name   customer_email   product
  ---------- --------------- ---------------- ----------
         103 Sara            sara@gmail.com   Keyboard

If this is the only place Sara's customer information exists, deleting
the order also removes the only stored information about Sara.

``` sql
DELETE FROM orders
WHERE order_id = 103;
```

Separating customers from orders prevents the customer fact from being
tied unnecessarily to the existence of an order.

## Topic 6: The Three Data Anomalies

  -----------------------------------------------------------------------
  Anomaly                             Problem
  ----------------------------------- -----------------------------------
  **Update anomaly**                  The same fact must be changed in
                                      multiple places

  **Insert anomaly**                  One fact cannot be stored without
                                      another unrelated fact

  **Delete anomaly**                  Deleting one fact unintentionally
                                      removes another fact
  -----------------------------------------------------------------------

``` text
Poor table design
       ↓
Harmful redundancy
       ↓
Update / Insert / Delete anomalies
```

These anomalies are a major reason normalization exists.

## Topic 7: Normalization

**Normalization is the systematic process of organizing data in a
relational database by decomposing tables according to dependencies
between attributes, with the goal of reducing harmful redundancy and
preventing update, insert, and delete anomalies while preserving correct
relationships between data.**

In practical terms, normalization helps give each fact an appropriate
authoritative place.

Instead of one large structure containing customer, order, and product
facts together, a design may become:

``` text
customers
    |
    +-- orders
          |
          +-- order_items
                 |
                 +-- products
```

For example:

``` text
Customer information -> customers
Order information    -> orders
Product information  -> products
Order-product details -> order_items
```

Normalization does **not** simply mean creating more tables. Tables are
separated because different facts belong to different entities or depend
on different identifiers.

### Example SQL Structure

``` sql
CREATE TABLE customers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    PRIMARY KEY (order_id, product_id)
);
```

## Topic 8: Functional Dependency

**A functional dependency exists when the value of one attribute, or set
of attributes, uniquely determines the value of another attribute.**

It is written:

``` text
A -> B
```

meaning that knowing `A` determines exactly one corresponding `B`.

### customers

    customer_id name   email
  ------------- ------ ----------------
              1 Ali    ali@gmail.com
              2 Sara   sara@gmail.com

Because `customer_id` uniquely identifies the customer:

``` text
customer_id -> name
customer_id -> email
```

Functional dependencies help determine whether attributes actually
belong together in the same table.

For example, if an orders table contains `customer_id` and
`customer_name`, the customer's name is fundamentally determined by the
customer:

``` text
customer_id -> customer_name
```

Therefore, `customer_name` normally belongs in the customer table rather
than being repeated in every order.

## Topic 9: Normal Forms

**A normal form is a defined level of relational database organization
that imposes specific structural requirements intended to reduce
redundancy and undesirable data dependencies.**

The progression commonly begins:

``` text
Unnormalized data
       ↓
      1NF
       ↓
      2NF
       ↓
      3NF
```

  -----------------------------------------------------------------------
  Normal Form                         Main Concern
  ----------------------------------- -----------------------------------
  **1NF**                             Atomic values and elimination of
                                      repeating groups

  **2NF**                             Non-key attributes depend on the
                                      whole candidate key, not only part
                                      of a composite candidate key

  **3NF**                             Elimination of inappropriate
                                      transitive dependencies between
                                      non-key attributes
  -----------------------------------------------------------------------

These rules should be understood through actual table-design problems
rather than memorized in isolation.

## Topic 10: Normalization Does Not Mean Zero Repetition

Normalization does not require every value to appear only once.

### orders

     id   customer_id
  ----- -------------
    101             1
    102             1
    103             1

The repeated `customer_id = 1` is legitimate because each row represents
a different order belonging to the same customer.

The objective is not:

> Never repeat values.

The objective is:

> Avoid harmful redundancy of facts caused by inappropriate database
> structure.

## Topic 11: Denormalization

**Denormalization is the intentional introduction of redundant or
precomputed data into an otherwise normalized database design, usually
to improve read performance or simplify expensive queries, while
accepting additional consistency and maintenance costs.**

Denormalization is different from accidental duplication caused by poor
design.

``` text
Design correctly
      ↓
Normalize
      ↓
Measure performance
      ↓
Denormalize selectively only when justified
```

The trade-off is:

``` text
Potentially faster or simpler reads
                 ↕
More duplication and consistency responsibility
```

The normalized design should generally be understood first before
deciding whether denormalization is appropriate.
