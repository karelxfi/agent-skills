---
name: portal-query-evm-logs
description: Construct SQD Portal Stream API queries for EVM event logs. Track token transfers, DeFi events, and on-chain activity using indexed topic filters.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: portal-core
---

## When to Use This Skill

Use this skill when you need to:
- Track ERC20 token transfers (Transfer events)
- Monitor DeFi protocol events (Swap, Deposit, Withdraw, etc.)
- Find events emitted by specific contracts
- Filter events by indexed parameters (addresses, token IDs, etc.)
- Analyze historical on-chain activity

**This is the most common Portal use case** - most blockchain data analysis involves event logs.

---

## Query Structure

Portal Stream API uses POST requests with JSON payloads to `/datasets/{dataset-name}/stream`.

**Basic EVM log query structure:**

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "logs": [{
    "address": ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true,
      "transactionHash": true
    }
  }
}
```

**Field explanations:**
- `type: "evm"` - Required for EVM chains
- `fromBlock/toBlock` - Block range (required)
- `logs` - Array of log filter objects
- `address` - Contract addresses to filter (INDEXED - fast)
- `topic0` - Event signature hash (INDEXED - fast)
- `topic1/2/3` - Indexed event parameters (INDEXED - fast)
- `fields` - Which fields to include in response (optimize payload size)

---

## Understanding Event Topics

**EVM event logs use topics for indexed parameters:**

```solidity
event Transfer(address indexed from, address indexed to, uint256 amount);
```

**Maps to:**
- `topic0` = keccak256("Transfer(address,address,uint256)") = `0xddf252ad...`
- `topic1` = indexed `from` address (padded to 32 bytes)
- `topic2` = indexed `to` address (padded to 32 bytes)
- `data` = non-indexed parameters (`amount`)

**Key rules:**
1. `topic0` is ALWAYS the event signature hash
2. `topic1-3` are indexed parameters in declaration order
3. Non-indexed parameters go in `data` field
4. Anonymous events don't have topic0 (rare)

---

## Examples

### Example 1: Track USDC Transfers on Base

**Use case:** Monitor all USDC transfer events on Base mainnet.

```json
{
  "type": "evm",
  "fromBlock": 10000000,
  "toBlock": 10000100,
  "logs": [{
    "address": ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true,
      "transactionHash": true,
      "blockNumber": true
    }
  }
}
```

**Dataset:** `base-mainnet`
**Contract:** USDC on Base (0x833589fcd6edb6e08f4c7c32d4f71b54bda02913)
**Event:** Transfer(address indexed from, address indexed to, uint256 amount)

---

### Example 2: Find Transfers FROM Specific Address

**Use case:** Track all ERC20 transfers sent by a specific wallet.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "logs": [{
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
    "topic1": ["0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true
    }
  }
}
```

**Notes:**
- `topic1` = sender address (vitalik.eth)
- Address is padded to 32 bytes with leading zeros
- Omitting `address` filter searches ALL contracts (slower but comprehensive)

---

### Example 3: Uniswap V3 Swap Events

**Use case:** Track Uniswap V3 pool swap events on Ethereum.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "logs": [{
    "address": ["0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"],
    "topic0": ["0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true,
      "blockNumber": true,
      "transactionHash": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** USDC/WETH 0.05% pool
**Event:** Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)

---

### Example 4: Multiple Event Types from Same Contract

**Use case:** Track both Deposit and Withdraw events from Aave lending pool.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "logs": [
    {
      "address": ["0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"],
      "topic0": ["0xde6857219544bb5b7746f48ed30be6386fefc61b2f864cacf559893bf50fd951"]
    },
    {
      "address": ["0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"],
      "topic0": ["0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7"]
    }
  ],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true
    }
  }
}
```

**Notes:**
- Multiple filter objects in `logs` array = OR logic
- Both Deposit and Withdraw events will be returned
- Same contract address for both filters

---

### Example 5: NFT Transfers with Token ID Filter

**Use case:** Track transfers of a specific NFT token ID.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "logs": [{
    "address": ["0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
    "topic3": ["0x0000000000000000000000000000000000000000000000000000000000000001"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "transactionHash": true,
      "blockNumber": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Bored Ape Yacht Club
**Event:** Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
**Filter:** Only token ID #1 (topic3)

---

## Key Concepts

### 1. Indexed vs Non-Indexed Parameters

**Indexed parameters (up to 3):**
- Stored in `topic1`, `topic2`, `topic3`
- Filterable via Portal API
- Padded to 32 bytes
- Fast to query

**Non-indexed parameters:**
- Stored in `data` field (ABI-encoded)
- NOT filterable via Portal API
- Must decode client-side
- Smaller storage footprint

**Rule:** Use indexed parameters for fields you need to filter by.

---

### 2. Filter Performance Optimization

**Field index status:**
- `address` - INDEXED (fast)
- `topic0` - INDEXED (fast)
- `topic1/2/3` - INDEXED (fast)
- `data` - NOT INDEXED (can't filter)
- `blockNumber` - INDEXED (fast)
- `transactionIndex` - INDEXED (fast)

**Best practices:**
1. Always filter by `address` if you know the contract (10-100x faster)
2. Add `topic0` filter for specific events (another 10x faster)
3. Add topic1-3 filters for further narrowing
4. Use narrow block ranges when possible

**Performance comparison:**
```
No filters: 1M+ logs/sec → Timeout risk
address only: ~100K logs/sec → Usually safe
address + topic0: ~10K logs/sec → Fast
address + topic0 + topic1: <1K logs/sec → Very fast
```

---

### 3. Field Selection Strategy

**Minimize payload size by requesting only needed fields:**

```json
{
  "fields": {
    "log": {
      "address": true,        // Contract address
      "topics": true,         // All topics array
      "data": true,           // Event data
      "transactionHash": true,// Tx hash
      "blockNumber": true,    // Block number
      "logIndex": true,       // Position in block
      "removed": true         // Chain reorg flag
    }
  }
}
```

**Common minimal field sets:**
- Event tracking: `address`, `topics`, `data`, `transactionHash`
- Volume analysis: `address`, `topics`, `blockNumber`
- Full context: all fields

**Note:** Requesting fewer fields = smaller response = faster transfer.

---

### 4. Topic Padding Rules

**Addresses in topics must be padded to 32 bytes:**

```
Original: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
Padded:   0x000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

**Padding rules:**
- Addresses: left-pad with zeros (24 zeros + 20-byte address)
- uint256: already 32 bytes (no padding needed)
- uint8/16/32/etc: left-pad with zeros
- bytes32: no padding needed

**Tool:** Use ethers.js `zeroPadValue()` or manually pad.

---

## Common Mistakes

### ❌ Mistake 1: Filtering by Non-Indexed Parameter

```json
{
  "logs": [{
    "address": ["0x..."],
    "topic0": ["0x..."],
    "data": ["0x1234..."]  // ❌ Can't filter by data
  }]
}
```

**Fix:** Only topic0-3 are filterable. To filter by non-indexed params, fetch all events and filter client-side.

---

### ❌ Mistake 2: Forgetting Topic Padding

```json
{
  "topic1": ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]  // ❌ Not padded
}
```

**Fix:** Always pad addresses to 32 bytes:
```json
{
  "topic1": ["0x000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]
}
```

---

### ❌ Mistake 3: Using Wrong Event Signature

```json
{
  "topic0": ["0x123..."]  // ❌ Incorrect hash
}
```

**Fix:** Compute correct keccak256 hash:
- Function: `Transfer(address,address,uint256)`
- No spaces, exact types
- Use ethers.js: `ethers.id("Transfer(address,address,uint256)")`

---

### ❌ Mistake 4: Too Broad Query (No Filters)

```json
{
  "type": "evm",
  "fromBlock": 0,
  "logs": [{}]  // ❌ No filters = millions of logs
}
```

**Fix:** Always filter by at least `address` or `topic0`, and use reasonable block ranges.

---

### ❌ Mistake 5: Wrong Dataset Name

```json
// POST /datasets/arbitrum/stream  ❌ Wrong name
```

**Fix:** Use correct Portal dataset names:
- `ethereum-mainnet` (not "ethereum")
- `arbitrum-one` (not "arbitrum")
- `base-mainnet` (not "base")

See **portal-dataset-discovery** skill for full mapping.

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"blockNumber":19500000,"hash":"0x...","parentHash":"0x...","timestamp":1234567890}}
{"logs":[{"address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","topics":["0xddf252ad...","0x000...123","0x000...456"],"data":"0x000...789","transactionHash":"0xabc...","logIndex":42}]}
{"logs":[{"address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","topics":["0xddf252ad...","0x000...111","0x000...222"],"data":"0x000...333","transactionHash":"0xdef...","logIndex":18}]}
```

**Parsing:**
1. Split response by newlines
2. Parse each line as JSON
3. First line is block header
4. Subsequent lines contain logs array

---

## Related Skills

- **portal-query-evm-transactions** - Query transactions that emitted these logs
- **portal-query-evm-traces** - Track internal calls related to events
- **portal-dataset-discovery** - Find correct dataset name for your chain
- **pipes-abi** - Get ABI and event signatures for contracts

---

## Additional Resources

- **API Documentation:** https://beta.docs.sqd.dev/api/catalog/stream
- **Schema Reference:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json
- **Event Signature Calculator:** https://www.4byte.directory/
