# EVM Patterns Reference

A comprehensive guide to common patterns and advanced techniques for building Subsquid Pipes SDK pipelines.

##  PRODUCTION PATTERNS

For production-grade, multi-protocol DEX indexing patterns, see:
- **[DEX Data Pipes Patterns](../DEX_DATA_PIPES_PATTERNS.md)** - Advanced patterns from SQDGN's production indexers
  - Multi-protocol decoder architecture
  - Event normalization converters
  - Pool metadata caching
  - ClickHouse materialized views
  - Reference token patterns

## Table of Contents

- [Pattern 1: Single Contract Event Tracking](#pattern-1-single-contract-event-tracking)
- [Pattern 2: Factory Pattern with Pre-Indexing](#pattern-2-factory-pattern-with-pre-indexing)
- [Pattern 3: Parallel Event Decoding (pipeComposite)](#pattern-3-parallel-event-decoding-pipecomposite)
- [Pattern 4: Multi-Stage Pipeline with Aggregations](#pattern-4-multi-stage-pipeline-with-aggregations)
- [Pattern 5: Event Parameter Filtering (Server-Side)](#pattern-5-event-parameter-filtering-server-side)
- [Pattern 5b: Factory Event Filtering](#pattern-5b-factory-event-filtering)
- [Pattern 6: Custom Prometheus Metrics](#pattern-6-custom-prometheus-metrics)
- [Pattern 7: Custom Target Implementation](#pattern-7-custom-target-implementation)
- [Pattern 8: Memory Target with Finalized/Unfinalized Tracking](#pattern-8-memory-target-with-finalizedunfinalized-tracking)
- [Pattern 9: RPC Latency Monitoring](#pattern-9-rpc-latency-monitoring)

---

## Pattern 1: Single Contract Event Tracking

**Use Case**: Track specific events from a known contract address.

**Validated By**: Pipelines 01, 02, 04, 05 (ERC20 transfers, Uniswap swaps)

**Code Example** (from Pipeline 05):

```typescript
// FILE: src/index.ts
// REPLACES: <new file>
// DEPENDENCIES: @subsquid/pipes@^5.0.0, @subsquid/pipes-abi@^1.0.0

import { evmPortalSource, evmDecoder } from "@subsquid/pipes/evm";
import { commonAbis } from "@subsquid/pipes-abi";

// Replace with your contract address
const CONTRACT_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC

// Replace with your block range
const FROM_BLOCK = 21_230_000;
const TO_BLOCK = 21_235_000;

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
}).pipe(
  evmDecoder({
    range: { from: FROM_BLOCK, to: TO_BLOCK },  // REQUIRED in evmDecoder!
    contracts: [CONTRACT_ADDRESS],
    events: {
      transfer: commonAbis.erc20.events.Transfer,  // Key becomes data.transfer
    },
  })
);

// Process events
for await (const { data } of stream) {
  // IMPORTANT: data.transfer is an ARRAY, not data itself!
  for (const transfer of data.transfer) {  // Iterate the named array
    console.log({
      from: transfer.event.from,        // 0x-prefixed address, 42 chars
      to: transfer.event.to,            // 0x-prefixed address, 42 chars
      value: transfer.event.value.toString(), // BigInt as string
      block: transfer.block.number,     // uint32
      tx: transfer.rawEvent.transactionHash, // Use rawEvent, not transaction
    });
  }
}
```

**Critical Pattern Notes**:
- The `range` parameter is **REQUIRED** in `evmDecoder` (not optional)
- Event keys in `events: {}` become properties on the `data` object
- Each property contains an **array** of matching events
- Use `transfer.rawEvent.transactionHash` (NOT `transfer.transaction.hash`)
- Always convert BigInt to string: `.toString()`

**Characteristics**: 
- Simple and straightforward
- Minimal overhead
- Good for getting started

**When to Use**:
- Known contract address
- Single event type
- Simple transformations
- Quick prototyping

**When Not to Use**:
- Factory-deployed contracts (use Pattern 2)
- Multiple unrelated events (use Pattern 3)
- Complex aggregations (use Pattern 4)

---

## Pattern 1b: Multiple Events from Single Contract

**Use Case**: Track multiple event types from the same contract (e.g., Deposit and Withdraw).

**Validated By**: Seamless USDC Vault indexer, Morpho vault indexers

**Code Example**:

```typescript
// FILE: src/index.ts
// REPLACES: <new file>
// DEPENDENCIES: @subsquid/pipes@^5.0.0, @subsquid/evm-abi@^0.3.1

import { evmPortalSource, evmDecoder } from "@subsquid/pipes/evm";
import { clickhouseTarget } from "@subsquid/pipes/targets/clickhouse";
import { createClient } from "@clickhouse/client";
import * as vaultAbi from "./contracts/VaultContract";

const VAULT_ADDRESS = "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738";

// Type definitions for transformed data
type VaultDeposit = {
  blockNumber: number;
  blockHash: string;
  txHash: string;
  sender: string;
  owner: string;
  assets: string;
  shares: string;
};

type VaultWithdrawal = {
  blockNumber: number;
  blockHash: string;
  txHash: string;
  sender: string;
  receiver: string;
  owner: string;
  assets: string;
  shares: string;
};

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  database: process.env.CLICKHOUSE_DATABASE || "pipes",
  username: "default",
  password: "default",
});

await evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/base-mainnet",
})
  .pipe(
    evmDecoder({
      range: { from: 21_000_000 },  // REQUIRED!
      contracts: [VAULT_ADDRESS.toLowerCase()],
      events: {
        // Use plural names for clarity
        deposits: vaultAbi.events.Deposit,
        withdrawals: vaultAbi.events.Withdraw,
      },
    })
  )
  .pipe((data) => {  // Parameter is 'data', not 'batch'
    // data.deposits is an ARRAY - use .map(), not for...of on data
    const deposits: VaultDeposit[] = data.deposits.map((d) => ({
      blockNumber: d.block.number,
      blockHash: d.block.hash,
      txHash: d.rawEvent.transactionHash,  // Use rawEvent!
      sender: d.event.sender,
      owner: d.event.owner,
      assets: d.event.assets.toString(),  // BigInt to string!
      shares: d.event.shares.toString(),
    }));

    // data.withdrawals is an ARRAY - use .map()
    const withdrawals: VaultWithdrawal[] = data.withdrawals.map((w) => ({
      blockNumber: w.block.number,
      blockHash: w.block.hash,
      txHash: w.rawEvent.transactionHash,
      sender: w.event.sender,
      receiver: w.event.receiver,
      owner: w.event.owner,
      assets: w.event.assets.toString(),
      shares: w.event.shares.toString(),
    }));

    return { deposits, withdrawals };
  })
  .pipeTo(
    clickhouseTarget({
      client,
      onStart: async ({ store }) => {
        await store.command({
          query: `
            CREATE TABLE IF NOT EXISTS deposits (
              blockNumber UInt32,
              blockHash String,
              txHash String,
              sender String,
              owner String,
              assets String,
              shares String
            ) ENGINE = MergeTree()
            ORDER BY (blockNumber, txHash)
          `,
        });

        await store.command({
          query: `
            CREATE TABLE IF NOT EXISTS withdrawals (
              blockNumber UInt32,
              blockHash String,
              txHash String,
              sender String,
              receiver String,
              owner String,
              assets String,
              shares String
            ) ENGINE = MergeTree()
            ORDER BY (blockNumber, txHash)
          `,
        });
      },
      onData: async ({ store, data }) => {
        if (data.deposits.length > 0) {
          await store.insert({
            table: "deposits",
            values: data.deposits,
            format: "JSONEachRow",  // REQUIRED!
          });
        }

        if (data.withdrawals.length > 0) {
          await store.insert({
            table: "withdrawals",
            values: data.withdrawals,
            format: "JSONEachRow",
          });
        }
      },
    })
  );
```

**Critical Pattern Notes**:
1. **Event Naming**: Use descriptive plural names (`deposits`, `withdrawals`) to indicate arrays
2. **Data Structure**: The pipe function receives `data` with named properties, each containing an array
3. **Array Mapping**: Use `.map()` on each event array, NOT `for...of` on `data` itself
4. **Transaction Hash**: Access via `rawEvent.transactionHash`, NOT `transaction.hash`
5. **BigInt Conversion**: Always convert BigInt values to strings with `.toString()`
6. **ClickHouse Format**: Always include `format: "JSONEachRow"` in all inserts

**Common Mistakes**:

```typescript
// WRONG - Trying to iterate data directly
.pipe((batch) => {
  for (const item of batch.data) {  // TypeError: not iterable!
    if (item.event.name === "deposit") { /* ... */ }
  }
});

// WRONG - Singular event names confusing
events: {
  deposit: vaultAbi.events.Deposit,  // Confusing - is it singular or array?
  withdraw: vaultAbi.events.Withdraw,
}

// WRONG - Missing range parameter
evmDecoder({
  contracts: [CONTRACT_ADDRESS],  // Missing range!
  events: { /* ... */ },
})

// CORRECT - See example above
```

**When to Use**:
- Multiple event types from same contract
- Related events (deposits/withdrawals, mints/burns)
- Need to process events differently
- Different database tables per event type

**When Not to Use**:
- Single event type (use Pattern 1)
- Completely unrelated events (use Pattern 3)
- Events from different contracts (use Pattern 3)

---

## Pattern 2: Factory Pattern with Pre-Indexing

**Use Case**: Track events from dynamically deployed contracts (e.g., Uniswap pools).

**Validated By**: Pipeline 03 (Uniswap V3 Factory)

**Code Example**:

```typescript
import { evmPortalSource, evmDecoder } from "@subsquid/pipes/evm";
import * as uniswapV3 from "./abi/uniswap-v3";

const FACTORY_ADDRESS = "0x1f98431c8ad98523631ae4a59f267346ea31f984";

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
}).pipe(
  evmDecoder({
    range: { from: 12_369_621, to: 12_374_621 },
    
    // Step 1: Track factory events
    contracts: [FACTORY_ADDRESS],
    events: {
      poolCreated: uniswapV3.factory.events.PoolCreated,
    },
    
    // Step 2: Wildcard for all created pools
    wildcardContracts: [{
      address: "*",  // Match any address
      events: {
        swap: uniswapV3.pool.events.Swap,
        mint: uniswapV3.pool.events.Mint,
        burn: uniswapV3.pool.events.Burn,
      },
    }],
  })
);

// Track discovered pools
const knownPools = new Set<string>();

for await (const { data } of stream) {
  // Process pool creation events
  for (const event of data.poolCreated) {
    const poolAddress = event.event.pool.toLowerCase();
    knownPools.add(poolAddress);
    console.log(`New pool: ${poolAddress}`);
  }
  
  // Process swap events from discovered pools
  for (const swap of data.swap) {
    const poolAddress = swap.rawEvent.address.toLowerCase();
    if (knownPools.has(poolAddress)) {
      console.log(`Swap in pool ${poolAddress}`);
    }
  }
}
```

**With Pre-Indexing** (requires known list, optimized streaming):

```typescript
// Pre-index: Query factory for all historical pools
const { Factory } = await import("./typechain/Factory");
const factory = Factory.connect(provider);
const pools: string[] = [];

// Fetch all PoolCreated events (heavy upfront cost)
const filter = factory.filters.PoolCreated();
const events = await factory.queryFilter(filter, 12_369_621, 12_374_621);
for (const event of events) {
  pools.push(event.args.pool);
}

// Now use specific addresses (optimized streaming)
const stream = evmPortalSource({ portal }).pipe(
  evmDecoder({
    range: { from: 12_369_621, to: 12_374_621 },
    contracts: pools,  // Known addresses - optimized query
    events: {
      swap: uniswapV3.pool.events.Swap,
    },
  })
);
```

**Comparison**:

| Approach | Setup Time | Stream Characteristics | When to Use |
|----------|-----------|----------------------|-------------|
| Wildcard | None | Scans all contracts | Unknown contracts, discovery |
| Pre-index | Upfront fetch | Targeted streaming | Known contract list |

**When to Use**:
- Factory-deployed contracts
- Need all historical deployments
- Contract addresses unknown at start

**When Not to Use**:
- Known contract list (use Pattern 1)
- Single contract (use Pattern 1)

---

## Pattern 3: Parallel Event Decoding (pipeComposite)

**Use Case**: Decode multiple independent event types in parallel.

**Validated By**: Pipeline 13 (pipeComposite)

**Code Example**:

```typescript
import { evmPortalSource, evmDecoder, commonAbis, pipeComposite } from "@subsquid/pipes/evm";

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
}).pipe(
  pipeComposite({
    // Each decoder runs independently
    erc20Transfers: evmDecoder({
      range: { from: 21_230_000, to: 21_235_000 },
      contracts: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"], // USDC
      events: { transfer: commonAbis.erc20.events.Transfer },
    }),
    
    uniswapSwaps: evmDecoder({
      range: { from: 21_230_000, to: 21_235_000 },
      contracts: ["0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"], // USDC/ETH pool
      events: { swap: uniswapV3.events.Swap },
    }),
    
    nftMints: evmDecoder({
      range: { from: 21_230_000, to: 21_235_000 },
      contracts: ["0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"], // BAYC
      events: { transfer: commonAbis.erc721.events.Transfer },
    }),
  })
);

for await (const { data } of stream) {
  // Access each decoder's results by key
  console.log(`ERC20 transfers: ${data.erc20Transfers.transfer.length}`);
  console.log(`Uniswap swaps: ${data.uniswapSwaps.swap.length}`);
  console.log(`NFT mints: ${data.nftMints.transfer.length}`);
}
```

**Characteristics**: 
- Parallel processing of independent decoders
- Lifecycle hooks forwarded to all decoders
- Results merged into single object with named keys

**When to Use**:
- Multiple independent event types
- Different contracts
- Want parallel processing
- Need structured output

**When Not to Use**:
- Events depend on each other (use sequential)
- Single contract (use Pattern 1)

---

## Pattern 4: Multi-Stage Pipeline with Aggregations

**Use Case**: Filter → Enrich → Aggregate → Persist in stages.

**Validated By**: Pipeline 12 (Multi-stage)

**Code Example**:

```typescript
import { evmPortalSource, evmDecoder } from "@subsquid/pipes/evm";
import { clickhouseTarget } from "@subsquid/pipes/targets/clickhouse";

// Stage 1: Decode events
const stream = evmPortalSource({ portal })
  .pipe(evmDecoder({
    range: { from: 21_230_000, to: 21_235_000 },
    contracts: [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS],
    events: { transfer: commonAbis.erc20.events.Transfer },
  }))
  
  // Stage 2: Filter large transfers
  .pipe((data) => {
    const largeTransfers = data.transfer.filter(t => {
      const amount = Number(t.event.value) / 1e6;
      return amount > 1_000_000; // > $1M
    });
    return { transfer: largeTransfers };
  })
  
  // Stage 3: Enrich with metadata
  .pipe((data) => {
    return {
      transfer: data.transfer.map(t => ({
        ...t,
        usdValue: Number(t.event.value) / 1e6,
        isWhale: Number(t.event.value) > 10_000_000 * 1e6,
      })),
    };
  })
  
  // Stage 4: Aggregate by block
  .pipe((data) => {
    const byBlock = new Map<number, { count: number; volume: number }>();
    
    for (const t of data.transfer) {
      const blockNum = t.block.number;
      const existing = byBlock.get(blockNum) || { count: 0, volume: 0 };
      byBlock.set(blockNum, {
        count: existing.count + 1,
        volume: existing.volume + t.usdValue,
      });
    }
    
    return Array.from(byBlock.entries()).map(([block, stats]) => ({
      block,
      ...stats,
    }));
  });

// Stage 5: Persist to ClickHouse
await stream.pipeTo(
  clickhouseTarget({
    connectionParams: { url: "http://localhost:8123", database: "default" },
    onData: async ({ clickhouse, data }) => {
      await clickhouse.insertTable({
        tableName: "whale_transfers_by_block",
        values: data,
      });
    },
  })
);
```

**Trade-offs**:
- Each stage adds processing overhead
- Benefits: Complex logic, reusable stages, testability
- Consider impact vs direct write for your use case

**When to Use**:
- Complex transformations
- Multiple data formats needed
- Reusable transformation logic
- Need to test stages independently

**When Not to Use**:
- Simple event → database mapping (use Pattern 1)
- Performance critical (minimize stages)

---

## Pattern 5: Event Parameter Filtering (Server-Side)

**Use Case**: Filter events by indexed parameters at the Portal API level before downloading.

**Status**: Available (January 2025 - Latest SDK)

**Validated By**: SDK examples 09.filtering-by-event-params.example.ts, 10.factory-event-filtering.ts

**Code Example** (Updated API):

```typescript
import { evmPortalSource, evmDecoder, commonAbis } from "@subsquid/pipes/evm";

// Track USDC transfers only to/from Binance hot wallet
const BINANCE_HOT_WALLET = "0x28c6c06298d514db089934071355e5743bf21d60";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet"
}).pipe(
  evmDecoder({
    range: { from: '21230000', to: '21235000' },
    contracts: [USDC_ADDRESS],
    events: {
      // Option 1: Single parameter value
      transfersFrom: {
        event: commonAbis.erc20.events.Transfer,
        params: {
          from: BINANCE_HOT_WALLET,  // Only transfers FROM Binance
        },
      },

      // Option 2: Multiple parameter values (OR logic)
      transfersTo: {
        event: commonAbis.erc20.events.Transfer,
        params: {
          to: [
            BINANCE_HOT_WALLET,
            "0x503828976d22510aad0201ac7ec88293211d23da",  // Coinbase
          ],
        },
      },
    },
  })
);

// Alternative: Filter both directions client-side
const stream2 = evmPortalSource({ portal }).pipe(
  evmDecoder({
    range: { from: 21_230_000, to: 21_235_000 },
    contracts: [USDC_ADDRESS],
    events: {
      transfer: {
        abi: commonAbis.erc20.events.Transfer,
        filter: {
          // Fetch both directions
          from: [BINANCE_HOT_WALLET],
          to: [BINANCE_HOT_WALLET],
        },
      },
    },
  })
);
```

**Performance Impact**:

**Example**: In a USDC transfer scenario with 84,248 total events:

| Filter Type | Effect |
|-------------|--------|
| No filter | Fetches all events |
| Single address filter | Fetches only events matching that address |
| Multiple addresses | Fetches events matching any of the addresses |

**Impact**: Server-side filtering reduces bandwidth and processing significantly when targeting specific addresses.

**When to Use**:
- Known addresses to track
- High-volume contracts
- Want to reduce bandwidth
- Indexed parameters available

**When Not to Use**:
- Need all events anyway (no savings)
- Filter logic too complex (use client-side pipe)
- Non-indexed parameters (must fetch all)

---

## Pattern 5b: Factory Event Filtering

**Use Case**: Filter factory contract creation events by indexed parameters to limit downstream event processing.

**Status**: Available (January 2025 - Latest SDK)

**Validated By**: SDK example 10.factory-event-filtering.ts

**Code Example**:

```typescript
import { evmDecoder, factory, factorySqliteDatabase } from "@subsquid/pipes/evm";
import { events as factoryAbi } from "./abi/uniswap.v3/factory";
import { events as swapsAbi } from "./abi/uniswap.v3/swaps";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const UNISWAP_V3_FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";

// WITHOUT filtering: Tracks ALL Uniswap V3 pools (~10,000+ pools)
// WITH filtering: Tracks only WETH pools (~1,000 pools)

const decoder = evmDecoder({
  range: { from: '12369621' },
  contracts: factory({
    address: UNISWAP_V3_FACTORY,

    // Filter factory events by indexed parameters
    event: {
      event: factoryAbi.PoolCreated,
      params: {
        token0: WETH,  // Only pools where token0 is WETH
        // You can filter by any indexed parameter:
        // token1: USDC,
        // fee: 3000,  // Only 0.3% fee tier
      },
    },

    parameter: 'pool',  // Which event param contains new contract address
    database: factorySqliteDatabase({ path: './weth-pools.sqlite' }),
  }),

  events: {
    // Will ONLY decode Swap events from WETH pools!
    swaps: swapsAbi.Swap,
  },
});

// Access factory event data in pipe
const stream = evmPortalSource({ portal }).pipe(decoder).pipe(({ swaps }) => {
  return swaps.map((swap) => ({
    pool: swap.contract,
    // Factory event data is attached to each swap
    token0: swap.factory?.event.token0,
    token1: swap.factory?.event.token1,
    fee: swap.factory?.event.fee,
    // Swap event data
    amount0: swap.event.amount0,
    amount1: swap.event.amount1,
  }));
});
```

**Key Benefits**:
- Drastically reduce number of contracts tracked (10x-100x reduction)
- Filter before storing in SQLite database
- Lower memory usage
- Faster sync times
- Only process events from relevant contracts

**Performance Impact**:
```
Without filtering:
- Tracks: ~10,000 Uniswap V3 pools
- SQLite DB: ~50MB
- Sync time: 45 minutes
- Memory: 2GB

With token0=WETH filtering:
- Tracks: ~1,000 WETH pools
- SQLite DB: ~5MB
- Sync time: 10 minutes
- Memory: 200MB
```

**Important Notes**:
- Only indexed parameters can be filtered
- Parameters used in `parameter` field cannot be filtered (they're the output!)
- Combines with regular event parameter filtering (Pattern 5)
- Multiple values supported (OR logic): `params: { token0: [WETH, USDC] }`

**When to Use**:
- Factory pattern with many deployed contracts
- Only care about subset of factory-created contracts
- Want to reduce resource usage
- Filter criteria matches indexed event parameters

**When Not to Use**:
- Need all factory-created contracts
- Filter criteria not in indexed parameters
- Complex filter logic (use client-side filtering)

---

## Pattern 6: Custom Prometheus Metrics

**Use Case**: Export custom metrics for monitoring and alerting.

**Validated By**: Pipeline 19 (Prometheus metrics)

**Code Example**:

```typescript
import { evmPortalSource, evmDecoder } from "@subsquid/pipes/evm";
import { metricsServer } from "@subsquid/pipes/metrics/node";

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
  
  // Enable metrics server
  metrics: metricsServer({
    port: 9090,
    enabled: true,
  }),
}).pipe(
  evmDecoder({
    range: { from: 21_230_000, to: 21_235_000 },
    contracts: [USDC_ADDRESS],
    events: { transfer: commonAbis.erc20.events.Transfer },
  })
);

for await (const { data, ctx } of stream) {
  for (const transfer of data.transfer) {
    const amountUSDC = Number(transfer.event.value) / 1e6;
    
    // 1. Counter - monotonically increasing
    ctx.metrics.counter({
      name: "usdc_transfers_total",
      help: "Total number of USDC transfers",
    }).inc(1);
    
    // 2. Gauge - current value
    ctx.metrics.gauge({
      name: "usdc_latest_transfer_amount",
      help: "Most recent USDC transfer amount",
    }).set(amountUSDC);
    
    // 3. Histogram - distribution with buckets
    ctx.metrics.histogram({
      name: "usdc_transfer_amount_histogram",
      help: "Distribution of USDC transfer amounts",
      buckets: [1, 10, 100, 1000, 10000, 100000, 1000000],
    }).observe(amountUSDC);
    
    // 4. Summary - percentiles
    ctx.metrics.summary({
      name: "usdc_transfer_amount_summary",
      help: "Summary statistics of USDC transfers",
      percentiles: [0.5, 0.9, 0.95, 0.99],
    }).observe(amountUSDC);
    
    // 5. Labeled metrics - dimensional data
    ctx.metrics.gauge({
      name: "token_transfers_by_contract",
      labelNames: ["contract", "token_symbol"],
    }).set(
      { contract: USDC_ADDRESS, token_symbol: "USDC" },
      totalTransfers
    );
  }
}

// Metrics available at: http://localhost:9090/metrics
```

**Metric Types**:

| Type | Use Case | Example |
|------|----------|---------|
| Counter | Count events | Total transfers, total errors |
| Gauge | Current value | Latest price, queue length |
| Histogram | Distribution | Transfer amounts, gas prices |
| Summary | Percentiles | p50, p95, p99 latencies |

**When to Use**:
- Production monitoring
- Alerting on thresholds
- Performance dashboards
- SLA tracking

**When Not to Use**:
- Development/testing (adds overhead)
- No monitoring infrastructure

---

## Pattern 7: Custom Target Implementation

**Use Case**: Write data to custom format (JSON files, S3, custom database).

**Validated By**: Pipeline 21 (Custom Target)

**Code Example**:

```typescript
import { createTarget, BlockCursor } from "@subsquid/pipes";
import * as fs from "fs/promises";

const writtenFiles: Array<{ file: string; cursor: BlockCursor }> = [];

function createJsonFileTarget() {
  return createTarget<any>({
    // Main write handler
    write: async ({ read, logger }) => {
      logger.info("Custom JSON target initialized");
      
      // Check for resume cursor
      let resumeCursor: BlockCursor | undefined;
      try {
        const cursorData = await fs.readFile("./data/cursor.json", "utf-8");
        resumeCursor = JSON.parse(cursorData);
        logger.info(`Resuming from block ${resumeCursor.number}`);
      } catch {
        logger.info("Starting fresh");
      }
      
      // Stream batches
      for await (const batch of read(resumeCursor)) {
        const transfers = batch.data.transfer || [];
        
        // Transform data
        const transferData = transfers.map((t: any) => ({
          blockNumber: t.block.number,
          blockHash: t.block.hash,
          transactionHash: t.rawEvent.transactionHash,
          from: t.event.from,
          to: t.event.to,
          value: t.event.value.toString(), // BigInt to string!
        }));
        
        // Write to JSON file
        const filepath = `./data/transfers-${batch.ctx.state.startBlock}-${batch.ctx.state.endBlock}.json`;
        await fs.writeFile(filepath, JSON.stringify(transferData, null, 2));
        
        // Save cursor for resume
        const cursor = batch.ctx.state.rollbackChain[
          batch.ctx.state.rollbackChain.length - 1
        ];
        
        if (cursor) {
          writtenFiles.push({ file: filepath, cursor });
          await fs.writeFile(
            "./data/cursor.json",
            JSON.stringify(cursor, null, 2)
          );
        }
      }
    },
    
    // Fork handler (optional but recommended)
    fork: async (previousBlocks) => {
      if (previousBlocks.length === 0) {
        // Full rollback - delete all files
        for (const { file } of writtenFiles) {
          await fs.unlink(file).catch(() => {});
        }
        return null; // Restart from beginning
      }
      
      // Partial rollback - delete files after fork point
      const lastCommonBlock = previousBlocks[previousBlocks.length - 1];
      const filesToDelete = writtenFiles.filter(
        entry => entry.cursor.number > lastCommonBlock.number
      );
      
      for (const { file } of filesToDelete) {
        await fs.unlink(file).catch(() => {});
      }
      
      return lastCommonBlock; // Resume from here
    },
  });
}

// Usage
await stream.pipeTo(createJsonFileTarget());
```

**When to Use**:
- Custom data format (JSON, CSV, Parquet)
- Custom storage (S3, GCS, IPFS)
- Custom database not supported by SDK
- Complex transformation logic

**When Not to Use**:
- ClickHouse (use clickhouseTarget)
- PostgreSQL (use drizzleTarget)
- Simple in-memory (use Pattern 9)

---

## Pattern 8: Memory Target with Finalized/Unfinalized Tracking

**Use Case**: In-memory storage with automatic finalized vs unfinalized data separation.

**Validated By**: Pipeline 22 (Memory Target)

**Code Example**:

```typescript
import { createTarget, BlockCursor } from "@subsquid/pipes";

function createSimpleMemoryTarget<T extends { blockNumber: number }[]>({
  onData,
}: {
  onData: (data: T) => Promise<void> | void;
}) {
  let unfinalizedData: T[number][] = [];

  return createTarget<T>({
    write: async ({ read, logger }) => {
      for await (const batch of read()) {
        // Get finalization height
        const finalizedHeight = batch.ctx.head.finalized?.number ?? Infinity;

        // Split current batch
        const finalized = batch.data.filter(
          (item: any) => item.blockNumber <= finalizedHeight
        );
        const unfinalized = batch.data.filter(
          (item: any) => item.blockNumber > finalizedHeight
        );

        // Check if buffered data is now finalized
        const nowFinalized = unfinalizedData.filter(
          (item) => item.blockNumber <= finalizedHeight
        );
        const stillUnfinalized = unfinalizedData.filter(
          (item) => item.blockNumber > finalizedHeight
        );

        // Process all finalized data
        const allFinalized = [...nowFinalized, ...finalized] as T;
        if (allFinalized.length > 0) {
          await onData(allFinalized); // Only finalized data!
        }

        // Update unfinalized buffer
        unfinalizedData = [...stillUnfinalized, ...unfinalized];

        logger.debug(
          `Finalized: ${allFinalized.length}, Buffered: ${unfinalizedData.length}`
        );
      }
    },
  });
}

// Usage
const finalizedTransfers: Transfer[] = [];

await stream.pipeTo(
  createSimpleMemoryTarget<Transfer[]>({
    onData: async (transfers) => {
      console.log(`Received ${transfers.length} finalized transfers`);
      finalizedTransfers.push(...transfers);
      // Safe to persist to database now!
    },
  })
);
```

**Finalized vs Unfinalized**:

| Data Type | Behavior | Use Case |
|-----------|----------|----------|
| Finalized | Immutable, safe to persist | Database writes, analytics |
| Unfinalized | Subject to rollback | Real-time UI, pending indicators |

**When to Use**:
- Testing/development
- Real-time dashboards (show pending data)
- Small datasets (< 10M records)
- No persistence needed

**When Not to Use**:
- Large datasets (use database)
- Need persistence across restarts
- Complex queries needed

---

## Pattern 9: RPC Latency Monitoring

**Use Case**: Compare Portal vs RPC endpoint latency for block announcements.

**Validated By**: Pipeline 20 (RPC Latency Watching)

**Code Example**:

```typescript
// Polyfill WebSocket for Node.js
import { WebSocket } from "ws";
global.WebSocket = WebSocket as any;

import { evmPortalSource, evmRpcLatencyWatcher } from "@subsquid/pipes/evm";
import { metricsServer } from "@subsquid/pipes/metrics/node";

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/base-mainnet",
  query: { from: "latest" }, // Live data
  metrics: metricsServer({ port: 9090 }),
}).pipe(
  evmRpcLatencyWatcher({
    rpcUrl: [
      "wss://base.drpc.org",
      "wss://base-rpc.publicnode.com",
    ],
  }).pipe((data, { metrics }) => {
    if (!data) return null;
    
    // Export latency metrics
    for (const rpc of data.rpc) {
      metrics.gauge({
        name: "rpc_latency_ms",
        labelNames: ["url"],
      }).set({ url: rpc.url }, rpc.portalDelayMs);
    }
    
    // Log comparison
    console.log(`Block ${data.block.number}`);
    console.log(`  Portal: ${data.portal.receivedAt}`);
    for (const rpc of data.rpc) {
      console.log(`  ${rpc.url}: +${rpc.portalDelayMs}ms`);
    }
    
    return data;
  })
);
```

**Typical Results**:
- Portal typically delivers blocks before RPC endpoints
- Portal provides consistent, reliable block delivery
- Useful for comparing infrastructure performance

**When to Use**:
- Monitoring RPC infrastructure
- Comparing RPC providers
- Validating Portal advantage
- Production health checks

**When Not to Use**:
- Historical data (no real-time comparison)
- Development environment

---

## Pattern Summary

| Pattern | Primary Use Case | Complexity | Performance |
|---------|-----------------|------------|-------------|
| 1. Single Contract | Known contract, simple events | Low | High |
| 2. Factory Pattern | Dynamic contract deployment | Medium | Medium-High |
| 3. Parallel Decoding | Multiple independent events | Medium | High |
| 4. Multi-Stage | Complex transformations | High | Medium |
| 5. Parameter Filtering | High-volume, targeted events | Low | Very High |
| 6. Solana Discriminators | Solana program instructions | Medium | High |
| 7. Prometheus Metrics | Production monitoring | Medium | Medium |
| 8. Custom Target | Custom storage/format | High | Varies |
| 9. Memory Target | Testing, small datasets | Low | Very High |
| 10. RPC Latency | Infrastructure monitoring | Medium | N/A |

---

## Best Practices

- **Start Simple**: Begin with Pattern 1 and evolve as needed
- **Use Server-Side Filtering**: Pattern 5 can dramatically reduce bandwidth
- **Monitor Production**: Pattern 7 is essential for production deployments
- **Handle Finalization**: Pattern 9 shows proper finalized/unfinalized handling
- **Test Patterns**: All patterns are validated by working pipeline examples
- **Choose Wisely**: Use the "When to Use/Not to Use" sections to guide selection

---

## Related Documentation

- [Pipes SDK API Reference](/en/sdk/pipes-sdk/api-reference)
- [Pipeline Examples Repository](https://github.com/subsquid/subsquid-pipes-examples)
- [ClickHouse Integration Guide](/en/sdk/pipes-sdk/targets/clickhouse)
- [PostgreSQL Integration Guide](/en/sdk/pipes-sdk/targets/postgres)
