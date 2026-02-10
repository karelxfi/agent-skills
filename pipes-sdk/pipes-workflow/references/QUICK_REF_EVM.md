# EVM Indexer Quick Reference

**Last Updated**: 2026-01-31

---

## ClickHouse SQL Patterns (Common Mistakes Fixed)

### Pattern 1: Always Use Explicit Column Aliases

**Problem**: ClickHouse returns qualified column names when using table aliases

**Wrong** (returns "e.chain" instead of "chain"):
```sql
SELECT
  e.chain,
  e.block_number
FROM events e
```

**Correct** (returns "chain"):
```sql
SELECT
  e.chain AS chain,
  e.block_number AS block_number
FROM events e
```

**Why this matters**: JSON export and CSV files use column names directly. Without explicit aliases, you'll get "e.chain" in your CSV header instead of "chain".

---

### Pattern 2: BigInt Arithmetic (Don't Lose Precision!)

**Problem**: EVM amounts are uint256 (stored as String), need conversion for math

**Wrong** (divides strings, returns NULL):
```sql
SELECT amount / decimals as value
FROM token_transfers
```

**Correct** (converts to float first):
```sql
SELECT
  toFloat64(amount) / pow(10, decimals) as value
FROM token_transfers
```

**For USD calculations**:
```sql
SELECT
  (toFloat64(amount) / pow(10, decimals)) * price_usd as value_usd
FROM token_transfers t
JOIN token_prices p ON t.token_address = p.token_address
```

---

### Pattern 3: Time-Series Aggregations

**Daily aggregation from Unix timestamp**:
```sql
SELECT
  toDate(toDateTime(toUInt32(timestamp))) as date,
  COUNT(*) as events_count,
  SUM(toFloat64(amount)) as total_amount
FROM events
GROUP BY date
ORDER BY date DESC
```

**Hourly aggregation**:
```sql
SELECT
  toStartOfHour(toDateTime(toUInt32(timestamp))) as hour,
  COUNT(*) as events_count
FROM events
GROUP BY hour
ORDER BY hour DESC
```

---

### Pattern 4: Cumulative Sums (TVL Over Time)

**Window function for running totals**:
```sql
SELECT
  date,
  chain,
  daily_change,
  SUM(daily_change) OVER (
    PARTITION BY chain
    ORDER BY date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) as cumulative_total
FROM daily_changes
ORDER BY chain, date
```

**Alternative using subquery** (if window functions don't work):
```sql
SELECT
  d1.date,
  d1.chain,
  d1.daily_change,
  SUM(d2.daily_change) as cumulative_total
FROM daily_changes d1
JOIN daily_changes d2 ON
  d1.chain = d2.chain AND
  d2.date <= d1.date
GROUP BY d1.date, d1.chain, d1.daily_change
ORDER BY d1.chain, d1.date
```

---

### Pattern 5: JOIN Patterns for Price Data

**Basic price lookup**:
```sql
SELECT
  e.block_number,
  e.token_address,
  (toFloat64(e.amount) / pow(10, tm.decimals)) * p.price_usd as amount_usd
FROM events e
LEFT JOIN token_metadata tm ON
  e.token_address = tm.address AND
  e.chain = tm.chain
LEFT JOIN token_prices p ON
  e.token_address = p.token_address AND
  e.chain = p.chain
WHERE p.price_usd > 0
```

**Time-based price lookup** (use closest price):
```sql
SELECT
  e.block_number,
  e.timestamp,
  e.token_address,
  (toFloat64(e.amount) / pow(10, tm.decimals)) * p.price_usd as amount_usd
FROM events e
LEFT JOIN token_metadata tm ON
  e.token_address = tm.address AND
  e.chain = tm.chain
LEFT JOIN LATERAL (
  SELECT price_usd
  FROM token_prices
  WHERE token_address = e.token_address
    AND chain = e.chain
    AND timestamp <= e.timestamp
  ORDER BY timestamp DESC
  LIMIT 1
) p
```

---

### Pattern 6: Handling NULL Values

**Count NULL values**:
```sql
SELECT
  countIf(from_address IS NULL) as null_from,
  countIf(to_address IS NULL) as null_to,
  countIf(value IS NULL) as null_value,
  countIf(value IS NOT NULL) as valid_count
FROM transfers
```

**Replace NULL with default**:
```sql
SELECT
  coalesce(chain, 'unknown') as chain,
  coalesce(price_usd, 0) as price_usd
FROM events
```

---

### Pattern 7: String Operations on Addresses

**Lowercase addresses for comparison**:
```sql
SELECT *
FROM events
WHERE lower(token_address) = lower('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
```

**Extract first N characters**:
```sql
SELECT
  substring(market_id, 1, 42) as loan_token_address,
  substring(market_id, 43, 42) as collateral_token_address
FROM morpho_markets
```

---

### Pattern 8: GROUP BY with Multiple Aggregations

**Per-chain summary**:
```sql
SELECT
  chain,
  
  -- Supply metrics
  SUM(
    CASE WHEN event_type = 'Supply'
    THEN toFloat64(amount) / pow(10, decimals)
    ELSE 0 END
  ) as total_supply,
  
  -- Borrow metrics
  SUM(
    CASE WHEN event_type = 'Borrow'
    THEN toFloat64(amount) / pow(10, decimals)
    ELSE 0 END
  ) as total_borrow,
  
  -- Count metrics
  countIf(event_type = 'Supply') as supply_count,
  countIf(event_type = 'Borrow') as borrow_count,
  
  -- Unique users
  uniqExact(user_address) as unique_users

FROM events
GROUP BY chain
ORDER BY total_supply DESC
```

---

### Pattern 9: Top N with LIMIT

**Top 10 markets by TVL**:
```sql
SELECT
  chain,
  market_id,
  SUM(
    CASE
      WHEN event_type = 'Supply' THEN toFloat64(amount)
      WHEN event_type = 'Withdraw' THEN -toFloat64(amount)
      ELSE 0
    END
  ) / pow(10, decimals) as tvl
FROM events
GROUP BY chain, market_id, decimals
HAVING tvl > 0
ORDER BY tvl DESC
LIMIT 10
```

---

### Pattern 10: Export to CSV

**From ClickHouse query**:
```sql
SELECT
  date,
  chain,
  borrow_volume_usd,
  borrow_count
FROM daily_metrics
ORDER BY date DESC
FORMAT CSV
```

**From TypeScript (using ClickHouse client)**:
```typescript
const result = await client.query({
  query: `SELECT * FROM daily_metrics ORDER BY date DESC`,
  format: "JSONEachRow"
})

const data = await result.json()

// Convert to CSV
const csv = [
  "date,chain,volume,count",  // Header
  ...data.map(row => `${row.date},${row.chain},${row.volume},${row.count}`)
].join("\n")

fs.writeFileSync("output.csv", csv)
```

---

## Common Errors & Fixes

### Error: "Cannot read property 'map' of undefined"
**Cause**: Event key mismatch between decoder and pipe
```typescript
// Decoder has 'transfers', pipe uses 'transfer' (wrong)
evmDecoder({ events: { transfers: erc20.Transfer } })
.pipe(({ transfer }) => transfer.map(...))  // undefined!
```

**Fix**: Use matching key
```typescript
.pipe(({ transfers }) => transfers.map(...))  // matches decoder
```

---

### Error: "Authentication failed"
**Cause**: Missing ClickHouse username/password

**Wrong**:
```typescript
const client = createClient({
  url: "http://localhost:8123"
})
```

**Correct**:
```typescript
const client = createClient({
  url: "http://localhost:8123",
  username: "default",
  password: "default"  // or actual password from container
})
```

---

### Error: "undefined" in CSV chain column
**Cause**: SQL column alias not explicit

**Wrong**:
```sql
SELECT e.chain, COUNT(*) FROM events e GROUP BY e.chain
-- Returns column named "e.chain"
```

**Correct**:
```sql
SELECT e.chain AS chain, COUNT(*) as count FROM events e GROUP BY chain
-- Returns column named "chain"
```

---

## Quick Patterns Cheat Sheet

```typescript
// 1. Basic event tracking
evmDecoder({
  range: { from: "21000000" },
  contracts: ["0xAddress"],
  events: { transfers: commonAbis.erc20.events.Transfer }
})

// 2. Factory pattern
evmDecoder({
  contracts: factory({
    address: "0xFactory",
    event: factoryAbi.events.PairCreated,
    parameter: "pair",
    database: factorySqliteDatabase({ path: "./pools.sqlite" })
  }),
  events: { swaps: pairAbi.events.Swap }
})

// 3. Event parameter filtering (2025 feature)
evmDecoder({
  events: {
    deposits: {
      event: commonAbis.erc20.events.Transfer,
      params: { to: VAULT_ADDRESS }  // Only transfers TO vault
    }
  }
})

// 4. Multi-event tracking
evmDecoder({
  events: {
    supplies: morphoAbi.events.Supply,
    withdrawals: morphoAbi.events.Withdraw,
    borrows: morphoAbi.events.Borrow,
    repays: morphoAbi.events.Repay
  }
})
```

---

## Related Documentation

- **INDEXER_WORKFLOW.md** - Step-by-step indexer creation
- **CHAIN_NAME_MAPPING.md** - Chain name validation
- **CLICKHOUSE_MCP_USAGE.md** - Query indexed data with MCP
- **new-indexer.md** - CLI usage guide
