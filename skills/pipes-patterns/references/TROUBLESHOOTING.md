# Error Handling & Troubleshooting

## EVM Decoder Errors (CRITICAL - Read First)

### Error: Missing range Parameter in evmDecoder

```
TypeError: Cannot read properties of undefined (reading 'from')
    at parsePortalRange (/path/to/portal-range.ts:33:13)
    at evmDecoder
```

**Cause**: The `range` parameter is required in `evmDecoder` but was omitted.

**Solution**: Always include the `range` parameter in `evmDecoder`, even if you already specified it in `evmPortalSource`.

```typescript
// Wrong - Missing range in evmDecoder
evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/base-mainnet",
  range: { from: 21_000_000 },  // This alone is not enough!
}).pipe(
  evmDecoder({
    contracts: [CONTRACT_ADDRESS],
    events: { deposit: abi.events.Deposit },
  })
);

// Correct - Range in both places
evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/base-mainnet",
}).pipe(
  evmDecoder({
    range: { from: 21_000_000 },  // Required!
    contracts: [CONTRACT_ADDRESS],
    events: { deposit: abi.events.Deposit },
  })
);
```

**Note**: The `range` in `evmPortalSource` and `evmDecoder` serve different purposes. Always specify range in `evmDecoder`.

---

### Error: Wrong Data Structure - Iterating Instead of Mapping

```
TypeError: batch.data is not iterable
    at Object.transform (/path/to/index.ts:69:30)
```

**Cause**: Using `for...of` loop on `batch.data` instead of accessing named event arrays.

**Solution**: The `evmDecoder` returns data with **named keys** matching your event configuration. Use `.map()` on each named array, not `for...of` on `batch.data`.

```typescript
// Wrong - Trying to iterate batch.data
evmDecoder({
  range: { from: 21_000_000 },
  contracts: [CONTRACT_ADDRESS],
  events: {
    deposit: abi.events.Deposit,     // Key: "deposit"
    withdraw: abi.events.Withdraw,   // Key: "withdraw"
  },
})
.pipe((batch) => {
  for (const item of batch.data) {  // batch.data is NOT iterable!
    if (item.event.name === "deposit") {
      // Process deposit
    }
  }
});

// Correct - Access named arrays and map them
evmDecoder({
  range: { from: 21_000_000 },
  contracts: [CONTRACT_ADDRESS],
  events: {
    deposits: abi.events.Deposit,      // Key: "deposits" (plural)
    withdrawals: abi.events.Withdraw,  // Key: "withdrawals" (plural)
  },
})
.pipe((data) => {  // Note: parameter is 'data', not 'batch'
  // Map deposits array
  const deposits = data.deposits.map((d) => ({
    blockNumber: d.block.number,
    txHash: d.rawEvent.transactionHash,
    sender: d.event.sender,
    assets: d.event.assets.toString(),
  }));

  // Map withdrawals array
  const withdrawals = data.withdrawals.map((w) => ({
    blockNumber: w.block.number,
    txHash: w.rawEvent.transactionHash,
    sender: w.event.sender,
    assets: w.event.assets.toString(),
  }));

  return { deposits, withdrawals };
});
```

**Key Points**:
- Event keys in `evmDecoder` become property names on `data` object
- Each property is an **array** of events
- Use `.map()` to transform each array
- Use descriptive plural names (e.g., `deposits`, not `deposit`) for clarity
- Access `d.rawEvent.transactionHash` for tx hash (not `d.transaction.hash`)

---

## Shared Sync Table Errors (CRITICAL - Read First)

### Error: Indexer Skipping Blocks / Wrong Start Block

**Symptoms**:
- New indexer starts from a much higher block than expected (e.g., starts at 27M instead of 21M)
- Indexer shows "Resuming indexing from X block" with unexpected block number
- Missing data for events that should exist in the block range
- Other indexers are running in the same ClickHouse database

**Example**:
```
{"level":"info","message":"Resuming indexing from 27,976,939 block"}
```
But the deployment block is 21,688,329, meaning blocks 21.6M-27.9M were skipped!

**Cause**: Multiple indexers share the same ClickHouse `sync` table for state persistence. When a new indexer starts, it reads the latest block position from the shared `sync` table, which may belong to a different indexer.

**Why This Happens**:
1. All Subsquid Pipes indexers in the same ClickHouse database use a shared `sync` table
2. The `sync` table stores the current block position for resuming indexing
3. When you start a new indexer, it reads from the shared `sync` table
4. If other indexers are running or have run recently, the new indexer picks up their block position
5. This causes the new indexer to skip blocks and miss data

**Solution**: Clear the `sync` table immediately before starting a new indexer.

```bash
# Option 1: Truncate sync table then start indexer atomically
node -e "
const { createClient } = require('@clickhouse/client');
const client = createClient({
  url: 'http://localhost:8123',
  database: 'pipes',
  username: 'default',
  password: 'default',
});

(async () => {
  console.log('Truncating sync table...');
  await client.command({
    query: 'TRUNCATE TABLE sync',
  });
  console.log('Sync table truncated - restarting indexer immediately...');
})();
" && bun run dev

# Option 2: Use a separate ClickHouse database per indexer
# In .env file:
CLICKHOUSE_DATABASE=uniswap_v4  # Instead of 'pipes'
```

**Prevention**: When running multiple indexers simultaneously:

**Option A: Use Separate Databases** (Recommended)
```typescript
// FILE: .env
CLICKHOUSE_DATABASE=uniswap_v4_swaps  // Unique database per indexer
```

**Option B: Kill Other Indexers Before Starting New One**
```bash
# Kill all other background indexers
# Then truncate sync table
# Then start your new indexer
```

**Verification**: After starting your indexer, verify it started from the correct block:

```bash
# Check the logs - should show "Start indexing from X block" (not "Resuming")
# where X is your deployment block

# Verify sync table state
node -e "
const { createClient } = require('@clickhouse/client');
const client = createClient({
  url: 'http://localhost:8123',
  database: 'pipes',
  username: 'default',
  password: 'default',
});

(async () => {
  const result = await client.query({
    query: 'SELECT * FROM sync ORDER BY timestamp DESC LIMIT 5',
    format: 'JSONEachRow',
  });
  const data = await result.json();
  console.log(JSON.stringify(data, null, 2));
})();
"
```

**Real-World Example**:

In the Uniswap V4 indexer case:
- Deployment block: 21,688,329
- Swap events exist around block 24,300,000
- Indexer started from block 27,976,939 (from other indexers' state)
- Result: **Skipped 6.2M blocks and missed all swap data!**

After clearing sync table:
- Indexer correctly started from block 21,688,329
- Successfully captured 2M+ swap events that would have been missed

**Key Takeaway**: **ALWAYS** verify the starting block when launching a new indexer, especially if other indexers have run in the same database. The sync table conflict is a silent error that causes data loss without throwing exceptions.

---

## ClickHouse Target Errors (CRITICAL - Read First)

### Error: Wrong Export Name for ClickHouse Target

```
SyntaxError: The requested module '@subsquid/pipes/targets/clickhouse' does not provide an export named 'createClickHouseTarget'
```

**Cause**: Using incorrect export name from older documentation.

**Solution**: The correct export is `clickhouseTarget` (not `createClickHouseTarget`).

```typescript
// Wrong
import { createClickHouseTarget } from "@subsquid/pipes/targets/clickhouse";

// Correct
import { clickhouseTarget } from "@subsquid/pipes/targets/clickhouse";
```

---

### Error: Wrong Method - .run() Doesn't Exist

```
TypeError: evmPortalSource(...).pipe(...).pipe(...).run is not a function
```

**Cause**: Using `.run()` method which doesn't exist in current API.

**Solution**: Use `.pipeTo()` instead of `.run()` to connect the pipeline to a target.

```typescript
// Wrong
evmPortalSource({...})
  .pipe(evmDecoder({...}))
  .pipe((data) => { /* transform */ })
  .run(clickhouseTarget({...}));

// Correct
evmPortalSource({...})
  .pipe(evmDecoder({...}))
  .pipe((data) => { /* transform */ })
  .pipeTo(clickhouseTarget({...}));
```

---

### Error: Wrong ClickHouse Client Import

```
SyntaxError: The requested module '@clickhouse/client' does not provide an export named 'createClickHouseClient'
```

**Cause**: Using incorrect function name from the @clickhouse/client package.

**Solution**: Use `createClient` instead of `createClickHouseClient`.

```typescript
// Wrong
import { createClickHouseClient } from "@clickhouse/client";

// Correct
import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  database: process.env.CLICKHOUSE_DATABASE || "default",
  username: "default",
  password: "default",
});
```

---

### Error: ClickHouse Authentication Failed

```
ClickHouseError: default: Authentication failed: password is incorrect, or there is no user with such name.
```

**Cause**: ClickHouse client created without credentials, or wrong credentials.

**Solution**: Always include username and password in the client configuration.

```typescript
// Wrong - Missing credentials
const client = createClient({
  url: "http://localhost:8123",
  database: "default",
});

// Correct - With credentials
const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  database: process.env.CLICKHOUSE_DATABASE || "default",
  username: "default",
  password: "default",
});
```

**Check your ClickHouse container credentials**:
```bash
docker inspect <container-name> | grep -A 5 "Env" | grep CLICKHOUSE_PASSWORD
```

Common password values:
- `"default"`
- `"password"`
- Check your container's environment variables

---

### Error: ClickHouse Format Error

```
ClickHouseError: Cannot parse input: expected '[' before: '{"blockNumber":21401396,...
```

**Cause**: Missing format specification in `store.insert()` call.

**Solution**: Always include `format: "JSONEachRow"` in all `store.insert()` calls.

```typescript
// Wrong - Missing format
await store.insert({
  table: "transfers",
  values: data,
});

// Correct - With format
await store.insert({
  table: "transfers",
  values: data,
  format: "JSONEachRow",
});
```

---

### Error: Old ClickHouse API Pattern

```
TypeError: clickhouse.insertTable is not a function
TypeError: clickhouse.exec is not a function
```

**Cause**: Using outdated ClickHouse target API from old documentation.

**Solution**: Use the correct modern API. The old `connectionParams` + `clickhouse` parameter pattern no longer works. Use `client` + `store` parameter instead.

**Complete correct pattern**:

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
    await store.command({
      query: `
        CREATE TABLE IF NOT EXISTS transfers (
          blockNumber UInt32,
          timestamp UInt32,
          txHash String,
          from String,
          to String,
          value String
        ) ENGINE = MergeTree()
        ORDER BY (blockNumber, txHash)
      `,
    });
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

**Key changes from old API**:
- Create client separately using `createClient` from `@clickhouse/client`
- Pass `client` to `clickhouseTarget` (not `connectionParams`)
- Use `store` parameter (not `clickhouse`)
- Use `store.command()` for SQL commands (not `clickhouse.exec()`)
- Use `store.insert()` with `format: "JSONEachRow"` (not `clickhouse.insertTable()`)
- Always include `username` and `password` in client config

---

## Common Errors and Solutions

### Error 1: "Cannot find module '@subsquid/evm-abi'"

**Cause**: Wrong version specified in package.json

**Solution**:
```json
{
  "dependencies": {
    "@subsquid/evm-abi": "^0.3.1"  // Not ^1.x.x
  }
}
```

**Validated**: Pipeline 19

---

### Error 2: "WebSocket is not defined"

**Cause**: Node.js doesn't have global WebSocket object

**Solution**:
```typescript
// FILE: src/index.ts
// DEPENDENCIES: ws@^8.18.0, @types/ws@^8.18.1

// Add at top of file
import { WebSocket } from "ws";
global.WebSocket = WebSocket as any;

// Add to package.json
{
  "dependencies": {
    "ws": "^8.18.0",
    "@types/ws": "^8.18.1"
  }
}
```

**Validated**: Pipeline 20

---

### Error 3: "TypeError: Cannot convert BigInt to JSON"

**Cause**: BigInt values can't be serialized to JSON

**Solution**:
```typescript
// Bad
JSON.stringify({ value: transfer.event.value });  // BigInt

// Good
JSON.stringify({ value: transfer.event.value.toString() });
```

**Validated**: Pipeline 21, 22

---

### Error 4: "Property 'timestamp' does not exist on type '{ number: number; hash: string }'"

**Cause**: Block object from decoder doesn't include timestamp

**Solution**:
```typescript
// Bad
const timestamp = t.block.timestamp;  // Doesn't exist

// Good: Remove timestamp field or fetch from RPC
type Transfer = {
  blockNumber: number;
  blockHash: string;
  // blockTimestamp: number;  // ← Remove this
};
```

**Validated**: Pipeline 22

---

### Error 5: "Cursor is undefined when saving"

**Cause**: Trying to write undefined cursor to file

**Solution**:
```typescript
// Bad
await fs.writeFile(cursorFile, JSON.stringify(cursor));

// Good
const cursor = batch.ctx.state.rollbackChain[
  batch.ctx.state.rollbackChain.length - 1
];

if (cursor) {  // Null check
  await fs.writeFile(cursorFile, JSON.stringify(cursor));
}
```

**Validated**: Pipeline 21

---

### Error 6: "Metrics inc() expects 1-2 arguments, but got 0"

**Cause**: Wrong metrics API usage

**Solution**:
```typescript
// Bad
ctx.metrics.counter({ name: "total" }).inc();

// Good
ctx.metrics.counter({ name: "total" }).inc(1);
```

**Validated**: Pipeline 19

---

### Error 7: "Cannot find module '@subsquid/pipes/targets/memory'"

**Cause**: createMemoryTarget is not publicly exported

**Solution**:
```typescript
// Bad
import { createMemoryTarget } from "@subsquid/pipes/targets/memory";

// Good: Implement custom memory target
import { createTarget } from "@subsquid/pipes";

function createSimpleMemoryTarget() {
  return createTarget({ /* ... */ });
}
```

**Validated**: Pipeline 22

---

## Debugging Tips

### 1. Enable Logging

```typescript
// FILE: src/index.ts
// DEPENDENCIES: @subsquid/pipes@^5.0.0

import { Logger } from "@subsquid/pipes";

const logger = new Logger("my-pipeline");
logger.setLevel("debug");  // debug | info | warn | error

for await (const { data, ctx } of stream) {
  ctx.logger.debug(`Processing ${data.transfer.length} transfers`);
}
```

### 2. Use Profiling

```typescript
evmPortalSource({
  portal,
  profiling: {
    enabled: true,
  },
})
```

**Outputs**:
- Time per batch
- Events per second
- Memory usage
- Network latency

### 3. Test with Small Ranges

```typescript
// Start with 100 blocks
range: { from: 21_230_000, to: 21_230_100 }

// Then expand
range: { from: 21_230_000, to: 21_235_000 }  // 5,000 blocks
```

### 4. Verify Data with Queries

**ClickHouse**:
```sql
SELECT COUNT(*) FROM transfers;
SELECT MIN(block_number), MAX(block_number) FROM transfers;
SELECT SUM(value) FROM transfers;
```

**PostgreSQL**:
```sql
SELECT COUNT(*) FROM transfers;
SELECT block_number, COUNT(*) FROM transfers GROUP BY block_number ORDER BY block_number;
```

## Debugging Workflow

When pipeline fails or produces unexpected results:

- **Check logs** for error messages
- **Enable profiling** to measure performance
- **Test with small range** (100 blocks)
- **Verify data in database** with SQL queries
- **Check cursor state** if resuming fails
- **Validate ABI** if events not decoded
- **Test filter logic** if missing events
- **Monitor memory** if pipeline crashes
- **Check network connectivity** if timeout errors
- **Review error stack trace** for root cause

## Common Issues and Resolutions

### Pipeline Not Processing Events

**Symptoms**: No events in database, pipeline runs but no output

**Possible Causes**:
- **Wrong block range** - Events outside specified range
- **Wrong contract address** - Typo or wrong network
- **Wrong event signature** - ABI mismatch
- **Filter too restrictive** - No events match filter

**Resolution**:
```typescript
// Verify contract address and block range
evmDecoder({
  range: { from: 21_230_000, to: 21_235_000 },
  contracts: [USDC_ADDRESS.toLowerCase()], // Ensure lowercase
  events: { transfer: commonAbis.erc20.events.Transfer },
})

// Test without filter first
events: { transfer: commonAbis.erc20.events.Transfer }
```

### Pipeline Crashes with Out of Memory

**Symptoms**: Process exits with OOM error

**Possible Causes**:
- **Memory target with large dataset** - Storing too much in RAM
- **No batch processing** - Loading entire dataset at once
- **Memory leak** - Not releasing resources

**Resolution**:
```typescript
// Use database target instead of memory
await stream.pipeTo(
  clickhouseTarget({ /* config */ })
);

// Process in batches
for await (const { data } of stream) {
  // Process batch
  await persistBatch(data);
}
```

### Slow Performance

**Symptoms**: Pipeline takes hours for small dataset

**Possible Causes**:
- **No server-side filtering** - Fetching unnecessary data
- **Too many transformation stages** - Overhead from pipes
- **Individual database inserts** - Not batching
- **Wrong database configuration** - Missing indexes

**Resolution**: See [Performance Optimization](./PERFORMANCE.md)

### Data Missing After Restart

**Symptoms**: Pipeline restarts from beginning, losing progress

**Possible Causes**:
- **No cursor persistence** - Not saving resume point
- **Cursor file corrupted** - Invalid JSON
- **No resume logic** - Not reading cursor

**Resolution**:
```typescript
// FILE: src/index.ts
// DEPENDENCIES: @subsquid/pipes@^5.0.0

write: async ({ read, logger }) => {
  let resumeCursor: BlockCursor | undefined;
  
  try {
    const cursorData = await fs.readFile("cursor.json", "utf-8");
    resumeCursor = JSON.parse(cursorData);
    logger.info(`Resuming from block ${resumeCursor.number}`);
  } catch {
    logger.info("Starting fresh");
  }
  
  for await (const batch of read(resumeCursor)) {
    // Process data
    
    // Save cursor after each batch
    const cursor = batch.ctx.state.rollbackChain[
      batch.ctx.state.rollbackChain.length - 1
    ];
    if (cursor) {
      await fs.writeFile("cursor.json", JSON.stringify(cursor));
    }
  }
}
```

### Duplicate Data After Chain Reorganization

**Symptoms**: Duplicate records in database after reorg

**Possible Causes**:
- **No fork handler** - Not handling rollbacks
- **Processing unfinalized blocks** - Not checking finalization

**Resolution**:
```typescript
// Implement fork handler
fork: async (previousBlocks) => {
  if (previousBlocks.length === 0) {
    await deleteAllData();
    return null;
  }
  
  const lastCommonBlock = previousBlocks[previousBlocks.length - 1];
  await deleteDataAfter(lastCommonBlock.number);
  return lastCommonBlock;
}

// Only process finalized blocks
const finalizedHeight = batch.ctx.head.finalized?.number ?? Infinity;
const finalized = batch.data.filter(
  (item) => item.blockNumber <= finalizedHeight
);
```

### Events Not Decoded Correctly

**Symptoms**: Event fields are undefined or wrong values

**Possible Causes**:
- **Wrong ABI** - Event signature mismatch
- **Wrong contract** - Different ABI version
- **Proxy contract** - Need implementation ABI

**Resolution**:
```typescript
// Regenerate ABI from contract
npx @subsquid/evm-typegen@latest src/contracts \
  0xYourContractAddress \
  --chain-id 1

// Use generated ABI
import * as myContract from './contracts/MyContract'
events: { myEvent: myContract.events.MyEvent }
```

### Database Connection Errors

**Symptoms**: Connection timeout, connection refused

**Possible Causes**:
- **Wrong connection string** - Typo in URL
- **Database not running** - Docker container stopped
- **Network issue** - Firewall blocking connection
- **Authentication failure** - Wrong credentials

**Resolution**:
```bash
# Check database is running
docker ps | grep clickhouse
docker ps | grep postgres

# Test connection
curl http://localhost:8123  # ClickHouse
psql postgresql://user:pass@localhost:5432/db  # PostgreSQL

# Check environment variables
echo $CLICKHOUSE_URL
echo $DATABASE_URL
```

### TypeScript Compilation Errors

**Symptoms**: tsc errors, type mismatches

**Possible Causes**:
- **Missing @types packages** - No type definitions
- **Wrong package versions** - Incompatible versions
- **Missing imports** - Forgot to import types

**Resolution**:
```bash
# Install missing types
npm install --save-dev @types/node @types/ws

# Check package versions
npm list @subsquid/pipes
npm list @subsquid/evm-abi

# Update packages
npm update @subsquid/pipes
```

## Support Resources

- **Official Documentation**: https://beta.docs.sqd.dev/en/sdk/pipes-sdk/
- **GitHub Issues**: https://github.com/subsquid/squid-sdk/issues
- **Stack Overflow**: Tag `subsquid`
