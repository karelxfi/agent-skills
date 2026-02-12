# Blockchain Indexing Patterns & Best Practices

Advanced patterns, performance optimization, and troubleshooting for building production-grade blockchain indexers with Subsquid Pipes SDK.

## Overview

This document consolidates:
- **Common Indexing Patterns** - Factory tracking, multi-event processing, aggregations
- **Performance Optimization** - Throughput benchmarks and optimization techniques
- **Error Handling** - Critical error patterns and solutions
- **Production Best Practices** - Data quality, testing, deployment

## When to Use This Reference

Consult this documentation when you need to:
- Implement specific indexing patterns (factory, multi-event, aggregations)
- Optimize indexer performance
- Troubleshoot common errors
- Debug sync issues or missing data
- Handle edge cases (proxy contracts, shared state)
- Build production-grade indexers

## Common Indexing Patterns

### Basic Patterns

#### 1. Single Contract Event Tracking
- Track specific events from known contract
- Simplest pattern, minimal overhead
- **Use when**: Known address, single event type

#### 2. Multiple Events from Single Contract
- Track multiple event types (Deposit/Withdraw)
- Related events from same contract
- **Use when**: Need to process events differently

### Intermediate Patterns

#### 3. Factory Pattern with Pre-Indexing
- Track dynamically deployed contracts
- Wildcard vs pre-indexed approaches
- **Use when**: Uniswap pools, protocol deployments

#### 4. Parallel Event Decoding (pipeComposite)
- Decode multiple independent event types
- Parallel processing
- **Use when**: Unrelated events, different contracts

#### 5. Event Parameter Filtering (Server-Side)
- Filter by indexed parameters at Portal
- Dramatically reduce bandwidth
- **Use when**: High-volume contracts, known addresses

#### 6. Factory Event Filtering
- Filter factory creation events
- Limit downstream processing
- **Use when**: Only need subset of deployed contracts

### Advanced Patterns

#### 7. Multi-Stage Pipeline with Aggregations
- Filter → Enrich → Aggregate → Persist
- Complex transformations
- **Use when**: Need reusable stages, complex logic

#### 8. Custom Target Implementation
- Write to custom format/storage
- **Use when**: JSON files, S3, custom database

#### 9. Memory Target with Finalized/Unfinalized Tracking
- In-memory storage with rollback handling
- **Use when**: Testing, small datasets, real-time UI

#### 10. RPC Latency Monitoring
- Compare Portal vs RPC performance
- **Use when**: Monitoring infrastructure

## Critical Error Patterns

### 1. Missing range Parameter in evmDecoder

**ERROR**: `TypeError: Cannot read properties of undefined (reading 'from')`

**Cause**: The `range` parameter is **REQUIRED** in `evmDecoder` but was omitted.

```typescript
// WRONG - Missing range
evmDecoder({
  contracts: [CONTRACT_ADDRESS],
  events: { deposit: abi.events.Deposit },
})

// CORRECT - Range included
evmDecoder({
  range: { from: 21_000_000 },  // REQUIRED!
  contracts: [CONTRACT_ADDRESS],
  events: { deposit: abi.events.Deposit },
})
```

### 2. Wrong Data Structure - Iterating Instead of Mapping

**ERROR**: `TypeError: batch.data is not iterable`

**Cause**: Using `for...of` loop on `batch.data` instead of accessing named event arrays.

```typescript
// WRONG - Trying to iterate batch.data
.pipe((batch) => {
  for (const item of batch.data) {  // NOT iterable!
    if (item.event.name === "deposit") { /* ... */ }
  }
})

// CORRECT - Access named arrays and map
.pipe((data) => {
  const deposits = data.deposits.map((d) => ({
    blockNumber: d.block.number,
    txHash: d.rawEvent.transactionHash,
    sender: d.event.sender,
    assets: d.event.assets.toString(),
  }));

  return { deposits };
})
```

### 3. Shared Sync Table Conflict

**SYMPTOM**: Indexer starts from wrong block (e.g., 27M instead of 21M)

**Cause**: Multiple indexers share the same ClickHouse `sync` table.

**Solution**:
```bash
# Option A: Clear sync table before starting
docker exec clickhouse clickhouse-client --password=default \
  --query "TRUNCATE TABLE pipes.sync"

# Option B: Use separate database
CLICKHOUSE_DATABASE=my_unique_db bun run dev
```

**Prevention**: Always verify start block in logs:
```bash
tail -f indexer.log | head -1
# Expected: "Start indexing from [your-block]"
# Wrong: "Resuming from [different-block]"
```

### 4. ClickHouse Format Error

**ERROR**: `Cannot parse input: expected '[' before: '{"blockNumber"...`

**Cause**: Missing format specification in `store.insert()`.

```typescript
// WRONG - Missing format
await store.insert({
  table: "transfers",
  values: data,
})

// CORRECT - With format
await store.insert({
  table: "transfers",
  values: data,
  format: "JSONEachRow",  // REQUIRED!
})
```

### 5. Wrong ClickHouse API

**ERROR**: `TypeError: clickhouse.insertTable is not a function`

**Cause**: Using outdated API from old documentation.

```typescript
// CORRECT - Current API
import { clickhouseTarget } from "@subsquid/pipes/targets/clickhouse";
import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  database: process.env.CLICKHOUSE_DATABASE || "default",
  username: "default",
  password: "default",
});

clickhouseTarget({
  client,
  onStart: async ({ store }) => {
    await store.command({ query: "CREATE TABLE..." });
  },
  onData: async ({ store, data }) => {
    await store.insert({
      table: "transfers",
      values: data,
      format: "JSONEachRow",
    });
  },
})
```

## Performance Optimization

### Throughput Benchmarks

| Pattern | Events/Second | Notes |
|---------|--------------|-------|
| Simple EVM decoder | ~23,000 | Single contract, no transformations |
| EVM with ClickHouse | ~18,000 | Includes database writes |
| EVM with PostgreSQL | ~12,000 | YMMV by database setup |
| pipeComposite (3 decoders) | ~15,000 | Parallel decoding overhead |
| Multi-stage (4 stages) | ~8,000 | Each stage adds overhead |
| Memory target | ~25,000 | No persistence overhead |

### Optimization Techniques

#### 1. Use Parameter Filtering

**Impact**: Reduces bandwidth by 10-100x when targeting specific addresses.

```typescript
// BAD: Fetch all, filter client-side
evmDecoder({
  events: { transfer: commonAbis.erc20.events.Transfer },
}).pipe((data) => {
  return data.transfer.filter(t => t.event.from === TARGET);
})

// GOOD: Filter server-side
evmDecoder({
  events: {
    transfer: {
      event: commonAbis.erc20.events.Transfer,
      params: { from: TARGET },  // Filter at Portal!
    },
  },
})
```

#### 2. Minimize Transformation Stages

**Impact**: Each stage adds 20-40% overhead.

```typescript
// BAD: 4 separate pipes
.pipe(stage1)
.pipe(stage2)
.pipe(stage3)
.pipe(stage4)

// GOOD: Combine into 1-2 stages
.pipe((data) => {
  // Do all transformations here
  return finalTransform(data);
})
```

#### 3. Batch Inserts

**Impact**: 10-100x faster than individual inserts.

```typescript
// BAD: Insert one at a time
for (const transfer of data.transfer) {
  await db.insert(transfers).values(transfer);
}

// GOOD: Batch insert
await store.insert({
  table: "transfers",
  values: data.transfer,
  format: "JSONEachRow",
})
```

#### 4. Use Pre-Indexing for Factory Patterns

**Impact**: Targeted streaming is 5-10x faster than wildcards.

```typescript
// SLOW: Wildcard (but discovers all contracts)
wildcardContracts: [{ address: "*", events: { swap } }]

// FAST: Pre-indexed list (if you know addresses)
contracts: [pool1, pool2, pool3, ...]
```

### Optimization Checklist

- [ ] Use server-side parameter filtering for known addresses
- [ ] Minimize transformation stages (1-2 stages max)
- [ ] Batch database inserts (never one-by-one)
- [ ] Choose appropriate database (ClickHouse vs PostgreSQL)
- [ ] Use pre-indexing for factory patterns when possible
- [ ] Monitor memory usage (keep < 500 MB)
- [ ] Profile with metrics (enable profiling in development)
- [ ] Test with small ranges before full deployment

## Common Issues and Solutions

### Issue 1: Pipeline Not Processing Events

**Symptoms**: No events in database, pipeline runs but no output

**Possible Causes**:
- Wrong block range (events outside specified range)
- Wrong contract address (typo or wrong network)
- Wrong event signature (ABI mismatch)
- Filter too restrictive (no events match)

**Solution**:
```typescript
// 1. Verify contract address and block range
evmDecoder({
  range: { from: 21_230_000, to: 21_235_000 },
  contracts: [USDC_ADDRESS.toLowerCase()], // Ensure lowercase
  events: { transfer: commonAbis.erc20.events.Transfer },
})

// 2. Test without filter first
// 3. Verify ABI matches contract
// 4. Check for proxy contracts
```

### Issue 2: Pipeline Crashes with Out of Memory

**Symptoms**: Process exits with OOM error

**Solution**:
```typescript
// Use database target instead of memory
await stream.pipeTo(clickhouseTarget({ /* config */ }))

// Process in batches
for await (const { data } of stream) {
  await persistBatch(data);
}
```

### Issue 3: Slow Performance

**Symptoms**: Pipeline takes hours for small dataset

**Solution**: Apply optimization techniques from Performance section

### Issue 4: Data Missing After Restart

**Symptoms**: Pipeline restarts from beginning

**Solution**: Implement cursor saving in custom target

### Issue 5: Duplicate Data After Chain Reorganization

**Symptoms**: Duplicate records after reorg

**Solution**: Implement fork handler to handle rollbacks

### Issue 6: Events Not Decoded Correctly

**Symptoms**: Event fields are undefined or wrong values

**Possible Causes**:
- Wrong ABI (event signature mismatch)
- Wrong contract (different ABI version)
- Proxy contract (need implementation ABI)

**Solution**:
```bash
# Regenerate ABI from contract
npx @subsquid/evm-typegen@latest src/contracts \
  0xYourContractAddress \
  --chain-id 1
```

## Pattern Selection Guide

### Single Contract Event Tracking
**Use when**:
- Known contract address
- Single event type
- Simple transformations

### Factory Pattern
**Use when**:
- Dynamically deployed contracts
- Need all historical deployments
- Known contract list

### Parallel Decoding (pipeComposite)
**Use when**:
- Multiple independent event types
- Different contracts
- Want parallel processing

**DON'T use when**:
- Events depend on each other
- Single contract

### Multi-Stage Pipeline
**Use when**:
- Complex transformations
- Multiple data formats needed
- Reusable transformation logic

**DON'T use when**:
- Simple event → database mapping
- Performance critical

### Parameter Filtering
**Use when**:
- Known addresses to track
- High-volume contracts
- Indexed parameters available

**DON'T use when**:
- Need all events anyway
- Non-indexed parameters

### Custom Target
**Use when**:
- Custom data format (JSON, CSV, Parquet)
- Custom storage (S3, GCS, IPFS)
- Custom database not supported

**DON'T use when**:
- ClickHouse (use clickhouseTarget)
- PostgreSQL (use drizzleTarget)

### Memory Target
**Use when**:
- Testing/development
- Small datasets (< 10M records)
- No persistence needed

**DON'T use when**:
- Large datasets
- Need persistence across restarts

## Production Best Practices

### 1. Error Prevention

- Always include `range` in `evmDecoder`
- Always use `.map()` on named event arrays
- Always include `format: "JSONEachRow"` in ClickHouse inserts
- Always convert BigInt to string before JSON serialization
- Always clear sync table when starting new indexer

### 2. Performance Optimization

- Use server-side parameter filtering for high-volume contracts
- Minimize transformation stages (1-2 max)
- Batch database inserts
- Monitor memory usage (< 500 MB)
- Test with small ranges before full deployment

### 3. Data Quality

- Verify data within 30 seconds of starting
- Check for NULL values in critical fields
- Validate addresses, amounts, timestamps
- Monitor row count increasing over time
- Implement fork handler for rollback protection

### 4. Debugging Workflow

1. Check logs for error messages
2. Enable profiling to measure performance
3. Test with small range (100 blocks)
4. Verify data in database with SQL queries
5. Review TROUBLESHOOTING.md for matching pattern

## Database Comparison: ClickHouse vs PostgreSQL

### ClickHouse (Recommended for Analytics)

**Pros**:
- 5-10x faster for analytical queries
- Efficient columnar storage
- Excellent for time-series data
- Better compression (smaller storage)

**Cons**:
- No strong ACID transactions
- Limited UPDATE/DELETE support
- Less familiar for web developers

**Best for**:
- Analytics dashboards
- Historical data analysis
- High-volume event streams
- Aggregation-heavy queries

### PostgreSQL (Recommended for Relational)

**Pros**:
- ACID transactions
- Rich query capabilities (JOINs, subqueries)
- More familiar to developers
- Better tooling ecosystem

**Cons**:
- Slower for large analytical queries
- Higher storage requirements
- More expensive to scale

**Best for**:
- Relational data models
- Transactional workloads
- Complex queries with JOINs
- Web application backends

## Key Pattern Principles

### 1. Start Simple, Scale Smart

```typescript
// Start: Single contract, simple events
evmDecoder({
  range: { from: RECENT_BLOCK },  // Test with recent blocks
  contracts: [CONTRACT],
  events: { transfer: abi.Transfer },
})

// Scale: Add filtering, expand range
evmDecoder({
  range: { from: DEPLOYMENT_BLOCK },  // Full history
  contracts: [CONTRACT],
  events: {
    transfer: {
      event: abi.Transfer,
      params: { from: TARGET_ADDRESSES },  // Filter
    },
  },
})
```

### 2. Test Before Deploying

```bash
# Always test with small range first
range: { from: 21_230_000, to: 21_230_100 }  # 100 blocks

# Then expand
range: { from: 21_230_000, to: 21_235_000 }  # 5,000 blocks

# Finally full history
range: { from: DEPLOYMENT_BLOCK }
```

### 3. Verify Data Immediately

```bash
# Check within 30 seconds of starting
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT COUNT(*) FROM pipes.my_table"

# Should be > 0
# If 0: Check logs, verify contract, check ABI
```

### 4. Handle Edge Cases

```typescript
// Always convert BigInt to string
value: transfer.event.value.toString()

// Always use rawEvent for transaction hash
txHash: transfer.rawEvent.transactionHash

// Always include format in ClickHouse inserts
format: "JSONEachRow"

// Always check for proxy contracts
// Use implementation ABI, not proxy ABI
```

## Detailed Reference Documents

For comprehensive examples and code, refer to these files in the pipes-patterns skill:

1. **EVM_PATTERNS.md** - 9+ validated EVM indexing patterns with complete code examples
2. **TROUBLESHOOTING.md** - Complete error catalog with step-by-step solutions
3. **PERFORMANCE.md** - Detailed throughput benchmarks and profiling guide
4. **DEX_DATA_PIPES_PATTERNS.md** - Production DEX indexing patterns
5. **SOLANA_PATTERNS.md** - Solana-specific patterns and instruction discriminators

Access via:
```bash
cat pipes-sdk/pipes-patterns/references/EVM_PATTERNS.md
```

## Key Takeaways

1. **Start with proven patterns** - Use validated patterns from reference docs
2. **Read error catalog first** - Most errors are documented with solutions
3. **Optimize early** - Use parameter filtering from the start
4. **Test small** - Always test with recent blocks first
5. **Verify immediately** - Check data within 30 seconds
6. **Monitor continuously** - Use profiling and metrics in production

## Related Documentation

- RESEARCH_CHECKLIST.md - Protocol research workflow
- ENVIRONMENT_SETUP.md - Development prerequisites
- DEPLOYMENT_OPTIONS.md - Production deployment strategies
