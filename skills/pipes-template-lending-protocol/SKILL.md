---
name: pipes-template-lending-protocol
description: Production-ready template for indexing lending protocol events. Includes schema, transformers, and examples for Aave V3, Compound V3, Morpho, and other lending markets.
metadata:
  author: subsquid
  version: "1.0.0"
  category: template
  protocol-types: [lending, defi, borrowing]
  chains: [evm]
---

# Pipes: Lending Protocol Template

Production-ready indexer template for tracking lending protocol events (Supply, Borrow, Repay, Liquidate) across Aave V3, Compound V3, Morpho, and other lending markets on EVM chains.

## When to Use This Template

Use this template when you need to track:
- **Supply events** (users depositing collateral)
- **Withdraw events** (users removing collateral)
- **Borrow events** (users taking loans)
- **Repay events** (loan repayments)
- **Liquidation events** (underwater positions)
- **User positions** and health factors
- **Protocol TVL** and utilization rates

## Supported Protocols

This template works with major lending protocols:
- **Aave V3**
- **Compound V3**
- **Morpho Blue**
- **Spark Protocol**
- **Radiant Capital**
- **Any protocol** with similar lending events

## Template Structure

```
lending-protocol/
├── template.config.ts           # Template configuration and parameters
└── templates/
    ├── clickhouse-table.sql     # ClickHouse schema optimized for lending data
    ├── pg-table.ts              # PostgreSQL schema with Drizzle ORM
    └── transformer.ts           # Event transformer with decoding logic
```

## What's Included

### 1. ClickHouse Schema
Optimized for high-performance lending analytics:
```sql
CREATE TABLE IF NOT EXISTS lending_events (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    event_type String,
    reserve Nullable(String),
    user String,
    on_behalf_of Nullable(String),
    to Nullable(String),
    repayer Nullable(String),
    amount Nullable(UInt256),
    referral_code Nullable(UInt16),
    interest_rate_mode Nullable(UInt8),
    borrow_rate Nullable(UInt256),
    use_a_tokens Nullable(Bool),
    collateral_asset Nullable(String),
    debt_asset Nullable(String),
    debt_to_cover Nullable(UInt256),
    liquidated_collateral_amount Nullable(UInt256),
    liquidator Nullable(String),
    receive_a_token Nullable(Bool),
    sign Int8 DEFAULT 1
)
ENGINE = CollapsingMergeTree(sign)
ORDER BY (block_number, tx_hash, log_index)
```

**Key Features**:
- `CollapsingMergeTree` engine for efficient updates
- Flexible schema supporting all event types (supply, borrow, repay, liquidation)
- Nullable fields for event-specific data
- Tracks interest rate modes and referral codes

### 2. PostgreSQL Schema
Relational schema with proper indexing:
```typescript
export const lendingEvents = pgTable('lending_events', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number').notNull(),
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  timestamp: timestamp('timestamp', { mode: 'date' }).notNull(),
  eventType: text('event_type').notNull(),
  reserve: text('reserve'),
  user: text('user').notNull(),
  onBehalfOf: text('on_behalf_of'),
  to: text('to'),
  repayer: text('repayer'),
  amount: text('amount'), // Stored as string for big numbers
  referralCode: integer('referral_code'),
  interestRateMode: integer('interest_rate_mode'),
  borrowRate: text('borrow_rate'),
  useATokens: boolean('use_a_tokens'),
  collateralAsset: text('collateral_asset'),
  debtAsset: text('debt_asset'),
  debtToCover: text('debt_to_cover'),
  liquidatedCollateralAmount: text('liquidated_collateral_amount'),
  liquidator: text('liquidator'),
  receiveAToken: boolean('receive_a_token'),
})
```

### 3. Event Transformer
Complete decoding logic for all lending events:
```typescript
.pipe(({ supplies, withdraws, borrows, repays, liquidations }) => {
  const supplyEvents = supplies.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'supply',
    reserve: e.event.reserve,
    user: e.event.user,
    onBehalfOf: e.event.onBehalfOf,
    amount: e.event.amount,
    referralCode: e.event.referralCode,
  }))

  const withdrawEvents = withdraws.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'withdraw',
    reserve: e.event.reserve,
    user: e.event.user,
    to: e.event.to,
    amount: e.event.amount,
  }))

  const borrowEvents = borrows.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'borrow',
    reserve: e.event.reserve,
    user: e.event.user,
    onBehalfOf: e.event.onBehalfOf,
    amount: e.event.amount,
    interestRateMode: e.event.interestRateMode,
    borrowRate: e.event.borrowRate,
    referralCode: e.event.referralCode,
  }))

  const repayEvents = repays.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'repay',
    reserve: e.event.reserve,
    user: e.event.user,
    repayer: e.event.repayer,
    amount: e.event.amount,
    useATokens: e.event.useATokens,
  }))

  const liquidationEvents = liquidations.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'liquidation',
    collateralAsset: e.event.collateralAsset,
    debtAsset: e.event.debtAsset,
    user: e.event.user,
    debtToCover: e.event.debtToCover,
    liquidatedCollateralAmount: e.event.liquidatedCollateralAmount,
    liquidator: e.event.liquidator,
    receiveAToken: e.event.receiveAToken,
  }))

  return [...supplyEvents, ...withdrawEvents, ...borrowEvents, ...repayEvents, ...liquidationEvents]
})
```

## Usage

### Option 1: Using Pipes CLI (Recommended)

```bash
cd pipes-sdk/packages/cli

npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-lending-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "lendingProtocol"}],
  "sink": "clickhouse"
}'
```

**IMPORTANT**: Use camelCase `"lendingProtocol"`, not kebab-case!

### Option 2: Manual Integration

Copy the template files into your existing project:

```bash
# Copy schema
cp templates/lending-protocol/templates/clickhouse-table.sql migrations/

# Copy transformer as reference
cp templates/lending-protocol/templates/transformer.ts src/transformers/
```

## Customization Patterns

### 1. Track Specific Lending Protocol

**Default** (Aave V3 on Ethereum):
```typescript
const decoder = evmDecoder({
  range: { from: '16291127' }, // Aave V3 Pool deployment
  contracts: ['0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'], // Aave V3 Pool
  events: {
    supplies: events.Supply,
    withdraws: events.Withdraw,
    borrows: events.Borrow,
    repays: events.Repay,
    liquidations: events.LiquidationCall,
  },
})
```

**Compound V3**:
```typescript
const decoder = evmDecoder({
  range: { from: '15331586' }, // Compound V3 cUSDCv3 deployment
  contracts: ['0xc3d688B66703497DAA19211EEdff47f25384cdc3'], // cUSDCv3
  events: {
    supplies: CompoundSupply,
    withdraws: CompoundWithdraw,
    borrows: CompoundBorrow,
    // Compound uses different event signatures
  },
})
```

**Morpho Blue**:
```typescript
const decoder = evmDecoder({
  range: { from: '18883365' }, // Morpho Blue deployment
  contracts: ['0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'], // Morpho Blue
  events: {
    supplies: MorphoSupply,
    withdraws: MorphoWithdraw,
    borrows: MorphoBorrow,
    repays: MorphoRepay,
    liquidations: MorphoLiquidation,
  },
})
```

### 2. Filter by Specific Reserve/Asset

Track only USDC lending:
```typescript
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

.pipe(({ supplies, borrows }) =>
  [...supplies, ...borrows]
    .filter((e) =>
      e.event.reserve?.toLowerCase() === USDC.toLowerCase()
    )
    .map((e) => ({ /* ... */ }))
)
```

### 3. Calculate Interest Rates (APY/APR)

```typescript
.pipe(({ borrows }) =>
  borrows.map((e) => {
    const borrowRateRaw = Number(e.event.borrowRate)
    const borrowRateApr = (borrowRateRaw / 1e27) * 100 // Ray format to percentage

    return {
      // ... existing fields
      borrowRateApr,
      borrowRateApy: ((1 + borrowRateApr / 365) ** 365 - 1) * 100,
    }
  })
)
```

### 4. Track Only Liquidations

Focus on liquidation events:
```typescript
.pipe(({ liquidations }) =>
  liquidations.map((e) => ({
    // ... existing fields
    liquidationBonus: Number(e.event.liquidatedCollateralAmount) /
                      Number(e.event.debtToCover),
  }))
)
```

### 5. Filter by Minimum Position Size

Track only large positions:
```typescript
.pipe(({ supplies, borrows }) =>
  [...supplies, ...borrows]
    .filter((e) => {
      const amountUsd = Number(e.event.amount) / 1e6 // Assuming USDC
      return amountUsd >= 100000 // Minimum $100,000
    })
    .map((e) => ({ /* ... */ }))
)
```

### 6. Separate Variable vs Stable Rate Borrows

For Aave V3:
```typescript
.pipe(({ borrows }) =>
  borrows.map((e) => {
    const rateMode = e.event.interestRateMode
    const rateType = rateMode === 1 ? 'stable' : 'variable'

    return {
      // ... existing fields
      rateType,
    }
  })
)
```

### 7. Track User Health Factor (Requires State)

```typescript
// Build user position state
const userPositions = new Map()

.pipe(({ supplies, withdraws, borrows, repays }) => {
  for (const supply of supplies) {
    // Update user collateral
    const pos = userPositions.get(supply.event.user) || {}
    pos.collateral = (pos.collateral || 0n) + supply.event.amount
    userPositions.set(supply.event.user, pos)
  }

  for (const borrow of borrows) {
    // Update user debt
    const pos = userPositions.get(borrow.event.user) || {}
    pos.debt = (pos.debt || 0n) + borrow.event.amount
    userPositions.set(borrow.event.user, pos)
  }

  // Calculate health factors
  return Array.from(userPositions.entries()).map(([user, pos]) => ({
    user,
    collateral: pos.collateral,
    debt: pos.debt,
    healthFactor: pos.debt > 0 ? pos.collateral / pos.debt : Infinity,
  }))
})
```

## Schema Design Considerations

### ClickHouse Optimizations

**Order By Selection**:
```sql
-- For user-centric queries:
ORDER BY (user, timestamp, block_number)

-- For reserve-centric queries:
ORDER BY (reserve, event_type, timestamp)

-- For time-series analysis:
ORDER BY (timestamp, reserve, user)

-- For liquidation analysis:
ORDER BY (event_type, timestamp, user)
```

**Partition Strategy** (for large datasets):
```sql
PARTITION BY toYYYYMM(timestamp)
```

### Data Type Choices

| Field | Type | Reason |
|-------|------|--------|
| `amount` | `UInt256` (Nullable) | Token amounts can be very large |
| `borrow_rate` | `UInt256` (Nullable) | Interest rates in Ray format |
| `block_number` | `UInt32` | Sufficient for current block numbers |
| `timestamp` | `DateTime(3)` | Millisecond precision for ordering |
| `event_type` | `String` | Flexible event classification |
| Addresses | `String` | EVM addresses are strings |
| Boolean fields | `Bool` (Nullable) | Optional flags |

## Example Queries

### Daily Lending Activity
```sql
SELECT
    toStartOfDay(timestamp) as day,
    event_type,
    COUNT(*) as event_count,
    SUM(amount) / 1e18 as total_volume,
    COUNT(DISTINCT user) as unique_users
FROM lending_events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY day, event_type
ORDER BY day, event_type
```

### Top Borrowers
```sql
SELECT
    user,
    reserve,
    SUM(CASE WHEN event_type = 'borrow' THEN amount ELSE 0 END) / 1e18 as total_borrowed,
    SUM(CASE WHEN event_type = 'repay' THEN amount ELSE 0 END) / 1e18 as total_repaid,
    (total_borrowed - total_repaid) as outstanding_debt
FROM lending_events
GROUP BY user, reserve
HAVING outstanding_debt > 0
ORDER BY outstanding_debt DESC
LIMIT 50
```

### Liquidation Events
```sql
SELECT
    timestamp,
    tx_hash,
    user as liquidated_user,
    liquidator,
    debt_asset,
    debt_to_cover / 1e18 as debt_covered,
    collateral_asset,
    liquidated_collateral_amount / 1e18 as collateral_seized,
    (liquidated_collateral_amount / debt_to_cover) as liquidation_bonus
FROM lending_events
WHERE event_type = 'liquidation'
ORDER BY timestamp DESC
LIMIT 100
```

### Reserve Utilization Rates
```sql
SELECT
    reserve,
    SUM(CASE WHEN event_type = 'supply' THEN amount ELSE 0 END) / 1e18 as total_supplied,
    SUM(CASE WHEN event_type = 'withdraw' THEN amount ELSE 0 END) / 1e18 as total_withdrawn,
    SUM(CASE WHEN event_type = 'borrow' THEN amount ELSE 0 END) / 1e18 as total_borrowed,
    SUM(CASE WHEN event_type = 'repay' THEN amount ELSE 0 END) / 1e18 as total_repaid,
    (total_borrowed - total_repaid) / (total_supplied - total_withdrawn) as utilization_rate
FROM lending_events
GROUP BY reserve
ORDER BY utilization_rate DESC
```

### Interest Rate History
```sql
SELECT
    toStartOfHour(timestamp) as hour,
    reserve,
    AVG(borrow_rate / 1e27 * 100) as avg_borrow_rate_apr
FROM lending_events
WHERE event_type = 'borrow'
  AND borrow_rate IS NOT NULL
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY hour, reserve
ORDER BY hour, reserve
```

### User Position Summary
```sql
SELECT
    user,
    reserve,
    SUM(CASE WHEN event_type = 'supply' THEN amount ELSE 0 END) / 1e18 as total_supplied,
    SUM(CASE WHEN event_type = 'withdraw' THEN amount ELSE 0 END) / 1e18 as total_withdrawn,
    (total_supplied - total_withdrawn) as net_supply_position
FROM lending_events
WHERE user = '0x...'
GROUP BY user, reserve
```

### Liquidation Risk (Large Borrows)
```sql
SELECT
    user,
    reserve,
    SUM(amount) / 1e18 as total_borrowed,
    MAX(timestamp) as last_borrow_time,
    COUNT(*) as borrow_count
FROM lending_events
WHERE event_type = 'borrow'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY user, reserve
HAVING total_borrowed > 1000000 -- >$1M borrowed
ORDER BY total_borrowed DESC
```

### Referral Program Performance
```sql
SELECT
    referral_code,
    COUNT(*) as referral_count,
    SUM(amount) / 1e18 as total_referred_volume,
    COUNT(DISTINCT user) as unique_users_referred
FROM lending_events
WHERE event_type IN ('supply', 'borrow')
  AND referral_code IS NOT NULL
  AND referral_code != 0
GROUP BY referral_code
ORDER BY total_referred_volume DESC
```

## Performance Benchmarks

| Scenario | Sync Time | Memory | Dataset |
|----------|-----------|--------|---------|
| Aave V3, last 6 months | ~8 min | 400MB | ~200K events |
| Aave V3, full history | ~25 min | 1.2GB | ~1M events |
| Multiple protocols, last year | ~20 min | 800MB | ~500K events |

**Tips for faster sync**:
1. Start from recent blocks if you don't need full history
2. Focus on specific reserves if you don't need all assets
3. Use ClickHouse for analytics (faster than PostgreSQL)
4. Consider filtering by minimum transaction size

## Common Issues

### Issue: No events appearing in database

**Possible causes**:
1. Wrong pool/contract address
2. Start block is after protocol deployment
3. Using wrong event signatures
4. Protocol uses different event names

**Solution**: Check Etherscan for actual Supply/Borrow events, verify contract is the Pool (not LendingPoolAddressProvider).

### Issue: Interest rates are extremely large or wrong

**Possible causes**:
1. Not converting from Ray format (1e27)
2. Mixing up stable vs variable rates

**Solution**: Aave uses Ray format (27 decimals). Divide by 1e27 and multiply by 100 for percentage.

### Issue: Missing reserve or user fields

**Possible causes**:
1. Event signature doesn't include these fields
2. Using older protocol version
3. Fields are in different positions

**Solution**: Verify ABI against actual events on Etherscan. Some protocols use indexed vs non-indexed parameters.

### Issue: Liquidation data incomplete

**Possible causes**:
1. Liquidations are rare events
2. Start block is too recent
3. Protocol may not have liquidations yet

**Solution**: This is expected - liquidations only occur when positions become undercollateralized. Check during market volatility.

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexer using this template
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize sync speed
- [pipes-validation](../pipes-validation/SKILL.md) - Validate indexed data
- [pipes-template-dex-swaps](../pipes-template-dex-swaps/SKILL.md) - DEX template
- [pipes-template-erc4626-vaults](../pipes-template-erc4626-vaults/SKILL.md) - Vault template

## Additional Resources

- **Template Code**: See `templates/lending-protocol/` for full implementation
- **Aave V3 Docs**: https://docs.aave.com/developers/
- **Compound V3 Docs**: https://docs.compound.finance/
- **Morpho Docs**: https://docs.morpho.org/
- **DeFi Lending**: https://ethereum.org/en/defi/#lending

## Version History

- **v1.0.0** (2025-01): Initial release with Aave V3 events (Supply, Withdraw, Borrow, Repay, Liquidation)
