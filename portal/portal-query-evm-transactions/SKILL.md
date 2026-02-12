---
name: portal-query-evm-transactions
description: Query EVM transactions using SQD Portal. Track wallet activity, function calls, and contract interactions with transaction filters.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: portal-core
---

## When to Use This Skill

Use this skill when you need to:
- Track wallet transaction activity (sent/received)
- Monitor specific function calls to contracts
- Find transactions by function selector (sighash)
- Analyze transaction patterns and volumes
- Get transactions with their related logs and traces

**This is the second most common Portal use case** - essential for wallet analysis and contract interaction tracking.

---

## Query Structure

**Basic EVM transaction query structure:**

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"],
    "sighash": ["0x414bf389"]
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "input": true,
      "status": true
    }
  }
}
```

**Field explanations:**
- `type: "evm"` - Required for EVM chains
- `fromBlock/toBlock` - Block range (required)
- `transactions` - Array of transaction filter objects
- `to` - Recipient address (INDEXED - fast)
- `from` - Sender address (INDEXED - fast)
- `sighash` - Function selector (first 4 bytes of input, INDEXED)
- `fields` - Which fields to include in response

---

## Understanding Function Selectors (Sighash)

**Function selectors identify which function is being called:**

```solidity
function swap(uint256 amountIn, address[] calldata path) external;
```

**Maps to:**
- Function signature: `swap(uint256,address[])`
- Sighash: First 4 bytes of keccak256("swap(uint256,address[])")
- Example: `0x414bf389`

**Key rules:**
1. Sighash is first 4 bytes of transaction `input` data
2. Computed from function name + parameter types (no spaces, no names)
3. INDEXED field - fast to query
4. Use for filtering by function call type

**Computing sighash:**
```javascript
// Using ethers.js
import { ethers } from 'ethers';
const sighash = ethers.id("swap(uint256,address[])").slice(0, 10);
// Result: "0x414bf389"
```

---

## Examples

### Example 1: Track Wallet Outgoing Transactions

**Use case:** Monitor all transactions sent by a specific wallet.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "from": ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "gasUsed": true,
      "status": true,
      "blockNumber": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Use case:** Track vitalik.eth transaction activity
**Notes:**
- `from` filter for sender
- `status: 1` = success, `0` = failed
- `value` is in wei (divide by 1e18 for ETH)

---

### Example 2: Find Uniswap V3 Router Swap Calls

**Use case:** Track all swap function calls to Uniswap V3 Router.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"],
    "sighash": ["0x414bf389"],
    "includeRelated": {
      "logs": true
    }
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "input": true,
      "status": true
    },
    "log": {
      "address": true,
      "topics": true,
      "data": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Uniswap V3 SwapRouter02
**Function:** `exactInputSingle(tuple params)`
**includeRelated:** Automatically fetches logs emitted by these transactions

---

### Example 3: Filter by ERC-20 Transfer Function

**Use case:** Query only ERC-20 transfer function calls to USDC contract.

```json
{
  "type": "evm",
  "fromBlock": 18000000,
  "toBlock": 18010000,
  "transactions": [{
    "to": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    "sighash": ["0xa9059cbb"]
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "input": true,
      "status": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** USDC
**Function:** `transfer(address,uint256)`
**Sighash:** `0xa9059cbb`

**Notes:**
- Function signature filtering isolates specific contract interactions
- `sighash` is the first 4 bytes of `keccak256("transfer(address,uint256)")`
- Reduces result set to only transfer function calls
- More efficient than filtering all transactions

---

### Example 4: Query Transactions to USDT Contract

**Use case:** Retrieve all transactions sent to USDT contract with comprehensive metadata.

```json
{
  "type": "evm",
  "fromBlock": 18000000,
  "toBlock": 18010000,
  "transactions": [{
    "to": ["0xdAC17F958D2ee523a2206206994597C13D831ec7"]
  }],
  "fields": {
    "block": {
      "number": true,
      "timestamp": true
    },
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "input": true,
      "gasUsed": true,
      "status": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Tether USD (USDT)
**Notes:**
- Including block fields enables temporal analysis
- Captures all interaction types (transfers, approvals, etc.)
- Useful for wallet activity tracking

---

### Example 5: Monitor Contract Deployments by Address

**Use case:** Find all contracts deployed by a specific deployer address.

```json
{
  "type": "evm",
  "fromBlock": 19000000,
  "toBlock": 19100000,
  "transactions": [{
    "from": ["0x1234567890123456789012345678901234567890"],
    "to": []
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "contractAddress": true,
      "input": true,
      "blockNumber": true
    }
  }
}
```

**Notes:**
- `to: []` filters for contract creation transactions
- `contractAddress` field contains the deployed contract address
- `input` contains the contract bytecode

---

### Example 6: Track Failed Transactions

**Use case:** Find all failed transactions to a specific contract.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"],
    "status": [0]
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "gasUsed": true,
      "status": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Uniswap V2 Router
**Notes:**
- `status: [0]` filters for failed transactions
- `status: [1]` filters for successful transactions
- Useful for debugging and error analysis

---

### Example 7: Multi-Function Call Tracking

**Use case:** Track multiple function types on the same contract.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "transactions": [
    {
      "to": ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"],
      "sighash": ["0x38ed1739"]
    },
    {
      "to": ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"],
      "sighash": ["0x8803dbee"]
    }
  ],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "input": true,
      "value": true
    }
  }
}
```

**Contract:** Uniswap V2 Router
**Functions:**
- `0x38ed1739` = `swapExactTokensForTokens(...)`
- `0x8803dbee` = `swapTokensForExactTokens(...)`

**Notes:** Multiple filter objects = OR logic (both function types returned)

---

### Example 8: Incoming Transactions with Related Data

**Use case:** Track all transactions TO a contract with their logs and traces.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    "includeRelated": {
      "logs": true,
      "traces": true
    }
  }],
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "gasUsed": true
    },
    "log": {
      "address": true,
      "topics": true,
      "data": true
    },
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callValue": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** USDC token contract
**Notes:**
- `includeRelated` fetches logs and traces for matched transactions
- Automatically joins related data
- No need for separate queries

---

## Key Concepts

### 1. Transaction Filter Fields (INDEXED)

**Fast filterable fields:**
- `from` - Transaction sender address
- `to` - Transaction recipient address
- `sighash` - Function selector (first 4 bytes of input)
- `status` - Success (1) or failure (0)
- `firstNonce` - First nonce in block (rare use)

**Performance tips:**
1. Filter by `to` or `from` first (most selective)
2. Add `sighash` for specific function calls
3. Use `status` to filter successes/failures
4. Combine filters for maximum selectivity

---

### 2. Transaction Fields Reference

**Available transaction fields:**

```json
{
  "hash": true,              // Transaction hash
  "transactionIndex": true,  // Position in block
  "from": true,              // Sender address
  "to": true,                // Recipient address (null for contract creation)
  "input": true,             // Transaction input data (calldata)
  "value": true,             // ETH value in wei
  "nonce": true,             // Sender nonce
  "gas": true,               // Gas limit
  "gasUsed": true,           // Gas actually used
  "gasPrice": true,          // Legacy gas price
  "maxFeePerGas": true,      // EIP-1559 max fee
  "maxPriorityFeePerGas": true, // EIP-1559 priority fee
  "contractAddress": true,   // Deployed contract address (if creation)
  "type": true,              // Transaction type (0, 1, 2)
  "status": true,            // 1 = success, 0 = failed
  "sighash": true,           // Function selector
  "chainId": true,           // Chain ID
  "v": true, "r": true, "s": true, // Signature components
  "yParity": true            // EIP-2930/1559 parity
}
```

**Common field combinations:**
- Basic: `hash`, `from`, `to`, `value`, `status`
- Gas analysis: `gasUsed`, `gasPrice`, `maxFeePerGas`
- Function calls: `to`, `sighash`, `input`, `status`
- Contract deployments: `from`, `to`, `contractAddress`, `input`

---

### 3. includeRelated - Automatic Data Joins

**Automatically fetch related data for matched transactions:**

`includeRelated` is a **filter-level parameter** placed inside each transaction filter object. It tells Portal to automatically fetch related logs, traces, or state diffs for matching transactions.

**Structure:**
```json
{
  "transactions": [{
    "to": ["0x..."],
    "includeRelated": {
      "logs": true,      // Include logs emitted by this transaction
      "traces": true,    // Include internal calls
      "stateDiffs": true // Include storage changes
    }
  }]
}
```

**Important notes:**
- `includeRelated` goes INSIDE the transaction filter object (not at query level)
- Must also request the corresponding fields in the `fields` section
- Related data appears in the same response object as the transaction

**Benefits:**
- Single query instead of multiple
- Guaranteed data consistency
- Automatic relationship handling

**Use cases:**
- Analyzing complete transaction effects
- Tracking internal token transfers (traces)
- Debugging complex contract interactions

---

### 4. Understanding Transaction Status

**Status field values:**
- `1` - Transaction succeeded
- `0` - Transaction failed (reverted)

**Failed transaction causes:**
- `require()` condition failed
- Out of gas
- Invalid opcode
- Stack overflow
- Other EVM errors

**Note:** Failed transactions still consume gas and appear on-chain.

---

### 5. Contract Creation Transactions

**Identifying contract deployments:**

```json
{
  "transactions": [{
    "to": []  // Empty array = filter for contract creations
  }],
  "fields": {
    "transaction": {
      "from": true,           // Deployer
      "contractAddress": true, // Deployed contract address
      "input": true,          // Contract bytecode
      "status": true          // Deployment success/failure
    }
  }
}
```

**Notes:**
- `to` is null/empty for contract creation
- `contractAddress` contains the new contract address
- `input` contains deployment bytecode + constructor args
- `value` can be non-zero (sending ETH to contract)

---

## Common Mistakes

### ❌ Mistake 1: Filtering by Input Data Directly

```json
{
  "transactions": [{
    "input": ["0x414bf389..."]  // ❌ input is not filterable
  }]
}
```

**Fix:** Use `sighash` to filter by function selector:
```json
{
  "transactions": [{
    "sighash": ["0x414bf389"]  // ✅ sighash is INDEXED
  }]
}
```

---

### ❌ Mistake 2: Wrong Sighash Computation

```solidity
function swap(uint256 amount, address[] memory path) external;
```

```json
{
  "sighash": ["0x12345678"]  // ❌ Incorrect hash
}
```

**Fix:** Compute correctly:
- Signature: `swap(uint256,address[])`
- No spaces, no parameter names, use canonical types
- Result: `ethers.id("swap(uint256,address[])").slice(0, 10)`

---

### ❌ Mistake 3: Expecting Immediate Related Data Without includeRelated

```json
{
  "transactions": [{
    "to": ["0x..."]
  }],
  "fields": {
    "transaction": {"hash": true},
    "log": {"topics": true}  // ❌ Logs won't be included
  }
}
```

**Fix:** Add `includeRelated` to fetch logs:
```json
{
  "transactions": [{
    "to": ["0x..."],
    "includeRelated": {
      "logs": true  // ✅ Now logs will be fetched
    }
  }]
}
```

---

### ❌ Mistake 4: Forgetting Block Range

```json
{
  "type": "evm",
  "transactions": [{"to": ["0x..."]}]  // ❌ No fromBlock/toBlock
}
```

**Fix:** Always specify block range:
```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{"to": ["0x..."]}]
}
```

---

### ❌ Mistake 5: Querying Too Many Transactions

```json
{
  "fromBlock": 0,
  "toBlock": 19500000,
  "transactions": [{}]  // ❌ No filters = millions of txs
}
```

**Fix:** Always add filters and reasonable block ranges:
```json
{
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0x..."]  // ✅ Filtered by recipient
  }]
}
```

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"blockNumber":19500000,"hash":"0x...","timestamp":1234567890}}
{"transactions":[{"hash":"0xabc...","from":"0x123...","to":"0x456...","value":"1000000000000000000","status":1}]}
{"transactions":[{"hash":"0xdef...","from":"0x789...","to":"0xabc...","value":"0","status":1}],"logs":[{"address":"0x...","topics":["0x..."],"data":"0x..."}]}
```

**Parsing:**
1. Split response by newlines
2. Parse each line as JSON
3. First line is block header
4. Subsequent lines contain transactions (and related logs/traces if requested)

**With includeRelated:**
- Transactions that emitted logs will have `logs` array in same JSON object
- Transactions with internal calls will have `traces` array

---

## Performance Tips

### 1. Filter Selectivity Order

**Most selective to least selective:**
1. Specific `to` + `sighash` (best)
2. Specific `to` or `from`
3. `sighash` only (slower)
4. `status` only (very broad)
5. No filters (avoid)

**Example progression:**
```json
// Slowest (broad)
{"transactions": [{"status": [1]}]}

// Better
{"transactions": [{"to": ["0x..."]}]}

// Best (most selective)
{"transactions": [{"to": ["0x..."], "sighash": ["0x414bf389"]}]}
```

---

### 2. Block Range Strategy

**Optimal block ranges:**
- Real-time monitoring: 100-1000 blocks
- Historical analysis: 10,000-100,000 blocks (with good filters)
- Full history: Use multiple queries with pagination

**Avoid:**
- Open-ended ranges (fromBlock: 0, toBlock: latest)
- Ranges over 1M blocks without strong filters

---

### 3. Field Selection

**Request only needed fields:**

```json
// Minimal (fastest transfer)
{
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true
    }
  }
}

// Full transaction detail (larger payload)
{
  "fields": {
    "transaction": {
      "hash": true,
      "from": true,
      "to": true,
      "value": true,
      "input": true,
      "gasUsed": true,
      "gasPrice": true,
      "status": true,
      "blockNumber": true
    }
  }
}
```

---

## Related Skills

- **portal-query-evm-logs** - Query logs emitted by these transactions
- **portal-query-evm-traces** - Query internal calls within transactions
- **portal-dataset-discovery** - Find correct dataset name for your chain
- **pipes-abi** - Get ABI and function signatures for contracts

---

## Additional Resources

- **API Documentation:** https://beta.docs.sqd.dev/api/catalog/stream
- **Schema Reference:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json
- **Function Selector Database:** https://www.4byte.directory/
- **Sighash Calculator:** https://emn178.github.io/online-tools/keccak_256.html

## Official Subsquid Documentation

### Core Documentation
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Portal API transactions querying
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Portal documentation
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Comprehensive transactions query guide

### API Resources
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/files/evm-openapi.yaml)** - Complete transactions query specification
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported EVM networks
- **[EVM Stream API](https://beta.docs.sqd.dev/api/catalog/stream)** - Transactions query documentation
