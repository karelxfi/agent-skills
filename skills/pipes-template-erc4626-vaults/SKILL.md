---
name: pipes-template-erc4626-vaults
description: Production-ready template for indexing ERC4626 vault events. Includes schema, transformers, and examples for Morpho, Yearn V3, and other tokenized vault protocols.
metadata:
  author: subsquid
  version: "1.0.0"
  category: template
  protocol-types: [vault, defi, yield, erc4626]
  chains: [evm]
---

# Pipes: ERC4626 Vaults Template

Production-ready indexer template for tracking ERC4626 vault Deposit and Withdraw events across Morpho, Yearn V3, and other tokenized vaults on EVM chains.

## When to Use This Template

Use this template when you need to track:
- **Vault deposits** (users supplying assets)
- **Vault withdrawals** (users redeeming shares)
- **Share issuance** and redemption
- **Total value locked (TVL)** in vaults
- **User positions** and vault activity
- **Yield strategy performance**

## Supported Protocols

This template works with any ERC4626-compliant vault:
- **Morpho Vaults**
- **Yearn V3 Vaults**
- **Balancer Boosted Pools**
- **ERC4626 Alliance** protocols
- **Any tokenized vault** with standard Deposit/Withdraw events

## Template Structure

```
erc4626-vaults/
├── template.config.ts           # Template configuration and parameters
└── templates/
    ├── clickhouse-table.sql     # ClickHouse schema optimized for vault data
    ├── pg-table.ts              # PostgreSQL schema with Drizzle ORM
    └── transformer.ts           # Event transformer with decoding logic
```

## What's Included

### 1. ClickHouse Schema
Optimized for high-performance vault analytics:
```sql
CREATE TABLE IF NOT EXISTS vault_events (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    event_type String,
    vault_address String,
    sender String,
    on_behalf String,
    receiver String,
    assets UInt256,
    shares UInt256,
    sign Int8 DEFAULT 1
)
ENGINE = CollapsingMergeTree(sign)
ORDER BY (block_number, tx_hash, log_index)
```

**Key Features**:
- `CollapsingMergeTree` engine for efficient updates
- Tracks both `assets` (underlying tokens) and `shares` (vault tokens)
- Separate sender/receiver fields for delegation
- Event type classification (deposit, withdraw)

### 2. PostgreSQL Schema
Relational schema with proper indexing:
```typescript
export const vaultEvents = pgTable('vault_events', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number').notNull(),
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  timestamp: timestamp('timestamp', { mode: 'date' }).notNull(),
  eventType: text('event_type').notNull(),
  vaultAddress: text('vault_address').notNull(),
  sender: text('sender').notNull(),
  onBehalf: text('on_behalf'),
  receiver: text('receiver'),
  assets: text('assets').notNull(), // Stored as string for big numbers
  shares: text('shares').notNull(),
})
```

### 3. Event Transformer
Complete decoding logic for ERC4626 events:
```typescript
.pipe(({ deposits, withdrawals }) => {
  const depositEvents = deposits.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'deposit',
    vaultAddress: e.contract,
    sender: e.event.sender,
    onBehalf: e.event.onBehalf,
    receiver: e.event.onBehalf,
    assets: e.event.assets,
    shares: e.event.shares,
  }))

  const withdrawalEvents = withdrawals.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'withdraw',
    vaultAddress: e.contract,
    sender: e.event.sender,
    onBehalf: e.event.onBehalf,
    receiver: e.event.receiver,
    assets: e.event.assets,
    shares: e.event.shares,
  }))

  return [...depositEvents, ...withdrawalEvents]
})
```

## Usage

### Option 1: Using Pipes CLI (Recommended)

```bash
cd pipes-sdk/packages/cli

npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-vault-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "erc4626Vaults"}],
  "sink": "clickhouse"
}'
```

**IMPORTANT**: Use camelCase `"erc4626Vaults"`, not kebab-case!

### Option 2: Manual Integration

Copy the template files into your existing project:

```bash
# Copy schema
cp templates/erc4626-vaults/templates/clickhouse-table.sql migrations/

# Copy transformer as reference
cp templates/erc4626-vaults/templates/transformer.ts src/transformers/
```

## Customization Patterns

### 1. Track Specific Vaults

**Default** (Morpho Vault):
```typescript
const decoder = evmDecoder({
  range: { from: '24349693' }, // Morpho Vault deployment
  contracts: ['0xec7fe6e856fab7b3f6f82787ae73bc70a1e70192'], // Morpho USDC Vault
  events: {
    deposits: events.Deposit,
    withdrawals: events.Withdraw,
  },
})
```

**Multiple Vaults**:
```typescript
const decoder = evmDecoder({
  range: { from: '24349693' },
  contracts: [
    '0xec7fe6e856fab7b3f6f82787ae73bc70a1e70192', // Morpho USDC Vault
    '0x73e65dbd630f90604062f6e02fab9138e713edd9', // Morpho WETH Vault
    '0x...',                                       // Yearn V3 Vault
  ],
  events: {
    deposits: events.Deposit,
    withdrawals: events.Withdraw,
  },
})
```

### 2. Calculate Share Price / Exchange Rate

```typescript
.pipe(({ deposits, withdrawals }) => {
  return [...deposits, ...withdrawals].map((e) => {
    const assets = Number(e.event.assets) / 1e18
    const shares = Number(e.event.shares) / 1e18
    const sharePrice = shares > 0 ? assets / shares : 1

    return {
      // ... existing fields
      assetsNormalized: assets,
      sharesNormalized: shares,
      sharePrice,
    }
  })
})
```

### 3. Filter by Minimum Deposit Size

Track only large deposits:
```typescript
.pipe(({ deposits }) =>
  deposits
    .filter((e) => {
      const assetsUsd = Number(e.event.assets) / 1e6 // Assuming USDC (6 decimals)
      return assetsUsd >= 10000 // Minimum $10,000
    })
    .map((e) => ({ /* ... */ }))
)
```

### 4. Track Net Flows (Deposits - Withdrawals)

```typescript
.pipe(({ deposits, withdrawals }) => {
  const depositEvents = deposits.map((e) => ({
    // ... existing fields
    flowDirection: 1, // Inflow
    netAssets: Number(e.event.assets),
  }))

  const withdrawalEvents = withdrawals.map((e) => ({
    // ... existing fields
    flowDirection: -1, // Outflow
    netAssets: -Number(e.event.assets),
  }))

  return [...depositEvents, ...withdrawalEvents]
})
```

### 5. Add Vault Metadata (Requires On-Chain Calls)

```typescript
.pipe(({ deposits, withdrawals }) =>
  Promise.all(
    [...deposits, ...withdrawals].map(async (e) => {
      // Fetch vault metadata
      const asset = await getVaultAsset(e.contract)
      const totalAssets = await getTotalAssets(e.contract)

      return {
        // ... existing fields
        underlyingAsset: asset,
        vaultTvl: totalAssets,
      }
    })
  )
)
```

### 6. Separate Deposits and Withdrawals into Different Tables

```typescript
// In transformer
const deposits = evmDecoder({ /* ... */ })
  .pipe(({ deposits }) => deposits.map(/* ... */))

const withdrawals = evmDecoder({ /* ... */ })
  .pipe(({ withdrawals }) => withdrawals.map(/* ... */))

// Export separately
export { deposits, withdrawals }
```

## Schema Design Considerations

### ClickHouse Optimizations

**Order By Selection**:
```sql
-- For vault-centric queries:
ORDER BY (vault_address, timestamp, block_number)

-- For user-centric queries:
ORDER BY (sender, vault_address, timestamp)

-- For time-series analysis:
ORDER BY (timestamp, vault_address, sender)

-- For event type filtering:
ORDER BY (event_type, vault_address, timestamp)
```

**Partition Strategy** (for large datasets):
```sql
PARTITION BY toYYYYMM(timestamp)
```

### Data Type Choices

| Field | Type | Reason |
|-------|------|--------|
| `assets` | `UInt256` | Asset amounts can be very large |
| `shares` | `UInt256` | Share amounts match token precision |
| `block_number` | `UInt32` | Sufficient for current block numbers |
| `timestamp` | `DateTime(3)` | Millisecond precision for ordering |
| `event_type` | `String` | Flexible event classification |
| Addresses | `String` | EVM addresses are strings |

## Example Queries

### Daily Vault Activity
```sql
SELECT
    toStartOfDay(timestamp) as day,
    vault_address,
    SUM(CASE WHEN event_type = 'deposit' THEN assets ELSE 0 END) / 1e18 as total_deposits,
    SUM(CASE WHEN event_type = 'withdraw' THEN assets ELSE 0 END) / 1e18 as total_withdrawals,
    COUNT(DISTINCT sender) as unique_users
FROM vault_events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY day, vault_address
ORDER BY day, vault_address
```

### Top Depositors
```sql
SELECT
    sender,
    vault_address,
    SUM(CASE WHEN event_type = 'deposit' THEN assets ELSE 0 END) / 1e18 as total_deposited,
    SUM(CASE WHEN event_type = 'withdraw' THEN assets ELSE 0 END) / 1e18 as total_withdrawn,
    COUNT(*) as transaction_count
FROM vault_events
GROUP BY sender, vault_address
ORDER BY total_deposited DESC
LIMIT 50
```

### Vault TVL Changes Over Time
```sql
SELECT
    toStartOfHour(timestamp) as hour,
    vault_address,
    SUM(
        CASE
            WHEN event_type = 'deposit' THEN assets
            WHEN event_type = 'withdraw' THEN -assets
            ELSE 0
        END
    ) / 1e18 as net_flow
FROM vault_events
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY hour, vault_address
ORDER BY hour, vault_address
```

### Share Price History
```sql
SELECT
    toStartOfDay(timestamp) as day,
    vault_address,
    AVG(assets / shares) as avg_share_price,
    MIN(assets / shares) as min_share_price,
    MAX(assets / shares) as max_share_price
FROM vault_events
WHERE shares > 0
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day, vault_address
ORDER BY day, vault_address
```

### Largest Single Deposits
```sql
SELECT
    timestamp,
    tx_hash,
    vault_address,
    sender,
    assets / 1e18 as deposit_amount,
    shares / 1e18 as shares_received,
    assets / shares as share_price
FROM vault_events
WHERE event_type = 'deposit'
  AND shares > 0
ORDER BY assets DESC
LIMIT 20
```

### User Position Summary
```sql
SELECT
    sender,
    vault_address,
    SUM(CASE WHEN event_type = 'deposit' THEN shares ELSE 0 END) / 1e18 as shares_acquired,
    SUM(CASE WHEN event_type = 'withdraw' THEN shares ELSE 0 END) / 1e18 as shares_redeemed,
    (shares_acquired - shares_redeemed) as current_shares
FROM vault_events
GROUP BY sender, vault_address
HAVING current_shares > 0
ORDER BY current_shares DESC
```

### Withdrawal Rate Analysis
```sql
SELECT
    toStartOfDay(timestamp) as day,
    COUNT(CASE WHEN event_type = 'withdraw' THEN 1 END) as withdrawal_count,
    COUNT(CASE WHEN event_type = 'deposit' THEN 1 END) as deposit_count,
    withdrawal_count::Float / NULLIF(deposit_count, 0) as withdrawal_rate
FROM vault_events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day
```

## Performance Benchmarks

| Scenario | Sync Time | Memory | Dataset |
|----------|-----------|--------|---------|
| Single vault, last 6 months | ~2 min | 100MB | ~10K events |
| 5 major vaults, full history | ~8 min | 400MB | ~50K events |
| All Morpho vaults, last year | ~15 min | 800MB | ~100K events |

**Tips for faster sync**:
1. Start from recent blocks if you don't need full history
2. Focus on specific vaults instead of tracking all
3. Use ClickHouse for analytics (faster than PostgreSQL)
4. Consider filtering by minimum deposit size

## Common Issues

### Issue: No events appearing in database

**Possible causes**:
1. Wrong vault address
2. Start block is after vault deployment
3. Vault doesn't implement ERC4626 standard
4. Using wrong ABI

**Solution**: Check Etherscan for actual Deposit/Withdraw events, verify ERC4626 compliance.

### Issue: Share price calculations are wrong

**Possible causes**:
1. Not accounting for token decimals
2. Division by zero (shares = 0)
3. Mixing up assets and shares

**Solution**: Always check decimals, handle zero-share cases, verify asset vs share fields.

### Issue: Missing onBehalf or receiver fields

**Possible causes**:
1. Some implementations omit these fields
2. Fields are zero address
3. Using older vault standard

**Solution**: These fields are optional in some implementations. Default to sender if missing.

### Issue: Assets and shares don't match expectations

**Possible causes**:
1. Vault uses different decimals than underlying asset
2. Vault has performance fees
3. Share price has appreciated

**Solution**: This is normal for yield-bearing vaults. Share price increases over time.

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexer using this template
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize sync speed
- [pipes-validation](../pipes-validation/SKILL.md) - Validate indexed data
- [pipes-template-dex-swaps](../pipes-template-dex-swaps/SKILL.md) - DEX template
- [pipes-template-liquid-staking](../pipes-template-liquid-staking/SKILL.md) - Staking template

## Additional Resources

- **Template Code**: See `templates/erc4626-vaults/` for full implementation
- **ERC4626 Spec**: https://eips.ethereum.org/EIPS/eip-4626
- **Morpho Docs**: https://docs.morpho.org/
- **Yearn V3 Docs**: https://docs.yearn.fi/
- **ERC4626 Alliance**: https://erc4626.info/

## Version History

- **v1.0.0** (2025-01): Initial release with ERC4626 Deposit and Withdraw events
