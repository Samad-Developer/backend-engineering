# Database + PostgreSQL Roadmap

## Full-Stack Developer → Software Engineer

**Legend**

* ✅ Completed
* 🔴 Must Learn
* 🟡 Learn Later / During Projects
* 🔵 Phase 2 — Advanced PostgreSQL / Engineering

---

# Stage 1 — Relational Database Foundations

## Module 1 — Core Database Concepts

### Database Mental Model

* ✅ Tables
* ✅ Rows
* ✅ Columns
* ✅ Schema
* 🔴 Entity
* 🔴 Attribute
* 🔴 Relationship
* 🔴 Cardinality
* 🔴 Referential integrity

### Keys

* ✅ Primary key
* ✅ Foreign key
* ✅ Candidate key
* ✅ Unique key
* ✅ Composite key
* ✅ Natural key
* ✅ Surrogate key

### Relationships

* ✅ One-to-one
* ✅ One-to-many
* ✅ Many-to-one
* 🔴 Many-to-many
* 🔴 Join table / junction table

---

# Stage 2 — Database Design

## Module 2 — Normalization & Denormalization

### Normalization

* ✅ Why duplicated data is dangerous
* ✅ Update anomalies
* ✅ Insert anomalies
* ✅ Delete anomalies
* ✅ 1NF
* ✅ 2NF
* ✅ 3NF
* 🔴 Functional dependency — basic understanding
* 🔴 Choosing an appropriate normalized structure

### Denormalization

* ✅ Basic denormalization concept
* 🔴 When denormalization is useful
* 🔴 Performance trade-offs
* 🔴 Data consistency problems caused by denormalization

---

# Stage 3 — PostgreSQL Environment

## Module 3 — PostgreSQL Setup & Connection

* ✅ Install PostgreSQL
* ✅ PostgreSQL server
* ✅ `psql`
* ✅ `pg` driver
* ✅ Port `5432`
* ✅ Connection configuration
* ✅ Environment variables
* 🔴 PostgreSQL databases
* 🔴 PostgreSQL schemas
* 🔴 PostgreSQL roles/users
* 🔴 Basic database permissions
* 🔴 `GRANT`
* 🔴 `REVOKE`
* 🔴 Least-privilege concept

---

# Stage 4 — Tables & Data Types

## Module 4 — DDL & PostgreSQL Data Types

### Table Creation

* ✅ `CREATE TABLE`
* ✅ `NOT NULL`
* ✅ `PRIMARY KEY`
* ✅ `DEFAULT`

### Data Types

* ✅ `UUID`
* ✅ `JSONB`
* ✅ `IDENTITY`
* 🔴 `TEXT`
* 🔴 `INTEGER`
* 🔴 `BIGINT`
* 🔴 `BOOLEAN`
* 🔴 `NUMERIC` / `DECIMAL`
* 🔴 `DATE`
* 🔴 `TIMESTAMP`
* 🔴 `TIMESTAMPTZ`
* 🔴 `TIME`
* 🔴 `INTERVAL`
* 🟡 Arrays
* 🟡 PostgreSQL `ENUM`

### Type Selection

* 🔴 Choosing the correct data type
* 🔴 `TIMESTAMP` vs `TIMESTAMPTZ`
* 🔴 `INTEGER` vs `BIGINT`
* 🔴 `NUMERIC` vs floating-point types

---

# Stage 5 — SQL CRUD

## Module 5 — INSERT, SELECT, UPDATE, DELETE

* 🔴 `INSERT`
* 🔴 `SELECT`
* 🔴 `UPDATE`
* 🔴 `DELETE`
* ✅ Parameterized queries
* ✅ `$1`, `$2`
* ✅ SQL injection prevention
* ✅ UPSERT
* 🔴 `RETURNING`

### PostgreSQL Returning Data

* 🔴 `INSERT ... RETURNING`
* 🔴 `UPDATE ... RETURNING`
* 🔴 `DELETE ... RETURNING`

---

# Stage 6 — Querying Data

## Module 6 — Filtering, Sorting & Pagination

### Filtering

* 🔴 `WHERE`
* 🔴 `=`
* 🔴 `>`
* 🔴 `<`
* 🔴 `>=`
* 🔴 `<=`
* 🔴 `!=`
* 🔴 `IN`
* 🔴 `NOT IN`
* 🔴 `BETWEEN`
* 🔴 `LIKE`
* 🔴 `ILIKE`
* 🔴 `IS NULL`
* 🔴 `IS NOT NULL`
* 🔴 `AND`
* 🔴 `OR`
* 🔴 `NOT`
* 🔴 `NULL` behavior

### Sorting

* 🔴 `ORDER BY`
* 🔴 `ASC`
* 🔴 `DESC`

### Pagination

* 🔴 `LIMIT`
* 🔴 `OFFSET`
* 🔴 Offset pagination
* 🔴 Cursor/keyset pagination
* 🔴 Stable pagination ordering

### Useful SQL Expressions

* 🔴 `CASE`
* 🔴 `COALESCE`
* 🔴 Basic string functions
* 🔴 Basic date/time functions

---

# Stage 7 — Relationships & JOINs

## Module 7 — Foreign Keys & JOINs

### Relationships

* 🔴 One-to-one implementation
* 🔴 One-to-many implementation
* 🔴 Many-to-one implementation
* 🔴 Many-to-many implementation
* 🔴 Junction/join tables
* 🔴 Composite keys in join tables

### JOINs

* 🔴 `INNER JOIN`
* 🔴 `LEFT JOIN`
* 🟡 `RIGHT JOIN`
* 🟡 `FULL OUTER JOIN`
* 🟡 Self JOIN
* 🟡 `CROSS JOIN`

### JOIN Concepts

* 🔴 Joining multiple tables
* 🔴 Joining through foreign keys
* 🔴 JOIN + filtering
* 🔴 JOIN + aggregation
* 🔴 Understanding duplicate rows caused by JOINs
* 🔴 Basic JOIN performance considerations

---

# Stage 8 — Aggregation & Grouping

## Module 8 — Aggregate Queries

### Aggregate Functions

* 🔴 `COUNT`
* 🔴 `SUM`
* 🔴 `AVG`
* 🔴 `MIN`
* 🔴 `MAX`

### Grouping

* 🔴 `GROUP BY`
* 🔴 `HAVING`

### Important Patterns

* 🔴 `COUNT(*)`
* 🔴 `COUNT(column)`
* 🔴 `COUNT(DISTINCT column)`
* 🔴 Aggregation with JOINs
* 🔴 Conditional aggregation
* 🔴 `CASE` + aggregation

---

# Stage 9 — Advanced SQL Querying

## Module 9 — Subqueries & CTEs

### Subqueries

* 🔴 What subqueries solve
* 🔴 Scalar subqueries
* 🔴 Subqueries with `IN`
* 🔴 Subqueries with `EXISTS`
* 🔴 Correlated subqueries
* 🔴 `NOT EXISTS`
* 🔴 `IN` vs `EXISTS`

### CTEs

* 🔴 `WITH`
* 🔴 Multiple CTEs
* 🔴 CTE + JOIN
* 🔴 CTE + aggregation
* 🔴 CTE + `INSERT`
* 🔴 CTE + `UPDATE`
* 🔴 CTE + `DELETE`
* 🟡 Recursive CTEs — awareness

---

# Stage 10 — Data Integrity

## Module 10 — Constraints & Referential Integrity

### Constraints

* 🔴 `PRIMARY KEY`
* 🔴 `FOREIGN KEY`
* 🔴 `NOT NULL`
* 🔴 `UNIQUE`
* 🔴 `CHECK`
* 🔴 `DEFAULT`

### Foreign-Key Actions

* 🔴 `ON DELETE CASCADE`
* 🔴 `ON DELETE RESTRICT`
* 🔴 `ON DELETE SET NULL`
* 🔴 `ON UPDATE`

### Advanced Constraints

* 🔴 Composite primary keys
* 🔴 Composite unique constraints
* 🔴 Multi-column constraints
* 🔴 Database-level business rules
* 🔴 Understanding when validation belongs in application code vs database constraints

---

# Stage 11 — Transactions & Concurrency

## Module 11 — Transactions

### Transactions

* 🔴 `BEGIN`
* 🔴 `COMMIT`
* 🔴 `ROLLBACK`
* 🔴 Atomicity
* 🔴 Transaction boundaries
* 🔴 Partial failure
* 🔴 Transaction error handling

### Concurrency

* 🔴 Concurrent requests
* 🔴 Race conditions
* 🔴 Lost updates
* 🔴 Double-booking problem
* 🔴 Inventory race conditions
* 🔴 Isolation levels — practical understanding

### Locking

* 🔴 Row-level locks
* 🔴 `SELECT ... FOR UPDATE`
* 🔴 Lock duration
* 🔴 Lock contention
* 🔴 Deadlocks
* 🔴 Deadlock prevention basics

---

# Stage 12 — Database Performance

## Module 12 — Indexes & Query Optimization

### Index Fundamentals

* 🔴 What an index is
* 🔴 Why indexes improve reads
* 🔴 Index storage cost
* 🔴 Index write cost
* 🔴 When to create indexes
* 🔴 When NOT to create indexes
* 🔴 Over-indexing

### Index Types

* 🔴 B-tree
* 🟡 Hash
* 🟡 GIN
* 🟡 GiST
* 🟡 BRIN

### Practical Indexing

* 🔴 Single-column indexes
* 🔴 Composite indexes
* 🔴 Composite index column order
* 🔴 Indexes for `WHERE`
* 🔴 Indexes for `JOIN`
* 🔴 Indexes for `ORDER BY`
* 🔴 Foreign-key indexes
* 🔴 Unique indexes
* 🔴 Partial indexes
* 🔴 Expression indexes
* 🟡 Covering indexes / `INCLUDE`
* 🟡 Index-only scans

### Query Plans

* 🔴 `EXPLAIN`
* 🔴 `EXPLAIN ANALYZE`
* 🔴 `EXPLAIN (ANALYZE, BUFFERS)`
* 🔴 Sequential scan
* 🔴 Index scan
* 🔴 Bitmap index scan
* 🔴 Bitmap heap scan
* 🔴 Estimated rows vs actual rows
* 🔴 Planning time
* 🔴 Execution time
* 🔴 Basic query-plan interpretation

### Query Optimization

* 🔴 Avoid unnecessary queries
* 🔴 Avoid unnecessary `SELECT *`
* 🔴 Avoid unnecessary JOINs
* 🔴 Avoid unnecessary `DISTINCT`
* 🔴 Avoid unnecessary sorting
* 🔴 Reduce database round trips
* 🔴 N+1 query problem
* 🔴 Batch operations
* 🔴 Measure before/after optimization

---

# Stage 13 — PostgreSQL + Node.js

## Module 13 — `pg` Driver & Database Integration

### PostgreSQL Connection

* 🔴 Installing/configuring `pg`
* 🔴 Creating a connection
* 🔴 Connection pool
* 🔴 `Pool`
* 🔴 Connection reuse
* 🔴 Pool sizing
* 🔴 Connection limits
* 🔴 Connection exhaustion
* 🔴 Connection timeout
* 🔴 Query timeout

### Queries from Node.js

* 🔴 Executing queries
* 🔴 Parameterized queries
* 🔴 Query results
* 🔴 TypeScript typing
* 🔴 PostgreSQL errors
* 🔴 Error handling
* 🔴 Transaction handling from Node.js

### Architecture

* 🔴 HTTP request → controller → service → repository → PostgreSQL
* 🔴 Database connection lifecycle
* 🔴 Centralized database configuration

---

# Stage 14 — Database Application Architecture

## Module 14 — Data Access Layer

### Structure

* 🔴 Repository pattern
* 🔴 Data-access layer
* 🔴 Service layer
* 🔴 Controller responsibilities
* 🔴 Separating SQL from controllers
* 🔴 Reusable database functions

### Error Handling

* 🔴 PostgreSQL error codes
* 🔴 Constraint violation handling
* 🔴 Unique constraint errors
* 🔴 Foreign-key errors
* 🔴 Transaction errors
* 🔴 Mapping DB errors to API errors

### Transactions

* 🔴 Service-level transaction boundaries
* 🔴 Passing a transaction/client through repositories
* 🔴 Rollback on failure

---

# Stage 15 — Database Migrations

## Module 15 — Schema Evolution

### Migration Fundamentals

* 🔴 Why migrations exist
* 🔴 Migration files
* 🔴 Ordered migrations
* 🔴 Running migrations
* 🔴 Tracking migration state

### Schema Changes

* 🔴 Add table
* 🔴 Add column
* 🔴 Remove column
* 🔴 Rename column
* 🔴 Modify column
* 🔴 Add constraint
* 🔴 Remove constraint
* 🔴 Add index
* 🔴 Remove index

### Production Safety

* 🔴 Safe schema changes
* 🔴 Migration ordering
* 🔴 Migration conflicts
* 🔴 Rollback strategies
* 🔴 Backward-compatible migrations
* 🔴 Zero/minimal-downtime migration concepts

---

# Stage 16 — Database Security

## Module 16 — PostgreSQL Security

### Application Security

* 🔴 SQL injection
* 🔴 Parameterized queries
* 🔴 Secrets/environment variables
* 🔴 Secure database credentials
* 🔴 SSL/TLS connection concept

### PostgreSQL Security

* 🔴 Users/roles
* 🔴 `GRANT`
* 🔴 `REVOKE`
* 🔴 Least privilege
* 🔴 Database/schema/table permissions

### Data Protection

* 🔴 Password hashing
* 🔴 Sensitive data handling
* 🔴 Don't store unnecessary sensitive data
* 🔴 Access control

### Row-Level Security

* 🟡 RLS concept
* 🟡 Policies
* 🟡 `USING`
* 🟡 `WITH CHECK`
* 🟡 Multi-tenant data isolation

---

# Stage 17 — Database Views

## Module 17 — Views

* 🔴 What a view is
* 🔴 `CREATE VIEW`
* 🔴 Querying views
* 🔴 Updating/views limitations — basic
* 🔴 When views are useful
* 🟡 Materialized views — awareness
* 🟡 Refreshing materialized views

---

# Stage 18 — Database Testing

## Module 18 — Testing PostgreSQL Applications

### Testing

* 🔴 Test database
* 🔴 Integration testing
* 🔴 Repository testing
* 🔴 Query testing
* 🔴 Transaction testing
* 🔴 Constraint testing
* 🔴 Migration testing

### Test Data

* 🔴 Seed data
* 🔴 Test fixtures
* 🔴 Database cleanup
* 🔴 Test isolation

---

# Stage 19 — Production PostgreSQL

## Module 19 — Operating a Real Database

### Production Basics

* 🔴 Development vs production database
* 🔴 Production connection configuration
* 🔴 Connection limits
* 🔴 Connection pooling
* 🔴 Database logs
* 🔴 Error monitoring
* 🔴 Slow-query monitoring
* 🔴 Database health checks

### Backup & Recovery

* 🔴 Database backups
* 🔴 Restore concept
* 🔴 Backup verification
* 🔴 Disaster recovery basics
* 🟡 Point-in-time recovery — awareness

### Monitoring

* 🔴 `pg_stat_activity`
* 🟡 `pg_stat_statements`
* 🟡 Table/index size monitoring
* 🟡 Lock monitoring
* 🟡 Database resource monitoring

---

# Stage 20 — Full Database Capstone

## BookEasy — Production-Style Database

### Database Design

* 🔴 Users
* 🔴 Venues
* 🔴 Venue slots
* 🔴 Bookings
* 🔴 Relationships
* 🔴 Constraints
* 🔴 Indexes

### Application Features

* 🔴 Authentication data
* 🔴 Authorization
* 🔴 CRUD
* 🔴 Search
* 🔴 Filtering
* 🔴 Pagination
* 🔴 Aggregation
* 🔴 Transactions
* 🔴 Concurrent booking protection
* 🔴 Error handling
* 🔴 Migrations
* 🔴 Database testing
* 🔴 Production configuration

### Final Architecture

```text
Client
   ↓
Next.js Frontend
   ↓
Express API
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
pg Pool
   ↓
PostgreSQL
```

---

# Phase 2 — Advanced PostgreSQL & Software Engineering

## Advanced SQL

* 🔵 Window functions
* 🔵 Advanced `CASE`
* 🔵 Advanced CTEs
* 🔵 Recursive CTEs
* 🔵 Advanced aggregation
* 🔵 `LATERAL` joins
* 🔵 Set operations: `UNION`, `INTERSECT`, `EXCEPT`

## Advanced Performance

* 🔵 Advanced query-plan analysis
* 🔵 Query planner internals
* 🔵 PostgreSQL statistics
* 🔵 `ANALYZE`
* 🔵 Autovacuum
* 🔵 VACUUM
* 🔵 Dead tuples
* 🔵 Table bloat
* 🔵 Index bloat
* 🔵 `pg_stat_statements`
* 🔵 Advanced indexing
* 🔵 Covering indexes
* 🔵 Advanced partial/expression indexes
* 🔵 Partitioning
* 🔵 Partition pruning

## PostgreSQL Internals

* 🔵 MVCC internals
* 🔵 Tuple versions
* 🔵 Transaction IDs
* 🔵 Visibility
* 🔵 WAL
* 🔵 Checkpoints
* 🔵 Shared buffers
* 🔵 `work_mem`
* 🔵 `maintenance_work_mem`
* 🔵 `effective_cache_size`
* 🔵 PostgreSQL storage internals
* 🔵 TOAST

## Advanced Concurrency

* 🔵 Advanced isolation levels
* 🔵 Serializable transactions
* 🔵 Advisory locks
* 🔵 Advanced deadlock analysis
* 🔵 Lock monitoring
* 🔵 Concurrency architecture

## Scaling

* 🔵 Read replicas
* 🔵 Replication
* 🔵 Replication lag
* 🔵 Failover
* 🔵 High availability
* 🔵 Connection pooling at scale
* 🔵 PgBouncer
* 🔵 Horizontal scaling
* 🔵 Sharding
* 🔵 Distributed databases

## Reliability

* 🔵 Point-in-time recovery
* 🔵 Disaster recovery architecture
* 🔵 Backup strategies
* 🔵 Failover strategies
* 🔵 High availability
* 🔵 Database observability

## Advanced PostgreSQL Features

* 🔵 Stored procedures
* 🔵 PL/pgSQL
* 🔵 Advanced triggers
* 🔵 Functions
* 🔵 Materialized views
* 🔵 PostgreSQL extensions
* 🔵 Full-text search
* 🔵 `tsvector`
* 🔵 `tsquery`
* 🔵 GIN search indexes
* 🔵 Advanced JSONB
* 🔵 `pgvector`

---

# Phase 2 — Full-Stack + AI Engineering

## Backend Engineering

* 🔵 Redis
* 🔵 Caching strategies
* 🔵 Cache invalidation
* 🔵 Queues
* 🔵 BullMQ
* 🔵 Message brokers
* 🔵 Background jobs
* 🔵 WebSockets
* 🔵 Real-time systems
* 🔵 Rate limiting
* 🔵 Distributed locking
* 🔵 Idempotency
* 🔵 Event-driven architecture

## Production Engineering

* 🔵 Docker
* 🔵 Linux
* 🔵 CI/CD
* 🔵 Cloud infrastructure
* 🔵 AWS
* 🔵 Logging
* 🔵 Monitoring
* 🔵 Metrics
* 🔵 Tracing
* 🔵 Application observability
* 🔵 Load balancing
* 🔵 Horizontal scaling

## System Design

* 🔵 Scalability
* 🔵 Availability
* 🔵 Reliability
* 🔵 CAP theorem
* 🔵 Consistency models
* 🔵 Distributed systems
* 🔵 Database selection
* 🔵 SQL vs NoSQL
* 🔵 Caching architecture
* 🔵 Queue architecture
* 🔵 Event-driven architecture
* 🔵 Microservices
* 🔵 Monolith architecture
* 🔵 Service boundaries

## AI Engineering

* 🔵 LLM APIs
* 🔵 Prompt engineering
* 🔵 Structured outputs
* 🔵 Function/tool calling
* 🔵 Streaming AI responses
* 🔵 Embeddings
* 🔵 Vector databases
* 🔵 `pgvector`
* 🔵 RAG
* 🔵 Chunking
* 🔵 Retrieval
* 🔵 Reranking
* 🔵 Semantic search
* 🔵 Hybrid search
* 🔵 AI agents
* 🔵 Agent tool use
* 🔵 AI application architecture
* 🔵 AI evaluation
* 🔵 AI observability
* 🔵 AI security
* 🔵 Cost/latency optimization

## Final Career Target

```text
Frontend
   +
Backend
   +
PostgreSQL
   +
APIs
   +
Authentication
   +
Caching
   +
Queues
   +
Cloud/DevOps
   +
System Design
   +
AI Engineering
   ↓
Full-Stack AI Engineer
   ↓
Software Engineer
```
