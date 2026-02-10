# DEX Data Pipes - Advanced Patterns & Best Practices

## Overview

The `dex-data-pipes` package (from SQDGN project) is a production-grade implementation of blockchain indexers built on Subsquid Pipes SDK. It demonstrates advanced patterns for multi-protocol DEX analytics.

**Owner**: SQDGN
**License**: MIT (2025)

---

## Architecture Patterns

### 1. Multi-Protocol Decoder Pattern

**Pattern**: Use separate decoders for each protocol variant, then merge them with `pipeComposite()`.

```typescript
// Create individual decoders
const uniswapV2 = evmDecoder({
  profiler: { id: 'evm-liquidity' },
  range: { from: blockFrom },
  contracts: factory({
    address: getFactoryAddressesByProtocol(network, 'uniswap_v2'),
    event: UniswapV2FactoryEvents.PairCreated,
    database: await factorySqliteDatabase({ path: poolsDatabasePath }),
    parameter: 'pair',
  }),
  events: {
    swaps: UniswapV2PairEvents.Swap,
    burns: UniswapV2PairEvents.Burn,
    mints: UniswapV2PairEvents.Mint,
    syncs: UniswapV2PairEvents.Sync,
  },
});

const uniswapV3 = evmDecoder({ /* similar structure */ });

// Merge with pipeComposite
await portalSource
  .pipeComposite({ uniswapV2, uniswapV3, /* ... */ })
  .pipe(createPipeFunc(network, poolMetadataStorage))
  .pipeTo(chTarget);
```

**Benefits**:
- Clean separation of protocol logic
- Easy to add new protocols
- Each decoder has its own profiler for metrics
- Type-safe composite output

---

### 2. Converter Pattern for Event Normalization

**Pattern**: Create protocol-specific converters that transform raw events into a unified schema.

```typescript
// Unified output type
interface DbLiquidityEvent {
  block_number: number;
  transaction_index: number;
  log_index: number;
  pool_address: string;
  token0: string;
  token1: string;
  amount0: bigint;
  amount1: bigint;
  event_type: 'swap' | 'mint' | 'burn' | 'sync';
  protocol: 'uniswap_v2' | 'uniswap_v3' | 'aerodrome_basic';
  dex_name: string;
  network: Network;
}

// Protocol-specific converter
export const convertV2 = (network: Network, { uniswapV2 }: UniswapV2Data) => {
  const v2_swaps = uniswapV2.swaps.map(e => [
    {
      ...e,
      event: {
        amount0: e.event.amount0In ? e.event.amount0In : -e.event.amount0Out,
        amount1: e.event.amount1In ? e.event.amount1In : -e.event.amount1Out,
      },
    },
    'swap',
  ] as const);

  const v2_syncs = uniswapV2.syncs.map(e => [/* transform */] as const);

  return [...v2_swaps, ...v2_syncs].map((e) =>
    decodedToDbLiqEvent(e[0], e[1], network, 'uniswap_v2')
  );
};

// Merge and sort all events
export const createPipeFunc = (network: Network, storage: PoolMetadataStorage) => {
  return ({ uniswapV2, uniswapV3, uniswapV4, aerodromeBasic, aerodromeSlipstream }) => {
    const v2_res = convertV2(network, { uniswapV2 });
    const v3_res = convertV3(network, { uniswapV3 });
    const v4_res = convertV4(network, { uniswapV4 }, storage);
    const basic_res = convertAerodromeBasic(network, { aerodromeBasic });
    const slipstream_res = convertAerodromeSlipstream(network, { aerodromeSlipstream });

    // Sort by block, transaction, and log index for proper ordering
    return [...v2_res, ...v3_res, ...v4_res, ...basic_res, ...slipstream_res].sort((a, b) => {
      if (a.block_number !== b.block_number) return a.block_number - b.block_number;
      if (a.transaction_index !== b.transaction_index) return a.transaction_index - b.transaction_index;
      return a.log_index - b.log_index;
    });
  };
};
```

**Benefits**:
- Unified data schema across protocols
- Easy to add new protocols without changing downstream code
- Proper event ordering for database insertion
- Type-safe transformations

---

### 3. Pool Metadata Caching with SQLite

**Pattern**: Use a local SQLite database to cache pool metadata (tokens, fees, etc.) to avoid repeated RPC calls.

```typescript
export class PoolMetadataStorage {
  private db: Database;
  private cache: Map<string, PoolMetadata> = new Map();

  constructor(dbPath: string, private network: Network) {
    this.db = new Database(dbPath);
    this.ensureTables();
  }

  async getPoolMetadata(poolAddress: string): Promise<PoolMetadata | undefined> {
    // Check in-memory cache first
    if (this.cache.has(poolAddress)) {
      return this.cache.get(poolAddress);
    }

    // Check SQLite
    const row = this.db.prepare('SELECT * FROM pools WHERE address = ?').get(poolAddress);
    if (row) {
      const metadata = this.parseRow(row);
      this.cache.set(poolAddress, metadata);
      return metadata;
    }

    // Fetch from RPC and cache
    const metadata = await this.fetchFromRPC(poolAddress);
    if (metadata) {
      this.saveToDb(metadata);
      this.cache.set(poolAddress, metadata);
    }
    return metadata;
  }

  async batchGetPoolMetadata(addresses: string[]): Promise<Map<string, PoolMetadata>> {
    // Batch fetch for efficiency
    const result = new Map();
    const toFetch = addresses.filter(addr => !this.cache.has(addr));

    if (toFetch.length > 0) {
      const rows = this.db.prepare(
        `SELECT * FROM pools WHERE address IN (${toFetch.map(() => '?').join(',')})`
      ).all(toFetch);

      rows.forEach(row => {
        const metadata = this.parseRow(row);
        this.cache.set(metadata.address, metadata);
      });
    }

    addresses.forEach(addr => {
      if (this.cache.has(addr)) {
        result.set(addr, this.cache.get(addr)!);
      }
    });

    return result;
  }
}
```

**Benefits**:
- Dramatically reduces RPC calls
- Fast lookups with in-memory cache
- Persistent storage across restarts
- Batch operations for efficiency

---

### 4. Network and Protocol Configuration

**Pattern**: Centralize all network and protocol configuration in a single file.

```typescript
// pipes/evm/common/networks.ts
export type Network = 'ethereum' | 'base' | 'zora';
export type Protocol = 'uniswap_v2' | 'uniswap_v3' | 'uniswap_v4' | 'aerodrome_basic' | 'aerodrome_slipstream';
export type DexName = 'uniswap' | 'sushiswap' | 'aerodrome' | 'baseswap' | 'rocketswap' | 'pancakeswap';

export const FactoryAddresses: Record<Network, Partial<Record<Protocol, string[]>>> = {
  ethereum: {
    uniswap_v2: [
      '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2
      '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', // Sushiswap
    ],
    uniswap_v3: [
      '0x1F98431c8Ad98523631AE4a59f267346ea31F984', // Uniswap V3
    ],
  },
  base: {
    uniswap_v2: [
      '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6', // BaseSwap
      '0x1d0228A9c69541AFA26C49EC04df42c2Cb61aB67', // RocketSwap
    ],
    uniswap_v3: [
      '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', // Uniswap V3
      '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', // PancakeSwap V3
    ],
    aerodrome_basic: [
      '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', // Aerodrome
    ],
    aerodrome_slipstream: [
      '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A', // Aerodrome Slipstream
    ],
  },
};

export const V4PoolManagers: Record<Network, Partial<Record<DexName, string>>> = {
  ethereum: {
    uniswap: '0x...',
  },
  base: {
    uniswap: '0x...',
  },
};
```

**Benefits**:
- Single source of truth for addresses
- Easy to add new networks/protocols
- Type-safe configuration
- Clear documentation of supported protocols

---

### 5. ClickHouse Integration Patterns

#### A. Table Management with SQL Files

```typescript
// pipes/clickhouse.ts
export async function ensureTables(
  client: ClickHouseClient,
  sqlDir: string,
  network: Network,
  database: string,
) {
  const sqlFiles = await fs.readdir(sqlDir);
  const schemaFiles = sqlFiles.filter(f => f.endsWith('.sql'));

  for (const file of schemaFiles) {
    const sqlPath = path.join(sqlDir, file);
    const sql = await fs.readFile(sqlPath, 'utf-8');

    // Replace placeholders
    const processedSql = sql
      .replace(/{{network}}/g, network)
      .replace(/{{database}}/g, database);

    await client.exec({ query: processedSql });
  }
}
```

#### B. Materialized Views for Protocol-Specific Logic

```sql
-- V2 pools use Sync events for balances (absolute values)
CREATE MATERIALIZED VIEW IF NOT EXISTS liquidity_v2_mv TO balances_history AS
SELECT
  block_number,
  transaction_index,
  log_index,
  pool_address,
  token0,
  token1,
  amount0 as balance0,
  amount1 as balance1,
  dex_name,
  sign
FROM liquidity_events_raw
WHERE protocol = 'uniswap_v2' AND event_type = 'sync';

-- V3 pools accumulate mint/burn events (running sum)
CREATE MATERIALIZED VIEW IF NOT EXISTS liquidity_v3_mv TO balances_history AS
SELECT
  block_number,
  transaction_index,
  log_index,
  pool_address,
  token0,
  token1,
  sumOver(amount0) OVER (
    PARTITION BY pool_address
    ORDER BY block_number, transaction_index, log_index
  ) as balance0,
  sumOver(amount1) OVER (
    PARTITION BY pool_address
    ORDER BY block_number, transaction_index, log_index
  ) as balance1,
  dex_name,
  sign
FROM liquidity_events_raw
WHERE protocol = 'uniswap_v3' AND event_type IN ('mint', 'burn');
```

#### C. Retry Logic for ClickHouse Operations

```typescript
// common/chRetry.ts
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const isRetryable = error.message?.includes('timeout') ||
                          error.message?.includes('connection');
      if (!isRetryable) throw error;

      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Unreachable');
}

// Usage
await withRetry(() => client.insert({
  table: 'liquidity_events_raw',
  values: events,
  format: 'JSONEachRow',
}));
```

---

### 6. Reference Token Pattern

**Pattern**: Define reference tokens (like USDC) for token pair normalization and price calculations.

```typescript
// pipes/evm/common/reference_tokens.ts
export const REFERENCE_TOKENS: Record<Network, { address: string; symbol: string; priority: number }[]> = {
  ethereum: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', priority: 1 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', priority: 2 },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', priority: 3 },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', priority: 4 },
  ],
  base: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', priority: 1 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', priority: 2 },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', priority: 3 },
  ],
};

// Ensure token0 is always the reference token (if one exists)
export function normalizeTokenPair(token0: string, token1: string, network: Network) {
  const refTokens = REFERENCE_TOKENS[network];
  const priority0 = refTokens.find(t => t.address.toLowerCase() === token0.toLowerCase())?.priority ?? 999;
  const priority1 = refTokens.find(t => t.address.toLowerCase() === token1.toLowerCase())?.priority ?? 999;

  if (priority0 < priority1) {
    return { token0, token1, swapped: false };
  } else {
    return { token0: token1, token1: token0, swapped: true };
  }
}
```

---

### 7. Incremental Sync Strategy

**Pattern**: Use `BLOCK_TO` to sync pools first, then `BLOCK_FROM` to sync events.

```bash
# Step 1: Sync all pools from genesis to block 28620332
NETWORK=base BLOCK_TO=28620332 yarn liquidity

# Step 2: Sync events from block 28620333 onwards
NETWORK=base BLOCK_FROM=28620333 yarn liquidity

# Step 3: Configure CI/CD to auto-restart for continuous sync
```

**Why?**:
- Pool discovery (factory events) is fast
- Event processing (swaps, mints, burns) is slower
- This allows you to build pool metadata cache before processing events
- Can resume from any block without re-scanning entire history

---

### 8. Type-Safe Utilities

```typescript
// common/utils.ts

// Type-safe Object.entries
export function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

// Filter out null/undefined values
export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

// Convert null to undefined (for ClickHouse compatibility)
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
```

---

### 9. Profiler Pattern

**Pattern**: Use consistent profiler IDs for metrics collection.

```typescript
const uniswapV2 = evmDecoder({
  profiler: { id: 'evm-liquidity' }, // Same for all decoders in this pipe
  range: { from: blockFrom },
  // ...
});

const uniswapV3 = evmDecoder({
  profiler: { id: 'evm-liquidity' }, // Same ID
  range: { from: blockFrom },
  // ...
});
```

**Benefits**:
- Aggregate metrics across all decoders
- Easy to track performance per pipe
- Can enable metrics server on specific port

---

### 10. BigInt Serialization

**Pattern**: Always handle BigInt serialization for JSON operations.

```typescript
// common/bigint_serialization.ts
import 'dotenv/config';

// Monkey-patch JSON.stringify to handle BigInt
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Import this at the top of your entry point
import '~/common/bigint_serialization';
```

---

## Production Best Practices

### 1. Environment Configuration

```bash
# Network
NETWORK=base

# Database
DB_PATH='./pools-base.db'
CLICKHOUSE_DB=default
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=default
CLICKHOUSE_URL=http://localhost:8123

# Portal
PORTAL_CACHE_DB_PATH='./portal-cache.db'
PORTAL_URL=https://portal.sqd.dev/datasets/base-mainnet

# Block ranges
BLOCK_FROM=28620333
# BLOCK_TO=28620332  # Uncomment for pool sync only

# Metrics
METRICS_PORT=8890
```

### 2. ClickHouse Configuration

```yaml
# docker-compose.yml
services:
  ch:
    image: clickhouse/clickhouse-server:25.9
    ports:
      - "8123:8123"
      - "9000:9000"
    volumes:
      - ./local/clickhouse/data:/var/lib/clickhouse
      - ./local/clickhouse/config.xml:/etc/clickhouse-server/config.d/custom.xml
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: default
```

### 3. Error Handling

- Use retry logic for ClickHouse operations
- Implement proper logging with context
- Handle RPC failures gracefully
- Cache pool metadata to reduce RPC dependency

### 4. Performance Optimizations

- Use SQLite for pool metadata caching
- Batch database operations
- Use ClickHouse materialized views for aggregations
- Implement proper indexing on block_number, pool_address
- Use CollapsingMergeTree for updateable data

---

## Key Takeaways for New Indexers

1. **Separate decoders per protocol** - Use `pipeComposite()` to merge
2. **Converters for normalization** - Transform raw events to unified schema
3. **Cache pool metadata** - Use SQLite to avoid repeated RPC calls
4. **Reference tokens** - Define token priority for pair normalization
5. **Materialized views** - Use ClickHouse MVs for protocol-specific logic
6. **Incremental sync** - Sync pools first with `BLOCK_TO`, then events with `BLOCK_FROM`
7. **Type safety** - Use TypeScript utilities for type-safe operations
8. **Profilers** - Track performance with consistent profiler IDs
9. **BigInt handling** - Always handle BigInt serialization
10. **Retry logic** - Implement retries for database operations

---

## Comparison with Pipes CLI Templates

| Aspect | Pipes CLI Templates | dex-data-pipes |
|--------|-------------------|----------------|
| **Complexity** | Single protocol, simple transformations | Multi-protocol, complex normalizations |
| **Converters** | Direct mapping | Protocol-specific converters with normalization |
| **Pool Discovery** | Manual contract list | Factory pattern with SQLite caching |
| **Database** | Single table | Multiple tables + materialized views |
| **Event Ordering** | Natural order | Explicit sorting by block/tx/log |
| **Configuration** | Simple .env | Network/protocol config system |
| **Caching** | Portal cache only | Portal + pool metadata + in-memory |
| **Production Ready** | Basic | Full production deployment |

---

## When to Use These Patterns

### Use dex-data-pipes patterns when:
- Building multi-protocol indexers
- Need complex event normalization
- Require pool metadata lookups
- Building production-grade analytics systems
- Need protocol-specific aggregations

### Use simpler patterns when:
- Single protocol indexing
- Simple event tracking
- Prototyping and experimentation
- Small-scale analytics

---

## References

- **Repository**: `/path/to/dex-data-pipes`
- **Main Implementation**: `pipes/evm/liquidity/cli.ts`
- **Network Config**: `pipes/evm/common/networks.ts`
- **Converters**: `pipes/evm/liquidity/converters/`
- **Database Schema**: `pipes/evm/liquidity/liquidity.sql`
