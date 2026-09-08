# Date, Time, Timestamp, TIMESTAMPTZ, and Interval

## Topic 1: DATE

`DATE` stores a calendar date without a time of day or timezone.

``` sql
birth_date DATE
```

A common ISO 8601 representation is:

``` text
2001-03-16
```

`DATE` is an actual database type, not merely a formatted string.

A current-date default can be useful when the business meaning requires
it:

``` sql
attendance_date DATE NOT NULL DEFAULT CURRENT_DATE
```

Formatting for presentation can be performed with `TO_CHAR`:

``` sql
SELECT TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY');
```

Formatting changes presentation, not the underlying temporal meaning.

## Topic 2: TIME

`TIME` stores a time of day without a calendar date.

``` sql
opening_time TIME NOT NULL
```

Example:

``` text
09:00:00
```

A `TIME` value does not by itself identify Pakistan, London, Dubai, or
any other timezone. It is useful for local recurring wall-clock rules
such as a store opening at 09:00 according to that store's local clock.

``` sql
CREATE TABLE restaurant_hours (
    day_name TEXT,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL
);
```

In a worldwide system, a location may separately have a timezone such as
`Asia/Karachi` or `Europe/London`, while its recurring opening time
remains `09:00`.

## Topic 3: TIMESTAMP

`TIMESTAMP WITHOUT TIME ZONE`, commonly written simply as `TIMESTAMP`,
stores a calendar date and clock time without timezone or global-instant
context.

``` sql
scheduled_local_datetime TIMESTAMP
```

Example:

``` text
2026-09-10 09:00:00
```

It contains both date and time, but the value alone does not tell
whether 09:00 means Pakistan, London, or another location.

Use it when local wall-clock date/time semantics are intentionally
required and timezone resolution is handled separately.

## Topic 4: TIMESTAMPTZ

`TIMESTAMPTZ`, PostgreSQL's `TIMESTAMP WITH TIME ZONE` type, represents
a specific instant in time and displays that instant according to the
current session timezone.

``` sql
created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
```

An instant can have different local representations:

``` text
2026-09-05 17:30:00+05
2026-09-05 12:30:00+00
```

These represent the same moment.

PostgreSQL does not preserve an original timezone name such as
`Asia/Karachi` inside the `TIMESTAMPTZ` value. The session timezone
controls how the instant is displayed.

``` sql
SHOW timezone;

SET TIME ZONE 'Asia/Karachi';
SELECT CURRENT_TIMESTAMP;

SET TIME ZONE 'UTC';
SELECT CURRENT_TIMESTAMP;
```

`CURRENT_TIMESTAMP` itself returns `TIMESTAMPTZ`.

``` sql
SELECT pg_typeof(CURRENT_TIMESTAMP);
```

Typical event columns should generally use `TIMESTAMPTZ` when they
answer the question "When exactly did this happen?"

``` sql
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
paid_at TIMESTAMPTZ
logged_in_at TIMESTAMPTZ
order_placed_at TIMESTAMPTZ
```

The application should store proper temporal values and format them for
the user's timezone at the appropriate presentation boundary rather than
manually adding timezone offsets.

## Topic 5: UTC and Time Zones

UTC, Coordinated Universal Time, is the global reference time standard
used to relate time zones.

Time zones express local clock rules relative to UTC. For example,
Pakistan Standard Time is UTC+5.

Named zones such as these carry location-specific timezone rules:

``` text
Asia/Karachi
Europe/London
America/New_York
```

The core model is:

``` text
UTC = common global reference
time zone = rules for converting an instant to local clock time
TIMESTAMPTZ = representation of an exact instant
```

## Topic 6: INTERVAL

`INTERVAL` is a PostgreSQL temporal data type representing a duration or
span of time rather than a specific date or instant.

``` sql
INTERVAL '30 minutes'
INTERVAL '2 hours'
INTERVAL '7 days'
INTERVAL '3 months'
```

It is commonly used in temporal arithmetic:

``` sql
SELECT CURRENT_TIMESTAMP + INTERVAL '30 days';
SELECT CURRENT_TIMESTAMP - INTERVAL '2 hours';
```

A subscription expiration can be calculated once and stored:

``` sql
CREATE TABLE subscriptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

INSERT INTO subscriptions (user_name, expires_at)
VALUES (
    'Ali',
    CURRENT_TIMESTAMP + INTERVAL '30 days'
);
```

The resulting `expires_at` is a fixed timestamp. It is not recalculated
continuously.

Expiration can then be checked against the moving current time:

``` sql
SELECT *
FROM subscriptions
WHERE expires_at <= CURRENT_TIMESTAMP;
```

An interval column can also have a default when the duration itself is
application data:

``` sql
token_lifetime INTERVAL NOT NULL DEFAULT INTERVAL '30 minutes'
```

Common uses include subscription periods, OTP expiration, password-reset
expiration, free trials, booking durations, and queries for recent
records.

## Topic 7: Practical Temporal Table

``` sql
CREATE TABLE event_test (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_date DATE NOT NULL,
    opening_time TIME NOT NULL,
    local_datetime TIMESTAMP NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration INTERVAL NOT NULL
);

INSERT INTO event_test (
    event_date,
    opening_time,
    local_datetime,
    duration
)
VALUES (
    '2026-09-10',
    '09:00:00',
    '2026-09-10 09:00:00',
    INTERVAL '2 hours'
);
```

Changing the session timezone changes the displayed representation of
`created_at`, but does not change `DATE`, plain `TIME`, plain
`TIMESTAMP`, or the duration itself.

``` sql
SET TIME ZONE 'Asia/Karachi';
SELECT * FROM event_test;

SET TIME ZONE 'UTC';
SELECT * FROM event_test;
```

Temporal arithmetic works directly with intervals:

``` sql
SELECT
    local_datetime,
    duration,
    local_datetime + duration AS ends_at
FROM event_test;
```
