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

### Note: Sync Table Error on First Run (Harmless)

On the very first start of a new indexer, you will see:
```
[ERROR][@clickhouse/client][Connection] Query: HTTP request error.
Caused by: ClickHouseError: Unknown table expression identifier 'pipes.sync'
```

**This is expected and harmless.** The SDK tries to read the sync table to check for resume state, fails because it doesn't exist yet, then creates it. The indexer will continue normally. Ignore this error on first run.

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

5. Check for sync table conflict (shared database):
   All indexers write to `{database}.sync` with `id = 'stream'`. If another indexer used this database, your indexer resumes from the wrong block.
   ```bash
   docker exec <container> clickhouse-client --password <pw> \
     --query "SELECT * FROM <database>.sync FORMAT Vertical"
   ```
   **Fix**: Use a separate database per indexer, or drop the sync table before starting.

### Error Pattern 5b: Factory Indexer Shows Zero Data

**Symptoms**: Factory-pattern indexer runs, syncs blocks, but database has 0 rows for 30-60+ seconds.

**Diagnosis**: The factory pattern only discovers child contracts from `range.from` forward. If no new child contracts were created in the synced blocks, there's no data yet.

**This is expected**, not a bug.

**Fix**:
- Wait 60-90 seconds — if the factory is active, data will appear
- To track ALL child contracts, set `range.from` to the factory's deployment block
- Check the SQLite file size to confirm contracts are being discovered:
  ```bash
  ls -la <project>/*.sqlite  # size > 0 = contracts found
  ```

### Error Pattern 5c: Timestamps Show 1970 Dates

**Symptoms**: All dates in ClickHouse show as `1970-01-28` or similar

**Diagnosis**: Passing milliseconds instead of seconds to a `DateTime` column

**Fix**: Divide `getTime()` by 1000 in your `.pipe()` transform:
```typescript
// WRONG
timestamp: d.timestamp.getTime(),

// CORRECT
timestamp: Math.floor(d.timestamp.getTime() / 1000),
```

**Note**: The auto-generated `enrichEvents` helper handles this correctly. This only happens with manual `.pipe()` transforms.

**Recovery**: Drop tables + sync, delete SQLite (if factory), restart.

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

### Error Pattern 8: Process Crashed / Indexer Died Mid-Sync

**Symptoms**:
- Terminal shows process exited
- `bun run dev` was killed (OOM, Ctrl+C, machine restart)
- Partial data in database

**Diagnosis**: Normal crash recovery scenario. The sync table tracks progress.

**Fix Steps**:
1. Simply restart — it will resume automatically:
   ```bash
   cd <project-folder>
   bun run dev
   ```

2. Verify the "Resuming from X" log line shows a block near where it crashed. This is the one scenario where "Resuming" is expected and correct.

3. If data looks corrupted, drop sync + data tables and start fresh:
   ```bash
   docker exec <container> clickhouse-client --password <pw> \
     --query "DROP TABLE IF EXISTS pipes.sync; DROP TABLE IF EXISTS pipes.<your_table>"
   ```

### Error Pattern 9: Node.js Version Compatibility Issues

**Symptoms**:
```
ZSTD_error_prefix_unknown
TypeError: terminated (ZstdDecompress)
```
Or random crashes during large syncs.

**Diagnosis**: Using Node.js v25+ which has known zstd decompression bugs

**Fix**:
```bash
# Check version
node --version

# If v25.x, switch to LTS:
# Option 1: nvm
nvm install 22 && nvm use 22

# Option 2: Homebrew (macOS)
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# Option 3: Download from https://nodejs.org/

# Restart indexer
bun run dev
```

**If you can't switch versions**: The zstd bug tends to crash on large syncs (millions of blocks). For quick tests with recent blocks (~100K), v25 often works fine.

**Prevention**: Always use Node.js LTS (v20 or v22) for Pipes SDK projects.

### Error Pattern 10: CLI Crashes on `init` — ora ESM/CJS Error

**Symptoms**:
```
[PIPES SDK] Error: (0 , import_ora.default) is not a function
```

**Diagnosis**: The CLI is bundled as CJS but imports `ora` v6+ which is ESM-only. Only `init` is affected; `--schema` and `--version` work fine.

**Fix**: Patch the CLI bundle to replace ora with a no-op spinner:
```bash
CLI_PATH=$(find ~/.npm/_npx -name "index.cjs" -path "*pipes-cli*" 2>/dev/null | head -1)
sed -i.bak 's/var import_ora = __toESM(require("ora"), 1);/var import_ora = { default: function(opts) { var t = typeof opts === "string" ? opts : (opts \&\& opts.text) || ""; return { start: function(m) { console.log(m || t); return this; }, succeed: function(m) { console.log(m || t); return this; }, fail: function(m) { console.log(m || t); return this; }, stop: function() { return this; }, text: t }; } };/' "$CLI_PATH"
```

Then re-run the `init` command.

**WARNING**: `npx` may silently re-download and overwrite the patch. Always verify before running `init`:
```bash
CLI_PATH=$(find ~/.npm/_npx -name "index.cjs" -path "*pipes-cli*" 2>/dev/null | head -1)
grep -q 'import_ora = { default: function' "$CLI_PATH" && echo "Patched" || echo "Needs patching"
```

## Data Validation & Quality Checks

After an indexer completes successfully, validate the data quality to ensure production readiness.

### Validation Levels

#### Level 1: Schema Validation (CRITICAL)

Verify table structure is correct:

```sql
-- Check table exists
SELECT count() FROM system.tables
WHERE database = '<database>' AND name = '<table_name>'

-- Check column types
DESCRIBE <database>.<table_name>
```

**Checks**:
- Table exists
- All expected columns present
- Column data types match design
- Indexes created
- Table engine correct

#### Level 2: Data Quality (HIGH PRIORITY)

Validate individual data values:

```sql
-- Address format validation
SELECT
  countIf(length(pool_address) != 42) as invalid_length,
  countIf(pool_address NOT LIKE '0x%') as missing_prefix,
  countIf(NOT match(pool_address, '^0x[0-9a-fA-F]{40}$')) as invalid_format
FROM <table_name>

-- Transaction hash format
SELECT
  countIf(length(transaction_hash) != 66) as invalid_length,
  countIf(transaction_hash NOT LIKE '0x%') as missing_prefix
FROM <table_name>

-- BigInt values validation
SELECT
  countIf(amount = '') as empty_amounts,
  countIf(NOT match(amount, '^-?[0-9]+$')) as invalid_numbers
FROM <table_name>

-- NULL checks
SELECT
  countIf(from_address IS NULL) as null_from,
  countIf(to_address IS NULL) as null_to,
  countIf(value IS NULL) as null_value
FROM <table_name>
```

**Checks**:
- Addresses are 42 characters (0x + 40 hex)
- Transaction hashes are 66 characters (0x + 64 hex)
- BigInt values are valid numbers
- No unexpected NULL values
- Block numbers in expected range

#### Level 3: Completeness (MEDIUM PRIORITY)

Ensure no missing data:

```sql
-- Block range coverage
SELECT
  MIN(block_number) as min_block,
  MAX(block_number) as max_block,
  COUNT(DISTINCT block_number) as unique_blocks
FROM <table_name>

-- Check for block gaps
SELECT
  block_number,
  block_number - lag(block_number) OVER (ORDER BY block_number) as gap
FROM (
  SELECT DISTINCT block_number
  FROM <table_name>
  ORDER BY block_number
)
WHERE gap > 1

-- Event count per block
SELECT
  block_number,
  COUNT(*) as event_count
FROM <table_name>
GROUP BY block_number
HAVING event_count > 1000
ORDER BY event_count DESC
LIMIT 10
```

**Checks**:
- Block range matches expected
- No gaps in block sequence
- Event counts are reasonable
- No duplicate events (same tx_hash + log_index)

#### Level 4: Consistency (MEDIUM PRIORITY)

Verify logical relationships:

```sql
-- Block timestamps are monotonic
SELECT
  block_number,
  block_timestamp,
  lag(block_timestamp) OVER (ORDER BY block_number) as prev_timestamp
FROM (
  SELECT DISTINCT block_number, block_timestamp
  FROM <table_name>
  ORDER BY block_number
)
WHERE block_timestamp < prev_timestamp
```

**Checks**:
- Block timestamps increase with block numbers
- Log indexes sequential within transactions

### Common Data Quality Issues

#### Issue 1: NULL Values in Required Fields

**Symptom**: Critical fields contain NULL

**Cause**: Missing `.toString()` on BigInt values

**Fix**:
```typescript
// Wrong
amount: transfer.event.value,

// Correct
amount: transfer.event.value.toString(),
```

#### Issue 2: Invalid Address Formats

**Symptom**: Addresses not 42 characters or missing 0x

**Cause**: Incorrect data extraction or transformation

**Fix**: Validate address format in transformation pipeline

#### Issue 3: Block Gaps

**Symptom**: Missing blocks in sequence

**Cause**: Indexer crashed and didn't resume properly

**Fix**: Clear sync table and restart from affected block

### Validation Checklist

Before declaring success:

- [ ] Table structure matches design
- [ ] No NULL values in required fields
- [ ] All addresses are valid (42 chars, 0x prefix, hex)
- [ ] All transaction hashes valid (66 chars)
- [ ] Block range complete (no gaps)
- [ ] Data count increasing over time
- [ ] Sample transactions match block explorer

## Diagnostic Workflow

1. **Read error message** - Get exact error text
2. **Identify pattern** - Match to known patterns above
3. **Read relevant files** - Check src/index.ts, package.json, .env
4. **Verify environment** - Check database, network, dependencies
5. **Apply fix** - Edit files or run commands
6. **Test fix** - Restart indexer and verify
7. **Validate data** - Run quality checks above
8. **Monitor** - Watch logs to confirm resolution

## Prevention Tips

1. **Always use Pipes CLI** - Never manually create files
2. **Follow workflow** - See pipes-new-indexer for the standard workflow
3. **Start with recent blocks** - Test faster, iterate quicker
4. **Verify setup** - See ENVIRONMENT_SETUP.md before starting
5. **Check patterns** - See PATTERNS.md for common solutions

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create new indexers
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize slow indexers
- [pipes-new-indexer ABI_GUIDE](../pipes-new-indexer/references/ABI_GUIDE.md) - Fetch contract ABIs and handle proxies
- [pipes-new-indexer SCHEMA_GUIDE](../pipes-new-indexer/references/SCHEMA_GUIDE.md) - Design ClickHouse schemas

## Related Documentation

This skill includes comprehensive reference documentation in the `references/` directory:

- **[PATTERNS.md](references/PATTERNS.md)** - Common indexing patterns, performance optimization, error patterns, and best practices

### How to Access

```bash
# Read patterns and best practices
cat pipes-sdk/pipes-troubleshooting/references/PATTERNS.md
```

Or use Claude Code's Read tool:
```
Read: pipes-sdk/pipes-troubleshooting/references/PATTERNS.md
```

### Additional Resources

- [ENVIRONMENT_SETUP.md](../pipes-new-indexer/references/ENVIRONMENT_SETUP.md) - Setup prerequisites
- [RESEARCH_CHECKLIST.md](../pipes-new-indexer/references/RESEARCH_CHECKLIST.md) - Protocol research workflow

### Official Subsquid Documentation
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete troubleshooting and error references
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Comprehensive Pipes SDK guide
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/en/api/catalog/evm/openapi.yaml)** - Portal API specification for debugging EVM issues
- **[Available Datasets](https://portal.sqd.dev/datasets)** - Verify network names and endpoints
