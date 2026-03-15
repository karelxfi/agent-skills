---
name: portal-query-hyperliquid-fills
description: Construct SQD Portal Stream API queries for Hyperliquid trade fills. Track trading activity, analyze PnL, monitor specific traders, and filter by coin, side, or user.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "2.0.0"
  category: portal-core
---

## When to Use This Skill

Use this skill when you need to:
- Track trade fills on Hyperliquid (buys, sells, liquidations)
- Monitor a specific trader's activity and positions
- Analyze closed PnL for users or coins
- Track high-volume trades across all pairs
- Filter fills by coin (BTC, ETH, etc.), side (buy/sell), or user address
- Analyze fee structures and builder fees

**Hyperliquid fills** represent completed trades on the Hyperliquid perpetuals exchange. Each fill includes price, size, direction, PnL, and fee data.

---

## Query Structure

Portal Stream API uses POST requests to `/datasets/hyperliquid-fills/stream`.

**Basic Hyperliquid fills query structure:**

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 800000100,
  "fills": [{
    "coin": ["BTC"]
  }],
  "fields": {
    "fill": {
      "coin": true,
      "side": true,
      "px": true,
      "sz": true,
      "user": true
    }
  }
}
```

**Field explanations:**
- `type: "hyperliquidFills"` - **Required** (not "evm" or "solana")
- `fromBlock/toBlock` - Block range (**dataset starts at block 750000000**)
- `fills` - Array of fill filter objects (use `{}` to match all fills)
- `fields` - Must use `"fill"` key (not "log" or "transaction")

**Fill filter fields:**
- `coin` - Array of coin/pair names (e.g., `["BTC", "ETH"]`)
- `user` - Array of user addresses (e.g., `["0x258a..."]`)
- `side` - Filter by side: `"B"` (buy/bid) or `"A"` (ask/sell)

---

## Examples

### Example 1: Track All BTC Fills in a Block Range

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 800000100,
  "fills": [{
    "coin": ["BTC"]
  }],
  "fields": {
    "fill": {
      "coin": true,
      "side": true,
      "px": true,
      "sz": true,
      "user": true,
      "dir": true
    },
    "block": {
      "number": true,
      "timestamp": true
    }
  }
}
```

**Dataset:** `hyperliquid-fills`
**Notes:** `px` = execution price (float); `sz` = trade size (float); timestamps are in **milliseconds**

---

### Example 2: Monitor a Specific Trader's Activity

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 800100000,
  "fills": [{
    "user": ["0x258a0cb38645842d58e893850bae2e4b66c1e6a8"]
  }],
  "fields": {
    "fill": {
      "coin": true,
      "side": true,
      "px": true,
      "sz": true,
      "dir": true,
      "startPosition": true
    },
    "block": {
      "number": true,
      "timestamp": true
    }
  }
}
```

**Notes:**
- `dir` shows: "Open Long", "Open Short", "Close Long", "Close Short"
- `startPosition` shows the user's position size before this fill

---

### Example 3: Analyze Trading PnL for a User

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 801000000,
  "fills": [{
    "user": ["0x258a0cb38645842d58e893850bae2e4b66c1e6a8"]
  }],
  "fields": {
    "fill": {
      "coin": true,
      "side": true,
      "px": true,
      "sz": true,
      "dir": true,
      "closedPnl": true,
      "fee": true,
      "feeToken": true
    },
    "block": {"timestamp": true}
  }
}
```

**Notes:**
- `closedPnl` is only non-zero for closing trades ("Close Long" / "Close Short")
- `fee` can be negative (maker rebate)
- Net PnL = sum(closedPnl) - sum(fee)

> **More examples:** See `references/additional-examples.md` for full metadata queries, fee analysis, and side filtering.

---

## Fill Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `coin` | string | Trading pair name (e.g., "BTC", "ETH", "STRK", "@151") |
| `side` | string | `"B"` (buy/bid) or `"A"` (ask/sell) |
| `px` | float | Execution price |
| `sz` | float | Trade size/quantity |
| `user` | string | Trader's 0x address |
| `dir` | string | "Open Long", "Open Short", "Close Long", "Close Short" |
| `closedPnl` | float | Realized PnL (negative = loss, zero for opens) |
| `fee` | float | Fee amount (negative = rebate) |
| `feeToken` | string | Fee denomination (e.g., "USDC") |
| `hash` | string | Unique fill hash |
| `oid` | integer | Order ID |
| `tid` | integer | Trade ID |
| `crossed` | boolean | Whether order crossed the spread (taker) |
| `startPosition` | float | Position size before this fill |
| `cloid` | string/null | Client order ID |
| `builderFee` | float/null | Builder fee |

---

## Key Concepts

**Timestamps are in milliseconds** (unlike EVM chains which use seconds):
```json
{"header":{"number":800000000,"timestamp":1763423558592}}
// Divide by 1000 to get Unix seconds
```

**Side values:** `"B"` = Buy (bid), `"A"` = Ask (sell) — single-character codes only.

**Direction values:**
- Buy + Open = "Open Long"
- Buy + Close = "Close Short"
- Sell + Open = "Open Short"
- Sell + Close = "Close Long"

---

## Common Mistakes

### Mistake 1: Using Wrong Type Field

```json
{"type": "evm"}  // Wrong - this is not an EVM dataset
```
**Fix:** Always use `"type": "hyperliquidFills"`.

---

### Mistake 2: Using Seconds Instead of Milliseconds

Hyperliquid timestamps are in **milliseconds**. Divide by 1000 when comparing with Unix timestamps.

---

### Mistake 3: Using Full Side Names

```json
{"fills": [{"side": "buy"}]}  // Wrong
```
**Fix:** Use `"B"` for buy, `"A"` for sell.

---

### Mistake 4: Using Fields Under Wrong Key

```json
{"fields": {"log": {"coin": true}}}  // Wrong - not EVM
```
**Fix:** Use `"fill"` as the fields key.

---

### Mistake 5: Querying Blocks Before Dataset Start

```json
{"fromBlock": 0}  // Wrong - dataset starts at 750000000
```
**Fix:** Always use `fromBlock >= 750000000`.

---

### Mistake 6: Confusing Hyperliquid Datasets

- `hyperliquid-fills` - Trade fills data (this skill, use `"type": "hyperliquidFills"`)
- `hyperliquid-mainnet` - HyperEVM chain (use `"type": "evm"`)
- `hyperliquid-testnet` - HyperEVM testnet (use `"type": "evm"`)

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"number":800000000,"timestamp":1763423558592}}
{"fills":[{"user":"0x258a0cb38645842d58e893850bae2e4b66c1e6a8","coin":"STRK","px":0.19485,"sz":4000.0,"side":"B","startPosition":-500790.3,"dir":"Close Short","closedPnl":-108.16,"hash":"0x14eb...","oid":239170781574,"crossed":true,"fee":0.231871,"builderFee":null,"tid":257728986102969,"cloid":"0x019a...","feeToken":"USDC"}]}
```

**Parsing:** Split by newlines, parse each line as JSON. First line = block header. Numeric values (`px`, `sz`, `closedPnl`, `fee`) are floats.

---

## Performance Tips

- **Use specific coin filters** when possible - filtering by `coin` narrows results significantly
- **Use narrow block ranges** for broad queries (e.g., all fills with `{}` filter)
- **Combine filters** - use `coin` + `side` or `coin` + `user` for targeted queries
- **Request only needed fields** - omit `hash`, `cloid`, `builderFee` if not needed

---

## Related Skills

- **portal-query-evm-logs** - Query EVM event logs on HyperEVM (`hyperliquid-mainnet`)
- **portal-query-evm-transactions** - Query EVM transactions on HyperEVM
- **portal-dataset-discovery** - Find correct dataset names and metadata

---

## Additional Resources

- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Portal API querying
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Portal documentation
- **Hyperliquid Overview:** https://beta.docs.sqd.dev/en/portal/hyperliquid/overview
- **[Hyperliquid Fills OpenAPI](https://beta.docs.sqd.dev/en/api/catalog/hyperliquid-fills/openapi.yaml)** - Complete fills query specification
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported networks
