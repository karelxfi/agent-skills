---
name: pipes-template-dex-swaps
description: Production-ready template for indexing decentralized exchange (DEX) swap events. Includes schema, transformers, and examples for Uniswap, SushiSwap, PancakeSwap, and other AMM protocols.
metadata:
  author: subsquid
  version: "1.0.0"
  category: template
  protocol-types: [dex, amm]
  chains: [evm]
---

# Pipes: DEX Swaps Template

Production-ready indexer template for tracking swap events across any decentralized exchange (DEX) on EVM chains.

## When to Use This Template

Use this template when you need to track:
- **DEX swap events** (Uniswap, SushiSwap, PancakeSwap, etc.)
- **Token pair trading activity** (e.g., USDC/ETH, WETH/DAI)
- **Price movements** across liquidity pools
- **Trading volume analytics** for specific tokens or pairs
- **Liquidity pool activity** (swaps, not LP positions)

## Supported Protocols

This template works with any Uniswap V2/V3-compatible DEX:
- **Uniswap** V2 and V3
- **SushiSwap**
- **PancakeSwap**
- **TraderJoe**
- **QuickSwap**
- **Any AMM** with standard Swap events

## Template Structure

```
generic-dex-swaps/
├── template.config.ts           # Template configuration and parameters
└── templates/
    ├── clickhouse-table.sql     # ClickHouse schema optimized for analytics
    ├── pg-table.ts              # PostgreSQL schema with Drizzle ORM
    └── transformer.ts           # Event transformer with decoding logic
```

## What's Included

### 1. ClickHouse Schema
Optimized for high-performance analytics queries:
```sql
CREATE TABLE swaps (
    date DateTime(3),
    hash String,
    block_number UInt64,
    pool_address String,
    token0 String,
    token1 String,
    amount0 Float64,
    amount1 Float64,
    sender String,
    recipient String
) ENGINE = MergeTree()
ORDER BY (pool_address, date, hash)
```

### 2. PostgreSQL Schema
Relational schema with proper indexing:
```typescript
export const swaps = pgTable('swaps', {
  id: serial('id').primaryKey(),
  hash: text('hash').notNull(),
  blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
  poolAddress: text('pool_address').notNull(),
  token0: text('token0').notNull(),
  token1: text('token1').notNull(),
  amount0: doublePrecision('amount0').notNull(),
  amount1: doublePrecision('amount1').notNull(),
  // ... additional fields
})
```

### 3. Event Transformer
Complete decoding logic for Swap events:
```typescript
.pipe(({ swaps }) =>
  swaps.map((swap) => ({
    date: new Date(swap.block.timestamp * 1000),
    hash: swap.transactionHash,
    blockNumber: swap.block.number,
    poolAddress: swap.address,
    token0: swap.event.token0 || swap.factory?.event.token0,
    token1: swap.event.token1 || swap.factory?.event.token1,
    amount0: Number(swap.event.amount0) / 1e18,
    amount1: Number(swap.event.amount1) / 1e18,
    sender: swap.event.sender,
    recipient: swap.event.to
  }))
)
```

## Usage

### Option 1: Using Pipes CLI (Recommended)

```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-dex-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "genericDexSwaps"}],
  "sink": "clickhouse"
}'
```

**IMPORTANT**: Use camelCase `"genericDexSwaps"`, not kebab-case!

**Tip**: Run `npx @iankressin/pipes-cli@latest init --schema` to see all available templates.

### Option 2: Manual Integration

Copy the template files into your existing project:

```bash
# Copy schema
cp templates/generic-dex-swaps/templates/clickhouse-table.sql migrations/

# Copy transformer as reference
cp templates/generic-dex-swaps/templates/transformer.ts src/transformers/
```

## Customization Patterns

### 1. Filter by Specific Token Pairs (RECOMMENDED METHOD - 2025)

**NEW WAY**: Use factory event parameter filtering for MUCH better performance:

```typescript
import { factory, factorySqliteDatabase } from '@subsquid/pipes/evm'

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

const decoder = evmDecoder({
  range: { from: '12369621' }, // Uniswap V3 deployment
  contracts: factory({
    address: '0x1f98431c8ad98523631ae4a59f267346ea31f984', // Uniswap V3 factory

    // Filter factory PoolCreated events by parameters
    event: {
      event: factoryAbi.PoolCreated,
      params: {
        token0: WETH,  // Only pools where token0 is WETH
        // Or: token0: [WETH, USDC]  // Multiple tokens
      },
    },

    parameter: 'pool',
    database: factorySqliteDatabase({ path: './weth-pools.sqlite' }),
  }),
  events: {
    swaps: swapsAbi.Swap,  // Will ONLY decode swaps from filtered pools!
  },
})
```

**Performance**: 10x faster, 10x less memory!

### 2. Filter by Specific Pool Addresses

```typescript
const decoder = evmDecoder({
  range: { from: '12369621' },
  contracts: [
    '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', // USDC/ETH 0.3%
    '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // USDC/ETH 0.05%
  ],
  events: {
    swaps: swapsAbi.Swap,
  },
})
```

### 3. Add Token Price Calculation

```typescript
.pipe(({ swaps }) =>
  swaps.map((swap) => {
    const amount0 = Number(swap.event.amount0) / 1e18
    const amount1 = Number(swap.event.amount1) / 1e18
    const price = amount1 !== 0 ? Math.abs(amount0 / amount1) : 0

    return {
      // ... existing fields
      price,
      priceUsd: price * usdcPrice, // If USDC is token1
    }
  })
)
```

### 4. Filter by Minimum Trade Size

```typescript
.pipe(({ swaps }) =>
  swaps
    .filter((swap) => {
      const amount0 = Number(swap.event.amount0) / 1e18
      const amount1 = Number(swap.event.amount1) / 1e18
      const volumeUsd = Math.max(Math.abs(amount0), Math.abs(amount1))
      return volumeUsd >= 1000 // Minimum $1000 trade
    })
    .map((swap) => ({ /* ... */ }))
)
```

## Schema Design Considerations

### ClickHouse Optimizations

**Order By Selection**:
```sql
-- For pool-centric queries:
ORDER BY (pool_address, date, hash)

-- For token-centric queries:
ORDER BY (token0, token1, date, hash)

-- For time-series analysis:
ORDER BY (date, pool_address, hash)
```

**Partition Strategy** (for large datasets):
```sql
PARTITION BY toYYYYMM(date)
```

### Data Type Choices

| Field | Type | Reason |
|-------|------|--------|
| `amount0/amount1` | `Float64` | Token amounts (decimals divided) |
| `block_number` | `UInt64` | Block numbers are positive integers |
| `date` | `DateTime(3)` | Millisecond precision for ordering |
| `hash` | `String` | Transaction hashes are strings |
| Addresses | `String` | EVM addresses are strings |

## Example Queries

### Top 10 Most Active Pools (Last 24h)
```sql
SELECT
    pool_address,
    COUNT(*) as swap_count,
    SUM(ABS(amount1)) as volume
FROM swaps
WHERE date >= now() - INTERVAL 1 DAY
GROUP BY pool_address
ORDER BY swap_count DESC
LIMIT 10
```

### Price Chart Data (USDC/ETH)
```sql
SELECT
    toStartOfHour(date) as hour,
    AVG(ABS(amount1 / amount0)) as avg_price,
    MIN(ABS(amount1 / amount0)) as low_price,
    MAX(ABS(amount1 / amount0)) as high_price
FROM swaps
WHERE pool_address = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'
  AND date >= now() - INTERVAL 7 DAY
GROUP BY hour
ORDER BY hour
```

### Largest Swaps
```sql
SELECT
    date,
    hash,
    pool_address,
    ABS(amount0) as token0_amount,
    ABS(amount1) as token1_amount
FROM swaps
ORDER BY token1_amount DESC
LIMIT 20
```

## Performance Benchmarks

| Scenario | Sync Time | Memory | Dataset |
|----------|-----------|--------|---------|
| Single pool, 1M blocks | ~5 min | 200MB | ~50K swaps |
| WETH pools (filtered), full history | ~10 min | 500MB | ~500K swaps |
| All Uniswap V3 pools, full history | ~45 min | 2GB | ~10M swaps |

**Tips for faster sync**:
1. Use factory parameter filtering (Pattern 1 above)
2. Start from recent blocks (e.g., last 6 months)
3. Limit to specific pools if you don't need all data
4. Use ClickHouse for analytics (faster than PostgreSQL)

## Common Issues

### Issue: No swaps appearing in database

**Possible causes**:
1. Wrong factory address or pool addresses
2. Start block is after most activity
3. Using wrong ABI (V2 vs V3)
4. Pool is a proxy contract

**Solution**: Check Etherscan for actual Swap events, verify addresses and ABI match.

### Issue: Amounts are wrong / too large

**Possible causes**:
1. Not dividing by token decimals
2. Mixing up amount0 and amount1
3. Using wrong decimal places

**Solution**: Check token decimals on Etherscan, divide by `10^decimals`.

### Issue: Too slow / running out of memory

**Solution**: Use factory parameter filtering (see Customization Pattern #1)

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexer using this template
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize sync speed
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors and validate data
- [pipes-template-nft-transfers](../pipes-template-nft-transfers/SKILL.md) - NFT template
- [pipes-template-lending-protocol](../pipes-template-lending-protocol/SKILL.md) - Lending template

## Additional Resources

- **Template Code**: See `templates/generic-dex-swaps/` for full implementation
- **Uniswap V3 Docs**: https://docs.uniswap.org/contracts/v3/overview
- **SushiSwap Docs**: https://docs.sushi.com/

## Official Subsquid Documentation

- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick DEX indexing reference
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/files/evm-openapi.yaml)** - Portal API for factory patterns
- **[Available Datasets](https://portal.sqd.dev/datasets)** - Supported DEX networks

## Version History

- **v1.0.0** (2025-01): Initial release with factory parameter filtering support
