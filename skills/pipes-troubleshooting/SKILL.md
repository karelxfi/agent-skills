---
name: pipes-troubleshooting
description: Diagnoses and fixes runtime errors in blockchain indexers. Handles compilation errors, database issues, Portal API failures, and data quality problems.
allowed-tools: [Read, Edit, Grep, Bash, BashOutput]
metadata:
  author: subsquid
  version: "1.0.0"
  category: core
---

# Pipes: Troubleshooting Diagnostic

Specialized agent for diagnosing and fixing runtime errors in blockchain indexers built with Subsquid Pipes SDK.

## When to Use This Skill

Activate when:
- User reports an error message
- Indexer crashes or stops unexpectedly
- Data is missing or incorrect in database
- TypeScript compilation fails
- Database connection issues
- Portal API errors or timeouts
- User mentions "error", "not working", "broken", "failed", or "bug"

## Important Note

Before diagnosing errors, check if the user followed the mandatory workflow in pipes-workflow skill. Many errors are caused by skipping documentation and not using proper setup procedures.

## Diagnostic Checklist

### 1. Identify Error Type

**Compilation Errors**:
- TypeScript type mismatches
- Missing imports or dependencies
- ABI version conflicts (@subsquid/evm-abi 0.3.1 vs 1.x.x)

**Runtime Errors**:
- Portal API connection failures
- Database connection issues
- Event decoding errors
- Memory issues or OOM
- Cursor corruption

**Data Quality Issues**:
- Missing events
- Incorrect event parameters
- Duplicate records
- Wrong block ranges

### 2. Check Running Processes

If indexer is currently running:
```bash
# Check if process is running
ps aux | grep "bun run dev\|tsx src/index.ts\|node"

# Check output if running in background
# Use BashOutput tool with bash_id
```

### 3. Read Error Context

Always read the relevant files:
- `src/index.ts` - Main pipeline code
- `package.json` - Dependency versions
- `.env` - Connection strings
- Error stack traces from BashOutput

## Common Error Patterns

### Error Pattern 1: ABI Version Mismatch

**Symptoms**:
```
Type 'LogParams' is not assignable to type 'EvmLogParams'
Property 'topics' is missing in type 'LogParams'
```

**Diagnosis**: Wrong `@subsquid/evm-abi` version
**Root Cause**: Using 1.x.x instead of 0.3.1

**Fix**:
```json
// package.json
{
  "dependencies": {
    "@subsquid/evm-abi": "^0.3.1"  // NOT ^1.0.0
  }
}
```

**Steps**:
1. Read package.json
2. Edit to correct version
3. Run `npm install` or `bun install`
4. Verify types resolve

### Error Pattern 2: Portal API Connection Failed

**Symptoms**:
```
Error: connect ECONNREFUSED
Error: Portal request failed with status 429
Error: Portal timeout after 30s
```

**Diagnosis**: Network or rate limit issue

**Fix Options**:
1. **Rate Limiting (429)**: Add delay between requests or reduce block range
2. **Connection Refused**: Check internet connection, verify Portal URL
3. **Timeout**: Increase timeout or reduce batch size

**Code Changes**:
```typescript
// Reduce block range to avoid rate limits
range: {
  from: 21_000_000,
  to: 21_100_000  // Smaller range
}

// Or adjust from block to be more recent
range: { from: 21_000_000 }  // Last few million blocks only
```

### Error Pattern 3: Database Connection Failed

**Symptoms**:
```
Error: connect ECONNREFUSED localhost:5432
Error: ClickHouse authentication failed
Error: Database 'pipes' does not exist
```

**Diagnosis**: Database not running or misconfigured

**Fix Steps**:
1. Check if database is running:
   ```bash
   # PostgreSQL
   docker ps | grep postgres

   # ClickHouse
   docker ps | grep clickhouse
   ```

2. Check connection string in .env:
   ```bash
   cat .env
   ```

3. Start database if needed:
   ```bash
   # ClickHouse
   docker start clickhouse

   # Or start with docker-compose
   docker-compose up -d
   ```

4. Create database if missing:
   ```bash
   # ClickHouse
   docker exec -it clickhouse clickhouse-client --query "CREATE DATABASE IF NOT EXISTS pipes"
   ```

### Error Pattern 4: Event Decoding Failed

**Symptoms**:
```
Error: Cannot decode event with signature '0x...'
TypeError: Cannot read property 'from' of undefined
```

**Diagnosis**: Wrong ABI or contract address

**Fix Steps**:
1. Read src/index.ts to check ABI import
2. Verify contract address is correct
3. Check if using correct event ABI:
   ```typescript
   // Wrong: Using wrong common ABI
   events: {
     swap: commonAbis.erc20.events.Transfer  // Wrong event
   }

   // Correct: Use proper ABI
   events: {
     swap: uniswapV3.events.Swap  // Correct
   }
   ```

4. If custom contract, regenerate ABI:
   ```bash
   npx @subsquid/evm-typegen@latest src/contracts \
     0xYourContractAddress \
     --chain-id 1
   ```

### Error Pattern 5: Missing Data

**Symptoms**:
- Indexer runs successfully but database is empty
- Only partial data is indexed
- Specific events are missing

**Diagnosis**: Filtering issue or wrong start block

**Fix Steps**:
1. Check start block is before events occurred:
   ```typescript
   // Verify on Etherscan when contract was deployed
   range: { from: 'deployment_block' }
   ```

2. Check if contract is a proxy:
   - Proxy contracts emit events from implementation address
   - Need to track implementation, not proxy

3. Verify event names match ABI exactly:
   ```typescript
   // Case-sensitive, must match exactly
   events: {
     transfer: erc20Abi.Transfer  // Correct case
   }
   ```

4. Check for overly restrictive filters:
   ```typescript
   // May be filtering out too many events
   .filter((e) => /* check filter logic */)
   ```

### Error Pattern 6: Memory Issues

**Symptoms**:
```
Error: JavaScript heap out of memory
Process killed (signal 9)
```

**Diagnosis**: Indexer processing too much data at once

**Fix Options**:
1. Reduce block range
2. Reduce number of contracts tracked
3. Process data in smaller batches
4. Increase Node.js memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" bun run dev
   ```

### Error Pattern 7: ClickHouse Schema Issues

**Symptoms**:
```
Error: Table already exists
Error: Column type mismatch
Error: Cannot insert NULL into NOT NULL column
```

**Fix Steps**:
1. Drop and recreate table:
   ```bash
   docker exec clickhouse clickhouse-client --password=default \
     --query "DROP TABLE IF EXISTS pipes.table_name"
   ```

2. Verify schema matches data types:
   - Addresses: String
   - Amounts: Float64 (after dividing by decimals)
   - Block numbers: UInt64
   - Timestamps: DateTime(3)

3. Ensure sync table is cleared for fresh starts:
   ```bash
   docker exec clickhouse clickhouse-client --password=default \
     --query "DROP TABLE IF EXISTS pipes.sync"
   ```

## Diagnostic Workflow

1. **Read error message** - Get exact error text
2. **Identify pattern** - Match to known patterns above
3. **Read relevant files** - Check src/index.ts, package.json, .env
4. **Verify environment** - Check database, network, dependencies
5. **Apply fix** - Edit files or run commands
6. **Test fix** - Restart indexer and verify
7. **Monitor** - Watch logs to confirm resolution

## Prevention Tips

1. **Always use Pipes CLI** - Never manually create files
2. **Follow workflow** - Read pipes-workflow skill first
3. **Start with recent blocks** - Test faster, iterate quicker
4. **Verify setup** - Use pipes-check-setup before starting
5. **Check examples** - Look for similar patterns in existing code

## Related Skills

- [pipes-workflow](../pipes-workflow/SKILL.md) - Prevent errors by following workflow
- [pipes-check-setup](../pipes-check-setup/SKILL.md) - Verify environment
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize slow indexers
- [pipes-validation](../pipes-validation/SKILL.md) - Validate data quality
- [pipes-orchestrator](../pipes-orchestrator/SKILL.md) - Routes to this skill
