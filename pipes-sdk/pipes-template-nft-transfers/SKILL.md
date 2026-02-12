---
name: pipes-template-nft-transfers
description: Production-ready template for indexing NFT transfers (ERC721). Includes schema, transformers, and examples for tracking mints, transfers, and burns across any NFT collection.
metadata:
  author: subsquid
  version: "1.0.0"
  category: template
  protocol-types: [nft, erc721]
  chains: [evm]
---

# Pipes: NFT Transfers Template

Production-ready indexer template for tracking ERC721 NFT Transfer events across any collection on EVM chains.

## When to Use This Template

Use this template when you need to track:
- **NFT mints** (from zero address)
- **NFT transfers** between wallets
- **NFT burns** (to zero address)
- **Collection ownership history**
- **Trading activity** for specific collections
- **Holder analytics** for NFT projects

## Supported Standards

This template works with any ERC721-compliant contract:
- **Standard ERC721** contracts
- **Bored Ape Yacht Club** (BAYC)
- **CryptoPunks** (with wrapper)
- **Azuki**, **Doodles**, **Clone X**
- **Any NFT collection** with Transfer events

## Template Structure

```
nft-transfers/
├── template.config.ts           # Template configuration and parameters
└── templates/
    ├── clickhouse-table.sql     # ClickHouse schema optimized for NFT data
    ├── pg-table.ts              # PostgreSQL schema with Drizzle ORM
    └── transformer.ts           # Event transformer with decoding logic
```

## What's Included

### 1. ClickHouse Schema
Optimized for high-performance NFT analytics:
```sql
CREATE TABLE IF NOT EXISTS nft_transfers (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    contract_address String,
    event_type String,
    from_address String,
    to_address String,
    token_id UInt256,
    sign Int8 DEFAULT 1
)
ENGINE = CollapsingMergeTree(sign)
ORDER BY (block_number, tx_hash, log_index)
```

**Key Features**:
- `CollapsingMergeTree` engine for efficient updates
- Ordered by block/transaction for fast chronological queries
- Timestamp with millisecond precision
- Support for large token IDs (UInt256)

### 2. PostgreSQL Schema
Relational schema with proper indexing:
```typescript
export const nftTransfers = pgTable('nft_transfers', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number').notNull(),
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  timestamp: timestamp('timestamp', { mode: 'date' }).notNull(),
  contractAddress: text('contract_address').notNull(),
  eventType: text('event_type').notNull(),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  tokenId: text('token_id').notNull(),
})
```

### 3. Event Transformer
Complete decoding logic for Transfer events:
```typescript
.pipe(({ transfers }) =>
  transfers.map((transfer) => ({
    blockNumber: transfer.block.number,
    txHash: transfer.rawEvent.transactionHash,
    logIndex: transfer.rawEvent.logIndex,
    timestamp: transfer.timestamp.getTime(),
    contractAddress: transfer.contract,
    eventType: 'transfer',
    fromAddress: transfer.event.from,
    toAddress: transfer.event.to,
    tokenId: transfer.event.tokenId,
  }))
)
```

## Usage

### Option 1: Using Pipes CLI (Recommended)

```bash
cd pipes-sdk/packages/cli

npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-nft-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "nftTransfers"}],
  "sink": "clickhouse"
}'
```

**IMPORTANT**: Use camelCase `"nftTransfers"`, not kebab-case!

### Option 2: Manual Integration

Copy the template files into your existing project:

```bash
# Copy schema
cp templates/nft-transfers/templates/clickhouse-table.sql migrations/

# Copy transformer as reference
cp templates/nft-transfers/templates/transformer.ts src/transformers/
```

## Customization Patterns

### 1. Track Specific NFT Collections

**Default** (BAYC):
```typescript
const decoder = evmDecoder({
  range: { from: '12287507' }, // BAYC deployment block
  contracts: ['0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'], // BAYC
  events: {
    transfers: commonAbis.erc721.events.Transfer,
  },
})
```

**Custom Collections**:
```typescript
const decoder = evmDecoder({
  range: { from: '12287507' },
  contracts: [
    '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // BAYC
    '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', // Mutant Apes
    '0xED5AF388653567Af2F388E6224dC7C4b3241C544', // Azuki
  ],
  events: {
    transfers: commonAbis.erc721.events.Transfer,
  },
})
```

### 2. Filter by Transfer Type (Mints, Burns, Transfers)

Add event classification:
```typescript
.pipe(({ transfers }) =>
  transfers.map((transfer) => {
    const from = transfer.event.from.toLowerCase()
    const to = transfer.event.to.toLowerCase()
    const zero = '0x0000000000000000000000000000000000000000'

    let eventType = 'transfer'
    if (from === zero) eventType = 'mint'
    else if (to === zero) eventType = 'burn'

    return {
      // ... existing fields
      eventType,
      fromAddress: from,
      toAddress: to,
    }
  })
)
```

### 3. Filter by Specific Token IDs

Track specific NFTs:
```typescript
.pipe(({ transfers }) =>
  transfers
    .filter((transfer) => {
      const tokenId = Number(transfer.event.tokenId)
      return tokenId >= 1 && tokenId <= 100 // First 100 NFTs
    })
    .map((transfer) => ({ /* ... */ }))
)
```

### 4. Add USD Value (Requires Price Oracle)

```typescript
.pipe(({ transfers }) =>
  transfers.map((transfer) => {
    // Fetch floor price from external source
    const floorPriceEth = getFloorPrice(transfer.contract)
    const ethPriceUsd = getEthPrice(transfer.block.timestamp)

    return {
      // ... existing fields
      floorPriceEth,
      floorPriceUsd: floorPriceEth * ethPriceUsd,
    }
  })
)
```

### 5. Track Only Mints (New Issuance)

```typescript
.pipe(({ transfers }) =>
  transfers
    .filter((transfer) =>
      transfer.event.from === '0x0000000000000000000000000000000000000000'
    )
    .map((transfer) => ({
      // ... existing fields
      eventType: 'mint',
    }))
)
```

## Schema Design Considerations

### ClickHouse Optimizations

**Order By Selection**:
```sql
-- For collection-centric queries:
ORDER BY (contract_address, block_number, tx_hash, log_index)

-- For holder-centric queries:
ORDER BY (to_address, contract_address, block_number)

-- For time-series analysis:
ORDER BY (timestamp, contract_address, token_id)

-- For token-centric queries:
ORDER BY (contract_address, token_id, block_number)
```

**Partition Strategy** (for large datasets):
```sql
PARTITION BY toYYYYMM(timestamp)
```

### Data Type Choices

| Field | Type | Reason |
|-------|------|--------|
| `token_id` | `UInt256` | NFT IDs can be very large (especially on-chain generated) |
| `block_number` | `UInt32` | Sufficient for current block numbers |
| `timestamp` | `DateTime(3)` | Millisecond precision for ordering |
| `event_type` | `String` | Flexible for mint/transfer/burn classification |
| Addresses | `String` | EVM addresses are strings |

## Example Queries

### Top 10 Most Active Collections (Last 24h)
```sql
SELECT
    contract_address,
    COUNT(*) as transfer_count,
    COUNT(DISTINCT to_address) as unique_receivers
FROM nft_transfers
WHERE timestamp >= now() - INTERVAL 1 DAY
GROUP BY contract_address
ORDER BY transfer_count DESC
LIMIT 10
```

### Mints vs Transfers vs Burns
```sql
SELECT
    contract_address,
    event_type,
    COUNT(*) as count
FROM nft_transfers
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY contract_address, event_type
ORDER BY contract_address, event_type
```

### Holder Distribution for a Collection
```sql
SELECT
    to_address as holder,
    COUNT(DISTINCT token_id) as nft_count
FROM nft_transfers
WHERE contract_address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
  AND to_address != '0x0000000000000000000000000000000000000000'
GROUP BY holder
ORDER BY nft_count DESC
LIMIT 50
```

### Recent Mints for a Collection
```sql
SELECT
    timestamp,
    tx_hash,
    to_address as minter,
    token_id
FROM nft_transfers
WHERE contract_address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
  AND event_type = 'mint'
ORDER BY timestamp DESC
LIMIT 20
```

### Trading Volume Timeline (Hourly)
```sql
SELECT
    toStartOfHour(timestamp) as hour,
    COUNT(*) as transfer_count,
    COUNT(DISTINCT from_address) as unique_sellers,
    COUNT(DISTINCT to_address) as unique_buyers
FROM nft_transfers
WHERE contract_address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
  AND event_type = 'transfer'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY hour
ORDER BY hour
```

### Largest Token ID Minted
```sql
SELECT
    MAX(token_id) as max_token_id,
    COUNT(*) as total_minted
FROM nft_transfers
WHERE contract_address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
  AND event_type = 'mint'
```

## Performance Benchmarks

| Scenario | Sync Time | Memory | Dataset |
|----------|-----------|--------|---------|
| Single collection (BAYC), full history | ~3 min | 150MB | ~10K transfers |
| 5 major collections, full history | ~8 min | 400MB | ~100K transfers |
| All Ethereum NFTs (top 100), last 6 months | ~25 min | 1.5GB | ~1M transfers |

**Tips for faster sync**:
1. Start from recent blocks if you don't need full history
2. Limit to specific collections instead of tracking all NFTs
3. Use ClickHouse for analytics (faster than PostgreSQL)
4. Consider filtering out burn events if not needed

## Common Issues

### Issue: No transfers appearing in database

**Possible causes**:
1. Wrong contract address
2. Start block is after NFT launch
3. Contract is not ERC721 compliant
4. Contract uses custom Transfer event signature

**Solution**: Check Etherscan for actual Transfer events, verify contract implements ERC721.

### Issue: Token IDs are negative or wrong

**Possible causes**:
1. Token IDs are very large (> 2^128)
2. Contract uses non-standard token ID format

**Solution**: Use `UInt256` type in schema, convert carefully in transformer.

### Issue: Missing mints from contract deployment

**Possible causes**:
1. Start block is after initial mint
2. Mints happened in constructor (not indexed)
3. NFTs were minted via batch function

**Solution**: Check deployment transaction for initial mints, adjust start block to before deployment.

### Issue: Too many transfers for popular collections

**Solution**:
- Filter by specific token ID ranges
- Track only recent transfers (last N months)
- Use sampling (every Nth block)

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexer using this template
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize sync speed
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors and validate data
- [pipes-template-dex-swaps](../pipes-template-dex-swaps/SKILL.md) - DEX template
- [pipes-template-lending-protocol](../pipes-template-lending-protocol/SKILL.md) - Lending template

## Additional Resources

- **Template Code**: See `templates/nft-transfers/` for full implementation
- **ERC721 Spec**: https://eips.ethereum.org/EIPS/eip-721
- **OpenSea NFT API**: https://docs.opensea.io/reference/api-overview
- **NFT Standards**: https://ethereum.org/en/developers/docs/standards/tokens/erc-721/

## Official Subsquid Documentation

- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick NFT indexing reference
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/files/evm-openapi.yaml)** - Portal API for NFT events
- **[Available Datasets](https://portal.sqd.dev/datasets)** - Supported NFT networks

## Version History

- **v1.0.0** (2025-01): Initial release with ERC721 Transfer event support
