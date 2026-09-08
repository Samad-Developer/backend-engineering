# Denormalization

## Topic 1: Denormalization

**Denormalization is the intentional introduction of redundant,
duplicated, or precomputed data into an otherwise normalized database
design to improve particular read operations or simplify expensive
queries, while accepting additional storage, consistency, and
maintenance costs.**

The key word is **intentional**. Denormalization is a deliberate design
decision rather than accidental duplication.

## Topic 2: Purpose of Denormalization

Normalized designs can require joins or repeated calculations to
assemble frequently requested information.

The main practical purpose of denormalization is:

> Improve or simplify important read operations by intentionally storing
> selected redundant or precomputed data.

PostgreSQL is designed to perform joins efficiently, so a join alone is
not a reason to denormalize.

``` text
Design correctly
    ↓
Normalize
    ↓
Build and measure
    ↓
Find an actual bottleneck
    ↓
Optimize queries/indexes
    ↓
Denormalize when justified
```

## Topic 3: Precomputed Order Total

An order total can be calculated from `order_items`:

``` sql
SELECT SUM(quantity * unit_price)
FROM order_items
WHERE order_id = 101;
```

A read-heavy application may intentionally store:

``` text
orders.total_amount
```

This avoids repeating the aggregation for every read. However, if an
order item changes, `total_amount` must also remain synchronized.

## Topic 4: Historical Transaction Data

Some values that appear duplicated actually represent different business
facts.

``` text
products.price -> current product price
order_items.unit_price -> price actually charged in that transaction
```

If a product cost 5,000 when purchased and later changes to 6,000, the
historical order should normally continue showing 5,000.

  Fact                           Value
  ---------------------------- -------
  Current product price          6,000
  Price charged on old order     5,000

`order_items.unit_price` is therefore transaction-specific historical
data rather than merely a copy of the current product price.

## Topic 5: Real-World Examples

A social-media system may maintain:

``` text
posts.likes_count
```

instead of counting all related likes every time a post is displayed.

An analytics system may store:

``` text
daily_total_sales
```

instead of aggregating millions of transaction rows whenever a dashboard
loads.

An order system may store:

``` text
orders.total_amount
```

instead of repeatedly calculating the total from all order items.

## Topic 6: Performance Trade-offs

  Potential Benefit             Potential Cost
  ----------------------------- ------------------------------------
  Faster reads                  Additional storage
  Fewer repeated calculations   More complicated writes
  Simpler read queries          Data synchronization is required
  Faster dashboards/reports     Risk of stale or inconsistent data

Denormalization can improve reads, but it makes maintaining correctness
more difficult.

## Topic 7: Data Consistency Problems

Suppose:

``` text
Actual sum of order_items = 12,000
orders.total_amount = 10,000
```

The denormalized value has become stale.

Similarly, duplicated current data can disagree if one copy is updated
and another is not.

Denormalized values therefore require a reliable synchronization
strategy.

## Topic 8: When to Denormalize

Denormalization can be appropriate when there is:

-   A measured read-performance bottleneck.
-   A frequently repeated expensive aggregation.
-   A reporting or analytics workload that benefits from precomputed
    values.
-   A deliberate snapshot or historical-data requirement.
-   A read-heavy workload where the consistency trade-offs are
    understood.

The core principle is:

> Normalize for a logically sound and maintainable data model.
> Denormalize selectively when a specific requirement justifies the
> additional redundancy, synchronization, or maintenance cost.
