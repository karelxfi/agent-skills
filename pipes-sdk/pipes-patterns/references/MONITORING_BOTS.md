# Monitoring Bot Pattern

**Use Case**: Build bots that monitor blockchain activity and send real-time alerts via webhooks or custom notification systems.

**Examples**: Whale alert bots, MEV monitoring, large transfer notifications, smart contract event alerts, price impact warnings.

## Complete Monitoring Bot Example

**Whale Alert Bot** - Monitor large USDC transfers in real-time:

```typescript
// FILE: src/index.ts
// REPLACES: <new file>
// DEPENDENCIES: @subsquid/pipes@^5.0.0, @subsquid/pipes-abi@^1.0.0

import { evmPortalSource, evmDecoder } from "@subsquid/pipes/evm";
import { commonAbis } from "@subsquid/pipes-abi";
import { createTarget } from "@subsquid/pipes";

// Replace with your contract address
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

// Adjust threshold as needed
const WHALE_THRESHOLD = 1_000_000n * 10n ** 6n; // 1M USDC (6 decimals)

// Type definition with JSON schema comments
type Transfer = {
  blockNumber: number;    // uint32
  timestamp: number;      // Unix timestamp in seconds
  txHash: string;         // 0x-prefixed hex, 66 chars
  from: string;           // 0x-prefixed address, 42 chars
  to: string;             // 0x-prefixed address, 42 chars
  value: bigint;          // Raw value in token's smallest unit
  valueUSD: string;       // Formatted USD string (e.g., "$1,000,000.00")
};

// Real-time streaming source
const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
  query: { from: "latest" }, // Start from latest block
}).pipe(
  evmDecoder({
    contracts: [USDC_ADDRESS],
    events: {
      transfer: commonAbis.erc20.events.Transfer,
    },
  })
);

// Custom alert target - process whale transfers
const alertTarget = createTarget<Transfer[]>({
  write: async ({ read, logger }) => {
    for await (const batch of read()) {
      // Only process finalized blocks to avoid duplicate alerts on reorgs
      const finalizedHeight = batch.ctx.head.finalized?.number ?? 0;
      
      const whaleTransfers = batch.data.filter(
        (t) => t.blockNumber <= finalizedHeight && t.value >= WHALE_THRESHOLD
      );

      if (whaleTransfers.length === 0) continue;

      // Process each whale transfer
      for (const transfer of whaleTransfers) {
        logger.info(
          `Whale transfer detected: ${transfer.valueUSD} from ${transfer.from.slice(0, 10)}... to ${transfer.to.slice(0, 10)}...`
        );
        
        // Implement your alert logic here:
        // - Send to webhook endpoint
        // - Write to database for dashboard
        // - Trigger notification service
        // - Update metrics/counters
        
        // Example: Call your notification function
        // await sendAlert(transfer);
      }
    }
  },
});

// Pipeline
stream
  .pipe((data) => {
    const transfers: Transfer[] = data.transfer.map((t) => ({
      blockNumber: t.block.number,
      timestamp: t.block.timestamp || 0,
      txHash: t.rawEvent.transactionHash,
      from: t.event.from,
      to: t.event.to,
      value: t.event.value,
      valueUSD: (Number(t.event.value) / 1e6).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
    }));
    return transfers;
  })
  .pipeTo(alertTarget);
```

## Key Patterns for Monitoring Bots

### 1. Use Real-Time Streaming

```typescript
// Correct: Start from latest block
evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
  query: { from: "latest" }, // Real-time
})

// Wrong: Historical range
evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
  query: { from: 21_000_000, to: 21_100_000 }, // Not real-time
})
```

### 2. Only Alert on Finalized Blocks

```typescript
const finalizedHeight = batch.ctx.head.finalized?.number ?? 0;

const alertableEvents = batch.data.filter(
  (event) => event.blockNumber <= finalizedHeight
);

// Only send alerts for finalized events to avoid reorg confusion
```

### 3. Use Parameter Filtering for Efficiency

```typescript
// Correct: Filter server-side for specific addresses
evmDecoder({
  events: {
    transfer: {
      abi: commonAbis.erc20.events.Transfer,
      filter: {
        from: [KNOWN_WHALE_ADDRESS_1, KNOWN_WHALE_ADDRESS_2],
        // OR
        to: [KNOWN_CEX_ADDRESS],
      },
    },
  },
})

// Wrong: Fetch all events and filter client-side
evmDecoder({
  events: { transfer: commonAbis.erc20.events.Transfer },
}).pipe((data) => {
  return data.transfer.filter((t) => whaleAddresses.includes(t.event.from));
});
```

## Common Monitoring Bot Use Cases

### Whale Alerts
- Track large transfers (> $1M)
- Monitor known whale addresses
- Alert on CEX deposit/withdrawal activity

### MEV Detection
- Monitor sandwich attacks on DEX pools
- Track large swaps before price impact
- Detect liquidations before they happen

### Smart Contract Events
- New pool creation (Uniswap/Sushiswap)
- Governance proposals
- Token mints/burns
- Oracle price updates

### Price Impact Warnings
- Large swaps that move price > 5%
- Flash loan attacks
- Unusual trading patterns

## Best Practices for Monitoring Bots

- **Start with `from: "latest"`** for real-time monitoring
- **Only alert on finalized blocks** to avoid reorg confusion
- **Implement rate limiting** to avoid webhook throttling
- **Add retry logic** for failed webhook requests
- **Use parameter filtering** to reduce bandwidth
- **Log all alerts** for debugging and audit trail
- **Monitor bot health** with heartbeat checks
- **Set up alert deduplication** to avoid spam
- **Use environment variables** for webhook URLs and API keys
- **Test with historical data** before going live

## Performance Considerations

- **Memory**: Monitoring bots use minimal memory (~50-100 MB)
- **Latency**: Alerts typically sent within 5-15 seconds of block finalization
- **Throughput**: Can handle thousands of events/second, limited by webhook rate limits
- **Reliability**: Use `/finalized-stream` endpoint for production bots
