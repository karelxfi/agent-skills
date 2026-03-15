---
name: portal-dataset-discovery
description: Find and verify correct SQD Portal dataset names for blockchain queries. Learn Portal naming conventions and dataset verification methods.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "2.0.0"
  category: portal-core
---

## When to Use This Skill

Use this skill when you need to:
- Find the correct Portal dataset name for a blockchain
- Understand Portal naming conventions
- Map common blockchain names to Portal names
- Discover available Portal datasets
- Verify a dataset exists before querying

**This is foundational knowledge** - you must use the correct dataset name or queries will fail.

---

## Critical Concept: Portal Names ≠ Common Names

**Portal uses specific naming conventions that often differ from common blockchain names.**

**Common mistake:**
```
❌ "ethereum" → Should be "ethereum-mainnet"
❌ "arbitrum" → Should be "arbitrum-one"
❌ "bsc" → Should be "binance-mainnet"
```

**Always verify the Portal dataset name before querying.**

---

## Portal Dataset Naming Convention

**Pattern:** `{chain}-{network}`

**Examples:**
- `ethereum-mainnet` (not "ethereum")
- `arbitrum-one` (not "arbitrum" or "arbitrum-mainnet")
- `base-mainnet` (not "base")
- `polygon-mainnet` (not "polygon" or "matic")

---

## Common Chain Name Mappings

### Top Chains (Quick Reference)

| Common Name | Portal Dataset Name | Type |
|-------------|-------------------|------|
| Ethereum | `ethereum-mainnet` | EVM |
| Arbitrum | `arbitrum-one` | EVM |
| Base | `base-mainnet` | EVM |
| Optimism | `optimism-mainnet` | EVM |
| Polygon | `polygon-mainnet` | EVM |
| BSC / Binance Smart Chain | `binance-mainnet` | EVM |
| Avalanche C-Chain | `avalanche-mainnet` | EVM |
| zkSync Era | `zksync-mainnet` | EVM |
| Blast | `blast-l2-mainnet` | EVM |
| Scroll | `scroll-mainnet` | EVM |
| Linea | `linea-mainnet` | EVM |
| Gnosis Chain | `gnosis-mainnet` | EVM |
| Solana | `solana-mainnet` | Solana |
| HyperEVM | `hyperliquid-mainnet` | EVM |
| Hyperliquid Fills | `hyperliquid-fills` | HyperliquidFills |

**Testnets:** `ethereum-sepolia`, `arbitrum-sepolia`, `base-sepolia`, `optimism-sepolia`

> **Full mapping:** See `references/full-chain-mapping.md` for the complete list including all L2s, alt-L1s, and testnets.

---

## How to Verify Dataset Names

### Method 1: Check Portal Endpoint

```bash
curl -I https://portal.sqd.dev/datasets/{dataset-name}/metadata
```

- `200 OK` = Dataset exists
- `404 Not Found` = Dataset doesn't exist or wrong name

```bash
# Correct name - returns 200
curl -I https://portal.sqd.dev/datasets/ethereum-mainnet/metadata

# Wrong name - returns 404
curl -I https://portal.sqd.dev/datasets/ethereum/metadata
```

### Method 2: Check schemas.json Reference

**Source:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json

Contains all available datasets with schemas and metadata.

### Method 3: Check Portal Documentation

- EVM datasets: https://beta.docs.sqd.dev/api/catalog/stream
- Solana datasets: https://beta.docs.sqd.dev/api/catalog/solana/stream

---

## Understanding Dataset Types

**Portal supports 3 database types:**

### 1. EVM (Ethereum Virtual Machine)

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "logs": [{"address": ["0x..."]}]
}
```

**Chains:** Ethereum, Arbitrum, Base, Optimism, Polygon, BSC, and 200+ more

### 2. Solana

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "instructions": [{"programId": ["JUP6..."]}]
}
```

### 3. Hyperliquid

```json
{
  "type": "hyperliquidFills",
  "fromBlock": 800000000,
  "fills": [{"coin": ["BTC"]}]
}
```

**Note:** HyperEVM (`hyperliquid-mainnet`) uses the standard `"type": "evm"`.

---

## Query URL Structure

```
POST https://portal.sqd.dev/datasets/{dataset-name}/stream
```

**Examples:**
```bash
POST https://portal.sqd.dev/datasets/ethereum-mainnet/stream
POST https://portal.sqd.dev/datasets/arbitrum-one/stream
POST https://portal.sqd.dev/datasets/solana-mainnet/stream
POST https://portal.sqd.dev/datasets/hyperliquid-fills/stream
```

---

## Common Mistakes

### ❌ Using Common Name Instead of Portal Name

**Wrong:**
```
POST /datasets/ethereum/stream
POST /datasets/arbitrum/stream
POST /datasets/bsc/stream
```

**Correct:**
```
POST /datasets/ethereum-mainnet/stream
POST /datasets/arbitrum-one/stream
POST /datasets/binance-mainnet/stream
```

---

### ❌ Inconsistent Naming Pattern

**Wrong assumptions:**
```
❌ "ethereum-mainnet" exists, so "arbitrum-mainnet" should exist
❌ Mainnet suffix is always "-mainnet"
```

**Reality:**
```
✅ "ethereum-mainnet" exists
✅ "arbitrum-one" exists (not arbitrum-mainnet)
✅ Naming is not perfectly consistent - always verify
```

---

### ❌ Not Verifying Before Querying

**Good workflow:**
1. Check mapping table (this skill)
2. Verify with `curl -I` if unsure
3. Query with correct name

---

## Discovery Workflow

**When working with a new blockchain:**

1. **Check the mapping table in this skill** (or `references/full-chain-mapping.md`)

2. **If not found, check schemas.json:**
   - Visit: https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json

3. **Verify the dataset exists:**
   ```bash
   curl -I https://portal.sqd.dev/datasets/{dataset-name}/metadata
   ```

4. **Use the verified name in queries**

**Note:** Some chains on other platforms (like DeFiLlama) may not be supported by Portal. Always verify.

---

## Related Skills

- **portal-query-evm-logs** - Query EVM chain logs (use correct dataset name)
- **portal-query-evm-transactions** - Query EVM transactions
- **portal-query-evm-traces** - Query EVM traces
- **portal-query-solana-instructions** - Query Solana instructions (use "solana-mainnet")
- **portal-query-hyperliquid-fills** - Query Hyperliquid trade fills data

---

## Additional Resources

- **[Available Datasets](https://portal.sqd.dev/datasets)** - Complete list of all supported networks (PRIMARY RESOURCE)
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Portal API
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Portal documentation
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/en/api/catalog/evm/openapi.yaml)** - Complete Portal API specification
- **[Solana OpenAPI Schema](https://beta.docs.sqd.dev/en/api/catalog/solana/openapi.yaml)** - Solana API specification
- **[Hyperliquid Fills OpenAPI](https://beta.docs.sqd.dev/en/api/catalog/hyperliquid-fills/openapi.yaml)** - Hyperliquid API specification
