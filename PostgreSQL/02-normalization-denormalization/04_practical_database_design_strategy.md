# Practical Database Design Strategy

## Topic 1: Choosing an Appropriate Normalized Structure

**Choosing an appropriate relational database structure is the process
of translating real-world requirements into entities, attributes, keys,
relationships, constraints, and tables so that each fact is stored where
it logically belongs and the design preserves data integrity while
supporting application operations.**

Database design should begin with requirements, not SQL syntax.

``` text
Requirements
    ↓
Identify entities
    ↓
Identify attributes
    ↓
Choose primary keys
    ↓
Identify relationships and cardinality
    ↓
Place foreign keys
    ↓
Resolve many-to-many relationships
    ↓
Place relationship-specific attributes
    ↓
Analyze functional dependencies
    ↓
Check 1NF, 2NF, and 3NF
    ↓
Add constraints
    ↓
Test against real application operations
    ↓
Implement the schema
```

The central question is:

> **What does this fact describe, and what uniquely determines it?**

## Topic 2: Start With Requirements

Consider a hospital appointment system:

-   The system stores patients.
-   The system stores doctors.
-   Each doctor belongs to one specialization.
-   One specialization can contain many doctors.
-   A patient can book appointments with many doctors.
-   A doctor can receive appointments from many patients.
-   Each appointment has a date, time, and status.
-   Each specialization has a name and description.

Do not immediately write `CREATE TABLE`. First extract the data model
from these requirements.

## Topic 3: Identify Entities

**An entity is a distinct real-world concept, object, person, event, or
thing about which the system needs to store information.**

The main entities are:

``` text
Patient
Doctor
Specialization
Appointment
```

Candidate tables:

``` text
patients
doctors
specializations
appointments
```

Ask:

> What independent things or business events does the application need
> to remember?

Not every noun needs a table. A concept commonly deserves its own table
when it has its own identity, attributes, relationships, lifecycle, or
must be independently queried or referenced.

## Topic 4: Identify Attributes

**An attribute is a property or characteristic that describes an entity
or relationship.**

For example:

``` text
Patient
├── id
├── name
└── email
```

Therefore:

``` text
patients(id, name, email)
```

A specialization has:

``` text
specializations(id, name, description)
```

A doctor has:

``` text
doctors(id, name, specialization_id)
```

Do not unnecessarily copy `specialization_name` and
`specialization_description` into every doctor row.

For every attribute ask:

> What entity or relationship does this value actually describe?

## Topic 5: Choose Primary Keys

Every important table needs a reliable identifier.

``` text
patients.id
doctors.id
specializations.id
appointments.id
```

``` sql
CREATE TABLE patients (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);
```

The primary key answers:

> Which exact row is this?

## Topic 6: Identify Relationships and Cardinality

For every relationship ask:

``` text
Can one A relate to one B?
Can one A relate to many B records?
Can many A records relate to many B records?
```

The main patterns are:

``` text
One-to-One
One-to-Many
Many-to-Many
```

Hospital relationships:

``` text
One specialization → many doctors
One patient → many appointments
One doctor → many appointments
Patients ↔ doctors → many-to-many through appointments
```

## Topic 7: One-to-Many Relationships

**A one-to-many relationship exists when one row in one table can be
associated with multiple rows in another table, while each row on the
many side references one row on the one side.**

Example:

``` text
specializations 1 ─────< doctors
```

The foreign key normally goes on the **many side**:

``` text
doctors.specialization_id → specializations.id
```

``` sql
CREATE TABLE specializations (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE doctors (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    specialization_id INTEGER NOT NULL
        REFERENCES specializations(id)
);
```

Rule:

> **One-to-many → foreign key normally goes on the many side.**

## Topic 8: One-to-One Relationships

**A one-to-one relationship exists when a row on either side can be
associated with at most one corresponding row on the other side.**

A common implementation uses a foreign key with `UNIQUE`.

``` sql
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE user_profiles (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(id),
    bio TEXT
);
```

The foreign key requires a valid user. `UNIQUE` prevents the same
`user_id` from appearing in multiple profile rows.

## Topic 9: Many-to-Many Relationships

**A many-to-many relationship exists when multiple rows in one table can
relate to multiple rows in another table. In a relational design, it is
represented through an intermediate junction, join, or associative
table.**

In the hospital system:

``` text
patients >─────< doctors
```

A patient can meet many doctors and a doctor can meet many patients.

The relationship becomes:

``` text
patients 1 ─────< appointments >───── 1 doctors
```

The junction table converts one many-to-many relationship into two
one-to-many relationships.

A junction table may have a technical name:

``` text
student_courses
product_tags
user_roles
```

or represent a meaningful business concept:

``` text
appointments
bookings
enrollments
memberships
```

Rule:

> **Many-to-many → introduce an intermediate relationship/junction table
> containing foreign keys to both sides.**

## Topic 10: Relationship-Specific Attributes

Ask:

> Does this value describe one entity, or the relationship/event between
> entities?

An appointment contains:

``` text
patient_id
doctor_id
appointment_date
appointment_time
status
```

Date, time, and status describe the appointment, not the patient or
doctor independently.

  -------------------------------------------------------------------------------------------
             id    patient_id     doctor_id appointment_date   appointment_time   status
  ------------- ------------- ------------- ------------------ ------------------ -----------
              1            10             5 2026-09-05         10:00              booked

              2            10             8 2026-09-07         14:00              completed

              3            20             5 2026-09-08         11:00              booked
  -------------------------------------------------------------------------------------------

Other examples:

``` text
student_courses → grade, enrolled_at
memberships → joined_at, role
bookings → booking_date, status
appointments → date, time, status
```

## Topic 11: Use Functional Dependencies

**A functional dependency exists when one attribute or set of attributes
uniquely determines another attribute.**

For the hospital system:

``` text
patient_id -> patient_name, patient_email

specialization_id -> specialization_name, specialization_description

doctor_id -> doctor_name, specialization_id

appointment_id -> patient_id, doctor_id,
                  appointment_date, appointment_time, status
```

These dependencies help reveal table boundaries.

When uncertain about a column, ask:

> **What uniquely determines this value?**

The answer often tells you which table should own the fact.

## Topic 12: Check 1NF

1NF helps detect repeating groups and fields containing collections of
independent relational values.

Bad:

    doctor_id name   patient_ids
  ----------- ------ -------------
            5 Sara   10, 20, 30

Better:

    appointment_id   patient_id   doctor_id
  ---------------- ------------ -----------
                 1           10           5
                 2           20           5
                 3           30           5

Ask:

> Does any field contain multiple independent values, or are there
> repeating columns/groups?

## Topic 13: Check 2NF

2NF is especially relevant when a table has a composite candidate key.

Bad:

``` text
patient_doctors(
    patient_id,
    doctor_id,
    doctor_name
)
```

Suppose:

``` text
PRIMARY KEY (patient_id, doctor_id)
```

But:

``` text
doctor_id -> doctor_name
```

`doctor_name` depends on only part of the composite key. It belongs in
`doctors`.

Ask:

> If the key contains multiple columns, does every non-key attribute
> belonging here depend on the complete key?

## Topic 14: Check 3NF

Bad:

``` text
doctors(
    id,
    name,
    specialization_id,
    specialization_name
)
```

Dependencies:

``` text
doctor_id -> specialization_id
specialization_id -> specialization_name
```

Therefore:

``` text
doctor_id
    ↓
specialization_id
    ↓
specialization_name
```

The normalized structure is:

``` text
doctors(id, name, specialization_id)
specializations(id, name)
```

Ask:

> Is a non-key attribute being stored here even though it actually
> describes another non-key fact?

## Topic 15: Final Hospital Design

``` text
specializations 1 ─────< doctors

patients 1 ─────< appointments >───── 1 doctors
```

Through `appointments`:

``` text
patients >─────< doctors
         many-to-many
```

``` sql
CREATE TABLE patients (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

CREATE TABLE specializations (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE doctors (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    specialization_id INTEGER NOT NULL
        REFERENCES specializations(id)
);

CREATE TABLE appointments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id INTEGER NOT NULL
        REFERENCES patients(id),
    doctor_id INTEGER NOT NULL
        REFERENCES doctors(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status TEXT NOT NULL
);
```

## Topic 16: Reusable Database Design Strategy

### Step 1 --- Understand the requirements

Write down what the application must store and the operations it must
support. Do not begin with SQL.

### Step 2 --- Identify entities

Ask:

> What independent people, things, concepts, or business events must the
> system remember?

These become candidate tables.

### Step 3 --- Identify attributes

For every entity ask:

> What information actually describes this entity?

### Step 4 --- Choose identifiers

Determine how each important row will be uniquely identified. Choose
primary keys and identify other candidate or unique keys.

### Step 5 --- Identify relationships

For related entities determine:

``` text
One-to-one?
One-to-many?
Many-to-many?
```

### Step 6 --- Place foreign keys

``` text
One-to-many
→ FK normally goes on the many side.

Many-to-many
→ create a junction table with FKs to both sides.

One-to-one
→ commonly use a FK with UNIQUE.
```

### Step 7 --- Find relationship-specific attributes

Ask whether an attribute describes an entity or the relationship/event
between entities.

### Step 8 --- Analyze dependencies

For each attribute ask:

> What uniquely determines this value?

Use the answer to decide which table should own it.

### Step 9 --- Check normalization

``` text
1NF
→ Repeating groups or hidden collections?

2NF
→ With a composite key, does a non-key attribute
  depend on only part of the key?

3NF
→ Does a non-key attribute depend on another
  non-key attribute?
```

### Step 10 --- Add integrity constraints

Consider:

``` text
PRIMARY KEY
FOREIGN KEY
NOT NULL
UNIQUE
CHECK
DEFAULT
```

Constraints protect important data rules.

### Step 11 --- Test the design against real operations

For the hospital example:

``` text
Create a patient
Create a doctor
Assign a specialization
Book an appointment
Change appointment status
Find appointments for a patient
Find appointments for a doctor
```

Verify that the schema supports these operations naturally without
unnecessary duplication.

### Step 12 --- Implement the schema

Only after entities, attributes, keys, relationships, dependencies, and
constraints make sense should the final SQL schema be implemented.

## Topic 17: Database Design Checklist

Before finalizing a relational database, ask:

``` text
1. What real-world concept does each table represent?

2. What uniquely identifies each row?

3. What attributes actually describe each entity?

4. How are the entities related?

5. What is the cardinality of each relationship?

6. Where should each foreign key go?

7. Is there a many-to-many relationship requiring a junction table?

8. Does any attribute describe a relationship rather than an entity?

9. Does any field contain multiple independent values?

10. Does a non-key column depend on only part of a composite key?

11. Does a non-key column depend on another non-key column?

12. Am I unnecessarily storing the same fact in multiple places?

13. What constraints should protect the data?

14. Can the schema support the application's real operations cleanly?
```

The core mental model is:

``` text
Do not ask:
"Which table should I randomly put this column in?"

Ask:
"What fact does this value represent,
and what uniquely determines that fact?"
```

A strong relational database design emerges from answering that question
correctly for every important piece of data.
