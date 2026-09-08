# PostgreSQL Data Type Selection

## Topic 1: INTEGER vs BIGINT

`INTEGER` is appropriate for ordinary bounded whole numbers such as
quantities, stock, and age.

``` sql
stock INTEGER
quantity INTEGER
```

`BIGINT` provides a much larger range and is often useful for
identifiers or counters expected to grow substantially.

``` sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

Choose based on realistic range requirements rather than automatically
using the largest type.

## Topic 2: NUMERIC vs Floating Point

`NUMERIC` provides exact decimal arithmetic, while `REAL` and
`DOUBLE PRECISION` use approximate floating-point arithmetic.

``` sql
price NUMERIC(10,2)
```

Exact financial values commonly use `NUMERIC`. Floating-point types are
appropriate when approximation is acceptable, such as many scientific or
measurement calculations.

## Topic 3: TEXT vs VARCHAR

`TEXT` stores variable-length strings without a declared maximum
character length.

``` sql
name TEXT
```

`VARCHAR(n)` enforces a maximum character length.

``` sql
username VARCHAR(30)
```

Use a length-limited type when the length is a meaningful database rule;
otherwise `TEXT` is often sufficient.

## Topic 4: DATE, TIME, TIMESTAMP, and TIMESTAMPTZ

Use `DATE` when only the calendar date matters.

``` sql
birth_date DATE
```

Use `TIME` for a recurring or local clock time without a date.

``` sql
opening_time TIME
```

Use `TIMESTAMP` for a local date and wall-clock time when
timezone/instant resolution is intentionally separate.

``` sql
scheduled_local_datetime TIMESTAMP
```

Use `TIMESTAMPTZ` for an actual instant in time.

``` sql
created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
```

A useful question is: "Does this value represent an exact moment on the
global timeline?" If yes, `TIMESTAMPTZ` is usually the appropriate
choice.

## Topic 5: UUID vs Numeric Identity

Use numeric identity values when compact sequential identifiers fit the
system.

``` sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

Use UUID when globally unique, independently generated, or
non-sequential identifiers are useful.

``` sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

## Topic 6: JSONB vs Normal Columns

Use normal typed columns for stable, important attributes.

``` sql
name TEXT
email TEXT
price NUMERIC(10,2)
```

Use `JSONB` for genuinely flexible structured data.

``` sql
specifications JSONB
```

## Topic 7: Array vs Relationship Table

Use arrays for small list-like attributes of a record.

``` sql
supported_languages TEXT[]
```

Use foreign keys and junction tables when values represent real entities
or relationships, especially when the relationship needs its own
attributes.

## Topic 8: ENUM vs Table

Use ENUM for a small, stable, predefined set of states.

``` sql
status order_status
```

Use a separate table when values are dynamic business data that users or
administrators may add, rename, remove, or relate to other records.

## Topic 9: Practical Selection Guide

``` text
Whole number                         -> INTEGER / BIGINT
Exact decimal or money               -> NUMERIC
Text                                 -> TEXT / VARCHAR(n)
True or false                        -> BOOLEAN
Calendar date                        -> DATE
Clock time                           -> TIME
Local date + time without an instant -> TIMESTAMP
Exact global instant                 -> TIMESTAMPTZ
Duration                             -> INTERVAL
Globally unique identifier           -> UUID
Flexible structured data             -> JSONB
Small list of same-type values       -> ARRAY
Small stable predefined states       -> ENUM
```
