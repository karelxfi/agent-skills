# ClickHouse MCP Server Usage Guide

**Date**: 2025-01-29
**Status**: Active and connected
**MCP Server**: `mcp-clickhouse` v0.2.0

---

## Overview

The ClickHouse MCP server provides direct access to ClickHouse queries from Claude Code without needing Docker exec commands or custom scripts.

**Benefits**:
- Read-only by design (safe for production)
- Maintained by ClickHouse team
- Native integration with Claude Code
- No bash/docker dependencies

---

## Configuration

### Installation

```bash
# Install pipx (if not already installed)
brew install pipx

# Install MCP server
pipx install mcp-clickhouse

# Add to Claude Code
claude mcp add -t stdio \
  -e CLICKHOUSE_HOST=localhost \
  -e CLICKHOUSE_PORT=8123 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=default \
  -e CLICKHOUSE_SECURE=false \
  -e CLICKHOUSE_DATABASE=default \
  -- clickhouse /path/to/.local/bin/mcp-clickhouse

# Verify connection
claude mcp list
# Should show: clickhouse: /path/to/.local/bin/mcp-clickhouse - ✓ Connected
```

### Current Configuration

```json
{
  "host": "localhost",
  "port": 8123,
  "user": "default",
  "password": "default",
  "database": "default",
  "secure": false
}
```

---

## Available Tools

### 1. `run_select_query`
Execute SELECT queries on ClickHouse (read-only)

**Parameters**:
- `query` (string): SQL SELECT query to execute

**Example**:
```typescript
// Query Test 1 data
run_select_query({
  query: "SELECT COUNT(*) as total FROM default.test1_transfers"
})
```

### 2. `list_databases`
List all available databases

**Parameters**: None

**Example**:
```typescript
list_databases()
// Returns: ["default", "system", "pipes", ...]
```

### 3. `list_tables`
List all tables in a database

**Parameters**:
- `database` (string): Database name (optional, defaults to "default")

**Example**:
```typescript
list_tables({ database: "default" })
// Returns: ["test1_transfers", ...]
```

---

## Common Query Patterns

### Pattern 1: Explore Test 1 Data

```sql
-- Get row count
SELECT COUNT(*) as total_transfers
FROM default.test1_transfers

-- Get date range
SELECT
  MIN(block_number) as first_block,
  MAX(block_number) as last_block,
  MIN(block_timestamp) as first_time,
  MAX(block_timestamp) as last_time
FROM default.test1_transfers

-- Top 10 recipients by transfer count
SELECT
  to_address,
  COUNT(*) as transfer_count,
  SUM(toFloat64(value)) as total_value
FROM default.test1_transfers
GROUP BY to_address
ORDER BY transfer_count DESC
LIMIT 10
```

### Pattern 2: Validate Indexed Data

```sql
-- Check for gaps in block sequence
SELECT
  block_number,
  block_number - lag(block_number) OVER (ORDER BY block_number) as gap
FROM (
  SELECT DISTINCT block_number
  FROM default.test1_transfers
  ORDER BY block_number
)
WHERE gap > 1

-- Verify data types
SELECT
  toTypeName(block_number) as block_number_type,
  toTypeName(value) as value_type,
  toTypeName(block_timestamp) as timestamp_type
FROM default.test1_transfers
LIMIT 1

-- Check for NULL values
SELECT
  countIf(from_address IS NULL) as null_from,
  countIf(to_address IS NULL) as null_to,
  countIf(value IS NULL) as null_value
FROM default.test1_transfers
```

### Pattern 3: Analyze Table Structure

```sql
-- Table schema
DESCRIBE default.test1_transfers

-- Table size and row count
SELECT
  formatReadableSize(sum(bytes)) as size,
  formatReadableQuantity(sum(rows)) as rows,
  count() as parts
FROM system.parts
WHERE database = 'default'
  AND table = 'test1_transfers'
  AND active

-- Index usage
SELECT
  name,
  type,
  expr
FROM system.columns
WHERE database = 'default'
  AND table = 'test1_transfers'
```

### Pattern 4: Performance Analysis

```sql
-- Query execution stats (recent queries)
SELECT
  query,
  type,
  query_duration_ms,
  read_rows,
  formatReadableSize(read_bytes) as read_size
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query LIKE '%test1_transfers%'
ORDER BY event_time DESC
LIMIT 10
```

---

## Usage in INDEXER_WORKFLOW.md

### Step 7: Verify Data After Sync

After running an indexer, use MCP tools to verify:

```typescript
// 1. Check row count matches expectations
run_select_query({
  query: "SELECT COUNT(*) FROM default.test1_transfers"
})

// 2. Verify block range
run_select_query({
  query: `
    SELECT
      MIN(block_number) as first,
      MAX(block_number) as last
    FROM default.test1_transfers
  `
})

// 3. Spot check data quality
run_select_query({
  query: `
    SELECT *
    FROM default.test1_transfers
    LIMIT 5
  `
})
```

---

## Example: Analyzing Test 1 Results

Test 1 indexed 8,675 USDC transfers on Base (blocks 20,000,000 to 20,001,000).

### Query 1: Top USDC Recipients

```sql
SELECT
  to_address,
  COUNT(*) as transfer_count,
  formatReadableQuantity(SUM(toFloat64(value))) as total_usdc
FROM default.test1_transfers
GROUP BY to_address
ORDER BY transfer_count DESC
LIMIT 10
```

### Query 2: Transfer Volume by Hour

```sql
SELECT
  toStartOfHour(block_timestamp) as hour,
  COUNT(*) as transfers,
  formatReadableQuantity(SUM(toFloat64(value))) as volume
FROM default.test1_transfers
GROUP BY hour
ORDER BY hour
```

### Query 3: Largest Transfers

```sql
SELECT
  block_number,
  from_address,
  to_address,
  formatReadableQuantity(toFloat64(value)) as amount,
  transaction_hash
FROM default.test1_transfers
ORDER BY toFloat64(value) DESC
LIMIT 10
```

---

## Comparison: MCP vs Docker Exec

### Before (using docker exec):

```bash
docker exec clickhouse clickhouse-client --query "
  SELECT COUNT(*) FROM default.test1_transfers
"
```

**Issues**:
- Requires Docker knowledge
- Requires finding correct container name
- String escaping challenges
- No syntax highlighting
- Error messages unclear

### After (using MCP):

```typescript
run_select_query({
  query: "SELECT COUNT(*) FROM default.test1_transfers"
})
```

**Benefits**:
- Direct integration
- Syntax highlighting
- Better error messages
- Type-safe parameters
- Read-only safety

---

## Limitations

### Read-Only

MCP server only supports SELECT queries. For mutations, use:

1. **Schema creation**: Use indexer's `onStart` callback
2. **Data insertion**: Use indexer's `onData` callback
3. **Manual admin**: Use docker exec or ClickHouse client

### No chDB Features Yet

The `run_chdb_select_query` tool is available but not documented here. It allows querying local files (Parquet, CSV) without ClickHouse running.

---

## Troubleshooting

### Connection Failed

```bash
# Check ClickHouse is running
docker ps | grep clickhouse

# Check MCP server is connected
claude mcp list

# Restart Claude Code session to reload MCP servers
# (MCP servers connect on session start)
```

### Query Errors

```sql
-- Wrong: Trying to INSERT (not allowed)
INSERT INTO test1_transfers VALUES (...)
-- Error: Only SELECT queries allowed

-- Right: Use SELECT
SELECT * FROM test1_transfers LIMIT 10
```

### Database Not Found

```typescript
// List available databases first
list_databases()

// Then query correct database
run_select_query({
  query: "SELECT * FROM <database>.<table>"
})
```

---

## Integration with Testing

### In TESTING_PLAN.md

After each test:

1. **Verify row count**:
   ```sql
   SELECT COUNT(*) FROM default.<table_name>
   ```

2. **Validate data quality**:
   ```sql
   SELECT * FROM default.<table_name> LIMIT 10
   ```

3. **Check for errors**:
   ```sql
   SELECT * FROM default.<table_name>
   WHERE <validation_condition>
   ```

### Example: Test 1 Verification

```typescript
// Expected: 8,675 transfers
run_select_query({
  query: "SELECT COUNT(*) as count FROM default.test1_transfers"
})
// Result: {"count": 8675}

// Expected: Blocks 20,000,000 to 20,001,000
run_select_query({
  query: `
    SELECT
      MIN(block_number) as min_block,
      MAX(block_number) as max_block
    FROM default.test1_transfers
  `
})
// Result: {"min_block": 20000000, "max_block": 20000999}
```

---

## Future Enhancements

### Potential MCP Improvements

1. **Write support** (for admin operations)
2. **Query builder** (generate queries from natural language)
3. **Schema introspection** (automatic table discovery)
4. **Performance recommendations** (based on query patterns)

### Schema Designer Integration

When the `schema-designer` agent is created, it should:
- Use `list_tables` to avoid name conflicts
- Use `DESCRIBE` queries to analyze existing schemas
- Recommend indexes based on common query patterns

---

## Related Documentation

- **INDEXER_WORKFLOW.md**: Main workflow (use MCP in Step 7: Verify)
- **AGENT_GAP_ANALYSIS.md**: MCP replaces clickhouse-operator skill
- **TEST_1_REPORT.md**: Example of MCP usage for validation
- **QUICK_REF_EVM.md**: Quick reference for indexer patterns

---

## Quick Reference Card

```typescript
// List all databases
list_databases()

// List tables in default database
list_tables({ database: "default" })

// Query table
run_select_query({
  query: "SELECT * FROM default.test1_transfers LIMIT 10"
})

// Get table schema
run_select_query({
  query: "DESCRIBE default.test1_transfers"
})

// Get table size
run_select_query({
  query: `
    SELECT
      formatReadableSize(sum(bytes)) as size,
      count() as rows
    FROM system.parts
    WHERE table = 'test1_transfers' AND active
  `
})
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-29
**Status**: Ready for use
**MCP Server Version**: mcp-clickhouse 0.2.0
