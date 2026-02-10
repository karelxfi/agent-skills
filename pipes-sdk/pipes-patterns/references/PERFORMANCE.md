# Performance Optimization

## Throughput Benchmarks

Performance varies by hardware, network, and dataset. Example observations from testing:

| Pattern | Observed Events/Second | Notes |
|---------|----------------------|-------|
| Simple EVM decoder | ~23,000 | Single contract, no transformations |
| EVM with ClickHouse | ~18,000 | Includes database writes |
| EVM with PostgreSQL | ~12,000 | YMMV depending on database setup |
| pipeComposite (3 decoders) | ~15,000 | Parallel decoding overhead |
| Multi-stage (4 stages) | ~8,000 | Each stage adds overhead |
| Solana decoder | ~10,000 | More complex data structures |
| Custom target (JSON files) | ~14,000 | File I/O overhead |
| Memory target | ~25,000 | No persistence overhead |

**Note**: These are reference values. Actual performance depends on your infrastructure, network conditions, and data complexity.

## Optimization Techniques

### 1. Use Parameter Filtering

Parameter filtering significantly reduces bandwidth by filtering server-side instead of client-side.

```typescript
// FILE: src/index.ts
// DEPENDENCIES: @subsquid/pipes@^5.0.0

// Bad: Fetch all events, filter client-side
evmDecoder({
  events: { transfer: commonAbis.erc20.events.Transfer },
}).pipe((data) => {
  return data.transfer.filter(t => t.event.from === TARGET_ADDRESS);
});

// Good: Filter server-side
evmDecoder({
  events: {
    transfer: {
      abi: commonAbis.erc20.events.Transfer,
      filter: { from: [TARGET_ADDRESS] },
    },
  },
});
```

**Performance Impact**: In a USDC transfer scenario with 84,248 total events:

| Filter Type | Effect |
|-------------|--------|
| No filter | Fetches all events |
| Single address filter | Fetches only events matching that address |
| Multiple addresses | Fetches events matching any of the addresses |

**Impact**: Server-side filtering reduces bandwidth and processing significantly when targeting specific addresses.

### 2. Minimize Transformation Stages

Each transformation stage adds overhead. Combine operations when possible.

```typescript
// Bad: 4 separate pipes
.pipe(stage1)
.pipe(stage2)
.pipe(stage3)
.pipe(stage4)

// Good: Combine into 1-2 stages
.pipe((data) => {
  // Do all transformations here
  return stage4(stage3(stage2(stage1(data))));
})
```

**Impact**: Each stage adds processing overhead. Multi-stage pipelines can reduce throughput by 50-70%.

### 3. Choose Appropriate Target for Your Workload

ClickHouse is optimized for analytics and bulk inserts, while PostgreSQL provides ACID transactions and relational queries.

```typescript
// ClickHouse: Optimized for analytics, columnar storage
clickhouseTarget({ /* config */ })

// PostgreSQL: ACID transactions, relational queries
drizzleTarget({ /* config */ })
```

Test both with your specific workload to determine which performs better for your use case.

**Typical Performance**:
- ClickHouse: ~18,000 events/second (analytics workloads)
- PostgreSQL: ~12,000 events/second (transactional workloads)

### 4. Batch Inserts

Batch inserts significantly reduce transaction overhead compared to individual inserts.

```typescript
// Bad: Insert one at a time
for (const transfer of data.transfer) {
  await db.insert(transfers).values(transfer);
}

// Good: Batch insert
await db.insert(transfers).values(data.transfer);
```

**Impact**: Batch inserts are 10-100x faster than individual inserts depending on batch size.

### 5. Use Pre-Indexing for Factory Patterns

Pre-indexing can significantly improve performance when you have a known list of contract addresses.

```typescript
// Slow: Wildcard (but discovers all contracts)
wildcardContracts: [{ address: "*", events: { swap } }]

// Fast: Pre-indexed list (if you know addresses)
contracts: [pool1, pool2, pool3, ...]
```

**Comparison**:

| Approach | Setup Time | Stream Characteristics | When to Use |
|----------|-----------|----------------------|-------------|
| Wildcard | None | Scans all contracts | Unknown contracts, discovery |
| Pre-index | Upfront fetch | Targeted streaming | Known contract list |

## Memory Usage

Example observations from testing (varies by dataset size and system):

| Pipeline Type | Observed Memory | Notes |
|--------------|----------------|-------|
| Simple decoder | 50-100 MB | Minimal buffering |
| ClickHouse target | 100-200 MB | Batch buffering |
| PostgreSQL target | 100-250 MB | Transaction overhead |
| Memory target | 500 MB - 10 GB | Stores all data in RAM |
| Multi-stage | 200-500 MB | Intermediate buffers |

**Recommendations**:
- Keep memory usage < 500 MB for normal pipelines
- Use database targets for datasets > 10M records
- Monitor memory usage with `process.memoryUsage()`

## Portal vs RPC Latency

Portal typically delivers blocks faster than public RPC endpoints. In one test scenario:
- Portal delivered blocks within 0-100ms
- Public RPC endpoints were 900-1200ms slower
- Private RPC endpoints were 200-500ms slower

**Note**: Latency varies by network conditions, RPC provider, and geographic location. Portal is designed for production indexing workloads.

### RPC Latency Monitoring

Track Portal vs RPC latency in real-time:

```typescript
// FILE: src/index.ts
// DEPENDENCIES: @subsquid/pipes@^5.0.0, ws@^8.18.0

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
    
    return data;
  })
);
```

## Optimization Checklist

- [ ] **Use server-side parameter filtering** for known addresses
- [ ] **Minimize transformation stages** (1-2 stages max)
- [ ] **Batch database inserts** (never insert one-by-one)
- [ ] **Choose appropriate database** (ClickHouse vs PostgreSQL)
- [ ] **Use pre-indexing** for factory patterns when possible
- [ ] **Monitor memory usage** (keep < 500 MB)
- [ ] **Profile with metrics** (enable profiling in development)
- [ ] **Test with small ranges** before full deployment
- [ ] **Use Portal over public RPC** for bulk data access
- [ ] **Monitor throughput** (should be > 10,000 events/second)

## Profiling

Enable profiling to measure performance:

```typescript
evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/ethereum-mainnet",
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

## Performance Debugging

If pipeline is slow:

- **Enable profiling** to identify bottleneck
- **Check server-side filtering** - are you fetching unnecessary data?
- **Count transformation stages** - can you combine them?
- **Check database performance** - are indexes missing?
- **Monitor memory** - are you buffering too much?
- **Test target in isolation** - is database the bottleneck?
- **Compare with benchmarks** - is hardware sufficient?

## High-Volume Chain Optimization

For high-throughput chains (Base, Polygon):

```typescript
// FILE: src/index.ts
// DEPENDENCIES: @subsquid/pipes@^5.0.0

const stream = evmPortalSource({
  portal: "https://portal.sqd.dev/datasets/base-mainnet",
}).pipe(
  evmDecoder({
    range: { from: 10_000_000, to: 10_010_000 },
    contracts: [USDC_BASE_ADDRESS],
    events: {
      transfer: {
        abi: commonAbis.erc20.events.Transfer,
        // Filter whale transfers only
        filter: { from: WHALE_ADDRESSES },
      },
    },
  })
).pipe((data) => {
  // Minimal transformation
  return data.transfer.map(t => ({
    block: t.block.number,
    tx: t.rawEvent.transactionHash,
    from: t.event.from,
    to: t.event.to,
    value: t.event.value.toString(),
  }));
});

await stream.pipeTo(
  clickhouseTarget({
    connectionParams: { url: "http://localhost:8123" },
    onData: async ({ clickhouse, data }) => {
      // Single batch insert
      await clickhouse.insertTable({
        tableName: "transfers",
        values: data,
      });
    },
  })
);
```

**Performance**: 
- Base: ~50,000 events/block (vs Ethereum ~500/block)
- Throughput: ~25,000 events/second with optimizations
- Latency: ~10 seconds for 10,000 blocks
