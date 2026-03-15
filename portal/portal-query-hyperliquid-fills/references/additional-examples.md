# Hyperliquid Fills - Additional Examples

## Example 4: Track High-Volume Trades (All Fills with Full Metadata)

**Use case:** Capture all trade fills with complete metadata for comprehensive analysis.

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 800000050,
  "fills": [{}],
  "fields": {
    "fill": {
      "coin": true,
      "side": true,
      "px": true,
      "sz": true,
      "user": true,
      "dir": true,
      "closedPnl": true,
      "fee": true,
      "feeToken": true,
      "hash": true,
      "oid": true,
      "tid": true,
      "crossed": true,
      "startPosition": true,
      "cloid": true,
      "builderFee": true
    },
    "block": {
      "number": true,
      "timestamp": true
    }
  }
}
```

**Notes:**
- Empty filter `{}` matches all fills (use narrow block ranges to avoid large responses)
- `crossed` indicates whether the order crossed the spread (taker order)
- `hash` is the unique fill hash, `tid` is the trade ID, `oid` is the order ID
- `cloid` is the client-assigned order ID (hex string or null)

---

## Example 5: Monitor Specific Coin with Fee Analysis

**Use case:** Track ETH perpetual fills and analyze fee structures.

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 800000200,
  "fills": [{
    "coin": ["ETH"]
  }],
  "fields": {
    "fill": {
      "coin": true,
      "side": true,
      "px": true,
      "sz": true,
      "user": true,
      "fee": true,
      "feeToken": true,
      "builderFee": true,
      "crossed": true
    },
    "block": {
      "number": true,
      "timestamp": true
    }
  }
}
```

**Notes:**
- `crossed: true` means taker order (pays fee), `crossed: false` means maker order (may receive rebate)
- Negative `fee` values indicate maker rebates
- `builderFee` is separate from the standard fee and may be null

---

## Example 6: Track Buys vs Sells for a Coin

**Use case:** Monitor only buy-side fills for BTC to track buying pressure.

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "toBlock": 800000100,
  "fills": [{
    "coin": ["BTC"],
    "side": "B"
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

**Notes:**
- `side: "B"` filters for buys only; use `"A"` for sells (asks)
- Combine with `dir` to distinguish between "Open Long" (new position) and "Close Short" (closing)
- To compare buys vs sells, run two queries or use `fills: [{}]` and filter client-side
