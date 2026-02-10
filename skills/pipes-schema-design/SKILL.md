---
name: pipes-schema-design
description: Designs optimal ClickHouse/PostgreSQL schemas for blockchain data with proper data types, indexes, and partitioning strategies.
allowed-tools: [Read, Write]
metadata:
  author: subsquid
  version: "1.0.0"
  category: research
---

# Pipes: Schema Designer

Specialized agent for designing optimal ClickHouse/PostgreSQL schemas for blockchain data.

## When to Use This Skill

Activate when:
- User asks about database schema design
- User wants optimal ClickHouse table structure
- User describes data they want to track
- User mentions "schema", "database", "table", "what data types", or "how to store"
- Receiving event structure from abi-manager agent

## Your Role

Design optimal database schemas for blockchain data by:
1. Analyzing event/instruction structure from abi-manager or user description
2. Choosing optimal data types for ClickHouse/PostgreSQL
3. Selecting appropriate table engine (ClickHouse)
4. Designing indexes for common query patterns
5. Recommending partitioning strategy for large datasets
6. Generating CREATE TABLE statements with explanations
7. Providing transformation hints to indexer-code-writer

## Core Principles

### 1. Blockchain Data Type Mapping

**Always follow these mappings**:

| Solidity Type | ClickHouse Type | Reasoning |
|---------------|-----------------|-----------|
| `uint256`, `int256` | `String` | Avoids overflow, allows .toString() |
| `uint128`, `uint160`, `uint192`, `uint224` | `String` | Too large for native integers |
| `uint64`, `uint96`, `uint112` | `String` | Safer as string (can be large) |
| `uint32` | `UInt32` | Safe as native integer |
| `uint16` | `UInt16` | Safe as native integer |
| `uint8` | `UInt8` | Safe as native integer |
| `int24`, `int32` | `Int32` | Safe as native integer |
| `address` | `FixedString(42)` | Always 42 chars (0x + 40 hex) |
| `bytes32` (tx hash) | `FixedString(66)` | Always 66 chars (0x + 64 hex) |
| `bytes32` (generic) | `String` | Variable length when decoded |
| `bool` | `UInt8` or `Bool` | 0/1 or true/false |
| `timestamp` (block) | `DateTime` or `DateTime64(3)` | Use DateTime64(3) for millisecond precision |

### 2. Table Engine Selection (ClickHouse)

| Use Case | Table Engine | When to Use |
|----------|--------------|-------------|
| **Events with reorgs** | `ReplacingMergeTree` | Default for blockchain data (handles reorgs) |
| **Aggregations** | `SummingMergeTree` | When you need automatic sum aggregation |
| **Unique events only** | `MergeTree` | When reorgs are not a concern |
| **Real-time updates** | `CollapsingMergeTree` | Advanced: For state updates |

**Default recommendation**: `ReplacingMergeTree(block_timestamp)` for blockchain indexing.

### 3. Index Design

**Common index patterns**:

```sql
-- Bloom filter for address lookups (most common)
INDEX addr_idx <address_column> TYPE bloom_filter

-- Set index for filtering
INDEX status_idx <status_column> TYPE set(100)

-- MinMax for range queries (automatic on ORDER BY columns)
-- No explicit INDEX needed - ClickHouse optimizes ORDER BY columns
```

**When to add indexes**:
- Address fields that will be queried frequently
- Enum/status fields with low cardinality
- NOT needed for ORDER BY columns (automatically optimized)

### 4. ORDER BY Design

**Critical for query performance**:

```sql
ORDER BY (col1, col2, col3)
```

**Principles**:
1. First column: Most commonly filtered (e.g., pool_address, token_address)
2. Second column: Time-based (block_number or block_timestamp)
3. Third column: Uniqueness (transaction_hash, log_index)

**Examples**:

```sql
-- For pool-specific queries
ORDER BY (pool_address, block_number, transaction_hash, log_index)

-- For token-specific queries
ORDER BY (token_address, block_number, transaction_hash, log_index)

-- For time-series analysis
ORDER BY (block_number, transaction_hash, log_index)
```

### 5. Partitioning Strategy

**By time** (most common):

```sql
PARTITION BY toYYYYMM(block_timestamp)  -- Monthly partitions
PARTITION BY toYYYYMMDD(block_timestamp)  -- Daily partitions (high volume)
PARTITION BY toYear(block_timestamp)  -- Yearly partitions (low volume)
```

**Guidelines**:
- 100k-1M rows per month → Monthly partitions
- 1M-10M rows per day → Daily partitions
- < 100k rows per month → Yearly partitions or no partitioning

## Workflow

### Step 1: Receive Input

Input can come from:

1. **abi-manager agent**:
   ```typescript
   {
     contract: "Uniswap V3 Pool",
     events: {
       Swap: {
         amount0: { type: "int256", isBigInt: true },
         // ...
       }
     }
   }
   ```

2. **User description**:
   ```
   "I want to track Uniswap V3 swaps with token0, token1, amounts, and price"
   ```

### Step 1.5: ABI Field Coverage Validation (MANDATORY)

**If receiving input from abi-manager**, verify ALL event fields are captured in schema.

For each event parameter in the ABI:
1. Check if corresponding column exists in your schema
2. If excluded, document WHY with comment in schema

**Rule**: Every excluded ABI field MUST have documented justification.

### Step 2: Analyze Requirements

Determine:

1. **What data needs to be stored?**
   - Event parameters
   - Block/transaction metadata
   - Computed fields

2. **How will it be queried?**
   - By pool/token? → Add to ORDER BY first
   - By time range? → Add block_number to ORDER BY
   - By address? → Add bloom filter index

3. **Expected data volume?**
   - < 100k rows → Simple partitioning
   - 100k-1M rows → Monthly partitioning
   - > 1M rows → Daily partitioning

4. **Reorg handling needed?**
   - Yes (almost always) → ReplacingMergeTree
   - No (rare) → MergeTree

### Step 3: Design Schema

Create table structure with:

1. **Standard blockchain columns** (always include):
   ```sql
   block_number UInt32 | UInt64,
   block_timestamp DateTime | DateTime64(3),
   transaction_hash FixedString(66),
   log_index UInt16,
   ```

2. **Event-specific columns**:
   - Map from ABI types using type mapping table
   - Add descriptive comments

3. **Indexes**:
   - Bloom filter for addresses
   - Set index for status/enum fields

4. **Table engine**:
   - Default: ReplacingMergeTree(block_timestamp)

5. **ORDER BY**:
   - Based on expected query patterns

6. **PARTITION BY**:
   - Based on expected volume

### Step 4: Generate CREATE TABLE Statement

Include:
- Complete CREATE TABLE with all columns
- Appropriate data types
- Indexes
- Table engine with parameters
- ORDER BY clause
- PARTITION BY clause
- Detailed comments explaining choices

### Step 5: Provide Transformation Hints

Generate transformation code snippets for indexer-code-writer:

```typescript
{
  transformations: {
    amount0: "s.event.amount0.toString()",  // BigInt → String
    tick: "Number(s.event.tick)",           // int24 → Number (safe)
    pool_address: "s.contract",
  },
  notes: [
    "amount0 is int256, must use .toString() to avoid overflow",
    "tick is int24, safe to convert to Number (max value ~8M)"
  ]
}
```

### Final Step: Self-Consistency Validation (MANDATORY)

**Before finalizing output**, verify documentation matches implementation.

**Validation Checks**:

1. **Table Count Matches Description**:
   - If you say "two tables", count your CREATE TABLE statements
   - If you say "single table", verify only one CREATE TABLE exists

2. **Features Mentioned Exist in Schema**:
   - If you mention "materialized views", verify CREATE MATERIALIZED VIEW exists
   - If you mention "indexes", verify INDEX clauses exist

3. **Column Names Match Description**:
   - Use exact column names from schema in descriptions
   - Don't use different names in text vs SQL

**Error Prevention Rule**:

**NEVER**:
- Say "two tables" when you created one table
- Mention "materialized views" when schema has none
- Describe features that don't exist in the schema
- Use different column names in description vs schema

**ALWAYS**:
- Count your CREATE TABLE statements before describing them
- Verify every feature you mention actually exists
- Use exact column names from your schema in descriptions
- Update documentation if you change the implementation

## Output Format

### To User:

```markdown
##  Schema Design: <Table Name>

**Optimized for**: <primary query patterns>
**Expected volume**: <rows per day/month>
**Reorg handling**: <Yes/No>

### CREATE TABLE Statement:

```sql
-- <Description>
-- Optimized for: <query patterns>

CREATE TABLE <table_name> (
  -- Block data
  block_number UInt32,                    -- Ethereum block number (fits in 4 bytes)
  block_timestamp DateTime,               -- Block timestamp (second precision)

  -- Transaction data
  transaction_hash FixedString(66),       -- ETH tx hash (0x + 64 hex = 66 chars)
  log_index UInt16,                       -- Log position in transaction

  -- Event-specific data
  <column1> <Type>,                       -- <Comment explaining choice>
  <column2> <Type>,                       -- <Comment explaining choice>

  -- Indexes for fast lookups
  INDEX <name>_idx <column> TYPE bloom_filter

) ENGINE = ReplacingMergeTree(block_timestamp)
ORDER BY (<col1>, <col2>, <col3>)
PARTITION BY toYYYYMM(block_timestamp)
```

### Design Decisions:

1. **Data Types**:
   - `<column>`: `<Type>` - <Reasoning>

2. **Table Engine**: `ReplacingMergeTree(block_timestamp)`
   - Automatically handles blockchain reorgs
   - Deduplicates based on ORDER BY columns
   - Uses block_timestamp for version sorting

3. **Indexes**:
   - `<index_name>`: Bloom filter for O(1) average case lookups

4. **ORDER BY**: `(<col1>, <col2>, <col3>)`
   - `<col1>`: Most common filter (enables partition pruning)
   - `<col2>`: Time-based (enables range queries)
   - `<col3>`: Ensures uniqueness (prevents duplicates)

5. **PARTITION BY**: `toYYYYMM(block_timestamp)`
   - Expected <N> rows per month
   - Enables efficient old data deletion
   - Improves query performance via partition pruning

### Transformation Hints:

```typescript
.pipe(({ <events> }) =>
  <events>.map((e) => ({
    // Standard fields
    block_number: e.block.number,
    block_timestamp: new Date(e.timestamp).toISOString().replace('Z', ''),
    transaction_hash: e.rawEvent.transactionHash,
    log_index: e.rawEvent.logIndex,

    // Event-specific fields
    <field1>: e.event.<field1>.toString(),  // BigInt → String
    <field2>: e.event.<field2>,              // Address (already string)
  }))
)
```

### Query Examples:

```sql
-- <Example query 1>
SELECT ...
FROM <table_name>
WHERE <conditions>
```
```

## Common Scenarios

### Scenario 1: ERC20 Transfer Events

**Output**:
```sql
CREATE TABLE erc20_transfers (
  -- Block data
  block_number UInt32,
  block_timestamp DateTime,

  -- Transaction data
  transaction_hash FixedString(66),
  log_index UInt16,

  -- Token identifier
  token_address FixedString(42),          -- Contract address that emitted the event

  -- Transfer data
  from_address FixedString(42),           -- Sender address
  to_address FixedString(42),             -- Recipient address
  value String,                            -- Transfer amount (uint256 as string to avoid overflow)

  -- Indexes for address lookups
  INDEX token_idx token_address TYPE bloom_filter,
  INDEX from_idx from_address TYPE bloom_filter,
  INDEX to_idx to_address TYPE bloom_filter

) ENGINE = ReplacingMergeTree(block_timestamp)
ORDER BY (token_address, block_number, transaction_hash, log_index)
PARTITION BY toYYYYMM(block_timestamp)
```

## Related Skills

- [pipes-abi](../pipes-abi/SKILL.md) - Fetch contract ABIs
- [pipes-validation](../pipes-validation/SKILL.md) - Validate data quality
- [pipes-orchestrator](../pipes-orchestrator/SKILL.md) - Routes to this skill

## Best Practices

1. **Always include standard blockchain columns** (block_number, block_timestamp, transaction_hash, log_index)
2. **Use FixedString for fixed-length data** (addresses, hashes)
3. **Use String for BigInt types** (uint256, uint128, int256)
4. **Default to ReplacingMergeTree** unless there's a specific reason not to
5. **Add bloom filter indexes for address fields** that will be queried
6. **Design ORDER BY based on query patterns**, not arbitrary order
7. **Partition by time** for large datasets (monthly is usually best)
8. **Add detailed comments** explaining each design decision
