---
name: portal-dataset-discovery
description: Find and verify correct SQD Portal dataset names for blockchain queries. Learn Portal naming conventions and dataset verification methods.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "1.0.0"
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

**Testnets follow same pattern:**
- `ethereum-sepolia`
- `arbitrum-sepolia`
- `base-sepolia`

---

## Common Blockchain Name Mappings

### Ethereum & L2s

| Common Name | Portal Dataset Name | Type |
|-------------|-------------------|------|
| Ethereum | `ethereum-mainnet` | EVM |
| Ethereum Sepolia | `ethereum-sepolia` | EVM |
| Arbitrum | `arbitrum-one` | EVM |
| Arbitrum Sepolia | `arbitrum-sepolia` | EVM |
| Optimism | `optimism-mainnet` | EVM |
| Optimism Sepolia | `optimism-sepolia` | EVM |
| Base | `base-mainnet` | EVM |
| Base Sepolia | `base-sepolia` | EVM |
| Polygon | `polygon-mainnet` | EVM |
| Polygon zkEVM | `polygon-zkevm-mainnet` | EVM |
| zkSync Era | `zksync-mainnet` | EVM |
| Scroll | `scroll-mainnet` | EVM |
| Linea | `linea-mainnet` | EVM |
| Blast | `blast-mainnet` | EVM |
| Mantle | `mantle-mainnet` | EVM |
| Mode | `mode-mainnet` | EVM |

### Alt-L1 Chains

| Common Name | Portal Dataset Name | Type |
|-------------|-------------------|------|
| BSC / Binance Smart Chain | `binance-mainnet` | EVM |
| Avalanche C-Chain | `avalanche-mainnet` | EVM |
| Fantom | `fantom-mainnet` | EVM |
| Gnosis Chain | `gnosis-mainnet` | EVM |
| Moonbeam | `moonbeam-mainnet` | EVM |
| Moonriver | `moonriver-mainnet` | EVM |
| Celo | `celo-mainnet` | EVM |

### Non-EVM Chains

| Common Name | Portal Dataset Name | Type |
|-------------|-------------------|------|
| Solana | `solana-mainnet` | Solana |
| Hyperliquid | `hyperliquid-mainnet` | Hyperliquid |

---

## How to Verify Dataset Names

### Method 1: Check Portal Endpoint

**Test if a dataset exists by querying its metadata endpoint:**

```bash
curl -I https://portal.sqd.dev/datasets/{dataset-name}/metadata
```

**Response codes:**
- `200 OK` = Dataset exists ✅
- `404 Not Found` = Dataset doesn't exist or wrong name ❌

**Examples:**

```bash
# Correct name - returns 200
curl -I https://portal.sqd.dev/datasets/ethereum-mainnet/metadata

# Wrong name - returns 404
curl -I https://portal.sqd.dev/datasets/ethereum/metadata

# Correct Arbitrum name - returns 200
curl -I https://portal.sqd.dev/datasets/arbitrum-one/metadata

# Wrong Arbitrum name - returns 404
curl -I https://portal.sqd.dev/datasets/arbitrum-mainnet/metadata
```

---

### Method 2: Check schemas.json Reference

**Portal maintains a canonical list of datasets:**

**Source:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json

This JSON file contains all available datasets with their schemas and metadata.

**Structure:**
```json
{
  "ethereum-mainnet": {
    "database": "evm",
    "tables": ["blocks", "transactions", "logs", "traces", "statediffs"]
  },
  "arbitrum-one": {
    "database": "evm",
    "tables": ["blocks", "transactions", "logs", "traces", "statediffs"]
  },
  "solana-mainnet": {
    "database": "solana",
    "tables": ["blocks", "transactions"]
  }
}
```

---

### Method 3: Check Portal Documentation

**Official documentation lists available datasets:**

- EVM datasets: https://beta.docs.sqd.dev/api/catalog/stream
- Solana datasets: https://beta.docs.sqd.dev/api/catalog/solana/stream

**Look for the "Available datasets" or "Supported networks" section.**

---

## Understanding Dataset Types

**Portal supports 3 database types:**

### 1. EVM (Ethereum Virtual Machine)

**Tables:** blocks, transactions, logs, traces, statediffs

**Chains:** Ethereum, Arbitrum, Base, Optimism, Polygon, BSC, etc.

**Query example:**
```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "logs": [{"address": ["0x..."]}]
}
```

---

### 2. Solana

**Tables:** blocks, transactions

**Chains:** Solana mainnet

**Query example:**
```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "instructions": [{"programId": ["JUP6..."]}]
}
```

---

### 3. Hyperliquid

**Tables:** blocks, transactions

**Chains:** Hyperliquid mainnet

**Query example:**
```json
{
  "type": "hyperliquid",
  "fromBlock": 1000000,
  "transactions": [{}]
}
```

---

## Query URL Structure

**Portal Stream API endpoint structure:**

```
POST https://portal.sqd.dev/datasets/{dataset-name}/stream
```

**Examples:**

```bash
# Ethereum mainnet
POST https://portal.sqd.dev/datasets/ethereum-mainnet/stream

# Base mainnet
POST https://portal.sqd.dev/datasets/base-mainnet/stream

# Arbitrum One
POST https://portal.sqd.dev/datasets/arbitrum-one/stream

# Solana mainnet
POST https://portal.sqd.dev/datasets/solana-mainnet/stream
```

---

## Examples

### Example 1: Querying Ethereum

```json
POST https://portal.sqd.dev/datasets/ethereum-mainnet/stream

{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "logs": [{
    "address": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]
  }]
}
```

**Dataset:** `ethereum-mainnet` ✅
**Not:** "ethereum", "eth-mainnet", or "mainnet"

---

### Example 2: Querying Base

```json
POST https://portal.sqd.dev/datasets/base-mainnet/stream

{
  "type": "evm",
  "fromBlock": 10000000,
  "toBlock": 10000100,
  "logs": [{
    "address": ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"]
  }]
}
```

**Dataset:** `base-mainnet` ✅
**Not:** "base", "base-network", or "coinbase-base"

---

### Example 3: Querying Arbitrum

```json
POST https://portal.sqd.dev/datasets/arbitrum-one/stream

{
  "type": "evm",
  "fromBlock": 180000000,
  "toBlock": 180001000,
  "transactions": [{
    "to": ["0x1234567890123456789012345678901234567890"]
  }]
}
```

**Dataset:** `arbitrum-one` ✅
**Not:** "arbitrum", "arbitrum-mainnet", or "arb"

---

### Example 4: Querying Solana

```json
POST https://portal.sqd.dev/datasets/solana-mainnet/stream

{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"]
  }]
}
```

**Dataset:** `solana-mainnet` ✅
**Not:** "solana", "sol-mainnet", or "solana-network"

---

## Common Mistakes

### ❌ Mistake 1: Using Common Name Instead of Portal Name

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

### ❌ Mistake 2: Inconsistent Naming Pattern

**Wrong assumptions:**
```
❌ "ethereum-mainnet" exists, so "arbitrum-mainnet" should exist
❌ Mainnet suffix is always "-mainnet"
❌ All chains follow the same pattern
```

**Reality:**
```
✅ "ethereum-mainnet" exists
✅ "arbitrum-one" exists (not arbitrum-mainnet)
✅ Naming is not perfectly consistent - always verify
```

---

### ❌ Mistake 3: Assuming DeFiLlama/Etherscan Names

**Different platforms use different names:**

| Blockchain | DeFiLlama | Portal | Etherscan |
|-----------|-----------|--------|-----------|
| Arbitrum | arbitrum | arbitrum-one | arbiscan.io |
| BSC | bsc | binance-mainnet | bscscan.com |
| zkSync Era | zksync-era | zksync-mainnet | explorer.zksync.io |

**Always use Portal-specific names when querying Portal API.**

---

### ❌ Mistake 4: Not Verifying Before Querying

**Bad workflow:**
1. Assume dataset name
2. Query fails with 404
3. Try different names
4. Eventually find correct name

**Good workflow:**
1. Check mapping table (this skill)
2. Verify with curl -I if unsure
3. Query with correct name
4. Success on first try

---

## Quick Reference: Top 20 Chains

**Copy-paste reference for most common chains:**

```json
{
  "Ethereum": "ethereum-mainnet",
  "Arbitrum": "arbitrum-one",
  "Base": "base-mainnet",
  "Optimism": "optimism-mainnet",
  "Polygon": "polygon-mainnet",
  "BSC": "binance-mainnet",
  "Avalanche": "avalanche-mainnet",
  "zkSync Era": "zksync-mainnet",
  "Blast": "blast-mainnet",
  "Scroll": "scroll-mainnet",
  "Linea": "linea-mainnet",
  "Mantle": "mantle-mainnet",
  "Polygon zkEVM": "polygon-zkevm-mainnet",
  "Fantom": "fantom-mainnet",
  "Gnosis": "gnosis-mainnet",
  "Celo": "celo-mainnet",
  "Moonbeam": "moonbeam-mainnet",
  "Moonriver": "moonriver-mainnet",
  "Mode": "mode-mainnet",
  "Solana": "solana-mainnet"
}
```

---

## Testnets

**Portal supports testnets for major chains:**

```json
{
  "Ethereum Sepolia": "ethereum-sepolia",
  "Arbitrum Sepolia": "arbitrum-sepolia",
  "Base Sepolia": "base-sepolia",
  "Optimism Sepolia": "optimism-sepolia"
}
```

**Note:** Not all chains have testnet datasets. Mainnets are prioritized.

---

## Discovery Workflow

**When working with a new blockchain:**

1. **Check the mapping table in this skill**
   - Look for your blockchain in the tables above

2. **If not found, check schemas.json**
   - Visit: https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json
   - Search for your blockchain name

3. **Verify the dataset exists**
   ```bash
   curl -I https://portal.sqd.dev/datasets/{dataset-name}/metadata
   ```

4. **Use the verified name in queries**
   ```
   POST https://portal.sqd.dev/datasets/{dataset-name}/stream
   ```

---

## Related Skills

- **portal-query-evm-logs** - Query EVM chain logs (use correct dataset name)
- **portal-query-evm-transactions** - Query EVM transactions (use correct dataset name)
- **portal-query-evm-traces** - Query EVM traces (use correct dataset name)
- **portal-query-solana-instructions** - Query Solana instructions (use "solana-mainnet")

---

## Additional Resources

- **Portal Documentation:** https://beta.docs.sqd.dev/api/catalog/stream
- **Schemas Reference:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json
- **Portal API Endpoint:** https://portal.sqd.dev/datasets/{dataset-name}/stream
- **Dataset Metadata:** https://portal.sqd.dev/datasets/{dataset-name}/metadata

---

## Pro Tips

### Tip 1: Bookmark Common Names

**Create a local reference file with your most-used chains:**

```json
{
  "ethereum": "ethereum-mainnet",
  "arbitrum": "arbitrum-one",
  "base": "base-mainnet",
  "optimism": "optimism-mainnet"
}
```

---

### Tip 2: Test First, Query Second

**Always verify dataset name before building complex queries:**

```bash
# Quick verification (returns 200 if exists)
curl -I https://portal.sqd.dev/datasets/arbitrum-one/metadata

# Then query confidently
curl -X POST https://portal.sqd.dev/datasets/arbitrum-one/stream \
  -H "Content-Type: application/json" \
  -d '{"type":"evm","fromBlock":180000000,"logs":[...]}'
```

---

### Tip 3: Watch for New Datasets

**Portal adds new chains regularly. Check schemas.json periodically for updates.**

**Current count:** 225+ blockchain datasets (as of 2024)

---

### Tip 4: Use Consistent Naming in Your Code

**Store dataset names as constants:**

```typescript
const PORTAL_DATASETS = {
  ETHEREUM: 'ethereum-mainnet',
  ARBITRUM: 'arbitrum-one',
  BASE: 'base-mainnet',
  OPTIMISM: 'optimism-mainnet',
  BSC: 'binance-mainnet',
  SOLANA: 'solana-mainnet'
} as const;

// Use:
const url = `https://portal.sqd.dev/datasets/${PORTAL_DATASETS.ARBITRUM}/stream`;
```

This prevents typos and makes refactoring easier.
