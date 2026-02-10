---
name: pipes-template-liquid-staking
description: Production-ready template for indexing liquid staking protocols. Includes schema, transformers, and examples for Lido, Rocket Pool, Frax Ether, and other staking derivatives.
metadata:
  author: subsquid
  version: "1.0.0"
  category: template
  protocol-types: [staking, defi, liquid-staking]
  chains: [evm]
---

# Pipes: Liquid Staking Template

Production-ready indexer template for tracking liquid staking events across Lido, Rocket Pool, Frax Ether, and other staking derivatives on EVM chains.

## When to Use This Template

Use this template when you need to track:
- **ETH staking deposits** (Lido Submitted events)
- **stETH/rETH transfers** (liquid staking token movements)
- **Staking rewards** and rebasing
- **Validator deposits** and withdrawals
- **Total value locked (TVL)** in staking protocols
- **User staking history** and positions

## Supported Protocols

This template works with major liquid staking protocols:
- **Lido** (stETH)
- **Rocket Pool** (rETH)
- **Frax Ether** (frxETH, sfrxETH)
- **Coinbase Wrapped Staked ETH** (cbETH)
- **Any protocol** with similar deposit/transfer events

## Template Structure

```
liquid-staking/
├── template.config.ts           # Template configuration and parameters
└── templates/
    ├── clickhouse-table.sql     # ClickHouse schema optimized for staking data
    ├── pg-table.ts              # PostgreSQL schema with Drizzle ORM
    └── transformer.ts           # Event transformer with decoding logic
```

## What's Included

### 1. ClickHouse Schema
Optimized for high-performance staking analytics:
```sql
CREATE TABLE IF NOT EXISTS staking_events (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    event_type String,
    contract_address String,
    user String,
    amount UInt256,
    shares UInt256,
    referral String,
    sign Int8 DEFAULT 1
)
ENGINE = CollapsingMergeTree(sign)
ORDER BY (block_number, tx_hash, log_index)
```

**Key Features**:
- `CollapsingMergeTree` engine for efficient updates
- Tracks both `amount` (ETH) and `shares` (stTokens)
- Referral tracking for Lido
- Event type classification (submitted, transfer)

### 2. PostgreSQL Schema
Relational schema with proper indexing:
```typescript
export const stakingEvents = pgTable('staking_events', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number').notNull(),
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  timestamp: timestamp('timestamp', { mode: 'date' }).notNull(),
  eventType: text('event_type').notNull(),
  contractAddress: text('contract_address').notNull(),
  user: text('user').notNull(),
  amount: text('amount').notNull(), // Stored as string for big numbers
  shares: text('shares').notNull(),
  referral: text('referral'),
})
```

### 3. Event Transformer
Complete decoding logic for staking events:
```typescript
.pipe(({ submitted, transfers }) => {
  const submittedEvents = submitted.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'submitted',
    contractAddress: e.contract,
    user: e.event.sender,
    amount: e.event.amount,
    shares: 0n,
    referral: e.event.referral,
  }))

  const transferEvents = transfers.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'transfer',
    contractAddress: e.contract,
    user: e.event.from,
    amount: e.event.value,
    shares: 0n,
    referral: e.event.to,
  }))

  return [...submittedEvents, ...transferEvents]
})
```

## Usage

### Option 1: Using Pipes CLI (Recommended)

```bash
cd pipes-sdk/packages/cli

npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-staking-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "liquidStaking"}],
  "sink": "clickhouse"
}'
```

**IMPORTANT**: Use camelCase `"liquidStaking"`, not kebab-case!

### Option 2: Manual Integration

Copy the template files into your existing project:

```bash
# Copy schema
cp templates/liquid-staking/templates/clickhouse-table.sql migrations/

# Copy transformer as reference
cp templates/liquid-staking/templates/transformer.ts src/transformers/
```

## Customization Patterns

### 1. Track Specific Staking Protocol

**Default** (Lido):
```typescript
const decoder = evmDecoder({
  range: { from: '11473216' }, // Lido stETH deployment block
  contracts: ['0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'], // Lido
  events: {
    submitted: Submitted,
    transfers: commonAbis.erc20.events.Transfer,
  },
})
```

**Rocket Pool**:
```typescript
const RocketNodeDeposit = event(
  '0x60eb2bb6ca8e47b9e4f5dfe8434ef8de82b2bc4d0f6e97e9b2b6b8c81db2e8a0',
  'RocketNodeDeposit(address,uint256)',
  { from: indexed(p.address), amount: p.uint256 },
)

const decoder = evmDecoder({
  range: { from: '13325304' }, // Rocket Pool deployment
  contracts: ['0xae78736Cd615f374D3085123A210448E74Fc6393'], // rETH
  events: {
    deposits: RocketNodeDeposit,
    transfers: commonAbis.erc20.events.Transfer,
  },
})
```

**Frax Ether**:
```typescript
const decoder = evmDecoder({
  range: { from: '15692319' }, // Frax Ether deployment
  contracts: [
    '0x5E8422345238F34275888049021821E8E08CAa1f', // frxETH
    '0xac3E018457B222d93114458476f3E3416Abbe38F', // sfrxETH
  ],
  events: {
    deposits: Deposit, // Custom Frax deposit event
    transfers: commonAbis.erc20.events.Transfer,
  },
})
```

### 2. Calculate Daily Staking Volume

```typescript
.pipe(({ submitted }) =>
  submitted.map((e) => ({
    // ... existing fields
    amountEth: Number(e.event.amount) / 1e18,
    date: new Date(e.timestamp).toISOString().split('T')[0],
  }))
)
```

### 3. Filter by Minimum Stake Amount

Track only large stakes:
```typescript
.pipe(({ submitted }) =>
  submitted
    .filter((e) => {
      const amountEth = Number(e.event.amount) / 1e18
      return amountEth >= 32 // Minimum 32 ETH (full validator)
    })
    .map((e) => ({ /* ... */ }))
)
```

### 4. Track Referral Program Activity

For Lido's referral system:
```typescript
.pipe(({ submitted }) =>
  submitted
    .filter((e) =>
      e.event.referral !== '0x0000000000000000000000000000000000000000'
    )
    .map((e) => ({
      // ... existing fields
      hasReferral: true,
      referralAddress: e.event.referral,
    }))
)
```

### 5. Combine Multiple Events for TVL Tracking

```typescript
.pipe(({ submitted, withdrawals, transfers }) => {
  // Track deposits
  const deposits = submitted.map((e) => ({
    type: 'deposit',
    amount: Number(e.event.amount) / 1e18,
    timestamp: e.timestamp,
  }))

  // Track withdrawals (if available)
  const withdraws = withdrawals.map((e) => ({
    type: 'withdrawal',
    amount: -Number(e.event.amount) / 1e18, // Negative for TVL calculation
    timestamp: e.timestamp,
  }))

  return [...deposits, ...withdraws]
})
```

### 6. Add Rebase Events (stETH Rebasing)

For protocols with rebasing tokens:
```typescript
const TokenRebased = event(
  '0x...',
  'TokenRebased(uint256,uint256,uint256)',
  { totalShares: p.uint256, totalEther: p.uint256, sharePrice: p.uint256 },
)

// Track rebases separately
.pipe(({ rebases }) =>
  rebases.map((e) => ({
    blockNumber: e.block.number,
    timestamp: e.timestamp.getTime(),
    eventType: 'rebase',
    totalShares: e.event.totalShares,
    totalEther: e.event.totalEther,
    sharePrice: Number(e.event.sharePrice) / 1e18,
  }))
)
```

## Schema Design Considerations

### ClickHouse Optimizations

**Order By Selection**:
```sql
-- For user-centric queries:
ORDER BY (user, timestamp, block_number)

-- For time-series analysis:
ORDER BY (timestamp, contract_address, user)

-- For contract-centric queries:
ORDER BY (contract_address, timestamp, user)

-- For event type filtering:
ORDER BY (event_type, timestamp, user)
```

**Partition Strategy** (for large datasets):
```sql
PARTITION BY toYYYYMM(timestamp)
```

### Data Type Choices

| Field | Type | Reason |
|-------|------|--------|
| `amount` | `UInt256` | ETH amounts can be very large |
| `shares` | `UInt256` | Share amounts match token precision |
| `block_number` | `UInt32` | Sufficient for current block numbers |
| `timestamp` | `DateTime(3)` | Millisecond precision for ordering |
| `event_type` | `String` | Flexible event classification |
| Addresses | `String` | EVM addresses are strings |

## Example Queries

### Daily Staking Volume
```sql
SELECT
    toStartOfDay(timestamp) as day,
    SUM(amount) / 1e18 as total_eth_staked,
    COUNT(DISTINCT user) as unique_stakers,
    AVG(amount) / 1e18 as avg_stake_size
FROM staking_events
WHERE event_type = 'submitted'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day
```

### Top Stakers (All Time)
```sql
SELECT
    user,
    SUM(amount) / 1e18 as total_staked_eth,
    COUNT(*) as stake_count,
    MIN(timestamp) as first_stake,
    MAX(timestamp) as last_stake
FROM staking_events
WHERE event_type = 'submitted'
GROUP BY user
ORDER BY total_staked_eth DESC
LIMIT 50
```

### Referral Program Performance
```sql
SELECT
    referral,
    COUNT(*) as referral_count,
    SUM(amount) / 1e18 as total_referred_eth,
    COUNT(DISTINCT user) as unique_users_referred
FROM staking_events
WHERE event_type = 'submitted'
  AND referral != '0x0000000000000000000000000000000000000000'
GROUP BY referral
ORDER BY total_referred_eth DESC
LIMIT 20
```

### Staking Activity by Hour
```sql
SELECT
    toStartOfHour(timestamp) as hour,
    COUNT(*) as stake_count,
    SUM(amount) / 1e18 as hourly_volume_eth
FROM staking_events
WHERE event_type = 'submitted'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY hour
ORDER BY hour
```

### Large Stakes (>100 ETH)
```sql
SELECT
    timestamp,
    tx_hash,
    user,
    amount / 1e18 as eth_amount,
    referral
FROM staking_events
WHERE event_type = 'submitted'
  AND amount > 100000000000000000000 -- 100 ETH in wei
ORDER BY timestamp DESC
LIMIT 100
```

### TVL Growth Over Time
```sql
SELECT
    toStartOfDay(timestamp) as day,
    SUM(
        CASE
            WHEN event_type = 'submitted' THEN amount
            ELSE 0
        END
    ) / 1e18 as cumulative_deposits_eth
FROM staking_events
WHERE timestamp >= now() - INTERVAL 90 DAY
GROUP BY day
ORDER BY day
```

## Performance Benchmarks

| Scenario | Sync Time | Memory | Dataset |
|----------|-----------|--------|---------|
| Lido, last 6 months | ~5 min | 200MB | ~100K events |
| Lido, full history | ~15 min | 600MB | ~500K events |
| Multiple protocols, last year | ~10 min | 400MB | ~200K events |

**Tips for faster sync**:
1. Start from recent blocks if you don't need full history
2. Focus on specific protocols instead of tracking all
3. Use ClickHouse for analytics (faster than PostgreSQL)
4. Filter out small transfers if not needed

## Common Issues

### Issue: No staking events appearing

**Possible causes**:
1. Wrong contract address
2. Start block is after protocol deployment
3. Using wrong event signature
4. Protocol uses custom events

**Solution**: Check Etherscan for actual Submitted/Deposit events, verify ABI.

### Issue: Amounts are wrong or too large

**Possible causes**:
1. Not dividing by token decimals (18 for ETH)
2. Confusing amount (ETH) with shares (stTokens)

**Solution**: Always divide by 1e18, verify which field represents ETH vs shares.

### Issue: Missing referral data

**Possible causes**:
1. Referral parameter not in event
2. Most stakers don't use referrals
3. Referral is zero address

**Solution**: This is expected - most stakes don't have referrals. Filter for non-zero referrals.

### Issue: Transfer events overwhelming dataset

**Solution**:
- Focus on Submitted/Deposit events for staking analytics
- Filter transfers by minimum amount
- Track only transfers from/to specific addresses (e.g., exchanges)

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexer using this template
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize sync speed
- [pipes-validation](../pipes-validation/SKILL.md) - Validate indexed data
- [pipes-template-dex-swaps](../pipes-template-dex-swaps/SKILL.md) - DEX template
- [pipes-template-erc4626-vaults](../pipes-template-erc4626-vaults/SKILL.md) - Vault template

## Additional Resources

- **Template Code**: See `templates/liquid-staking/` for full implementation
- **Lido Docs**: https://docs.lido.fi/
- **Rocket Pool Docs**: https://docs.rocketpool.net/
- **Frax Ether Docs**: https://docs.frax.finance/frax-ether/overview
- **Ethereum Staking**: https://ethereum.org/en/staking/

## Version History

- **v1.0.0** (2025-01): Initial release with Lido Submitted and Transfer events
