---
name: portal-query-evm-traces
description: Query EVM traces for internal transactions and contract deployments. Track CREATE operations, internal calls, and delegatecall patterns.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: portal-core
---


**Category:** Portal API - EVM Core
**Purpose:** Teach agents how to construct SQD Portal Stream API queries for EVM traces (internal transactions and contract deployments)

---

## When to Use This Skill

Use this skill when you need to:
- Track contract deployments (CREATE/CREATE2 operations)
- Monitor internal ETH transfers
- Analyze internal function calls between contracts
- Track proxy pattern delegatecalls
- Investigate MEV bot activity (multi-hop swaps)
- Find contracts deployed by specific addresses

**EVM traces capture internal contract interactions** that don't appear in the transactions table.

---

## Query Structure

**Basic EVM trace query structure:**

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "traces": [{
    "type": ["call"],
    "callFrom": ["0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"],
    "callSighash": ["0x414bf389"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callValue": true,
      "callSighash": true
    }
  }
}
```

**Field explanations:**
- `type: "evm"` - Required for EVM chains
- `fromBlock/toBlock` - Block range (required)
- `traces` - Array of trace filter objects
- `type` - Trace type: `call`, `create`, `suicide`, `reward`
- Filters vary by trace type (see examples below)

---

## Understanding Trace Types

**EVM has 4 trace types:**

### 1. CALL - Internal Function Calls
Internal contract-to-contract function calls (including ETH transfers).

**Key fields:**
- `callFrom` - Caller address (INDEXED)
- `callTo` - Callee address (INDEXED)
- `callSighash` - Function selector (INDEXED)
- `callValue` - ETH amount transferred
- `callType` - call, staticcall, delegatecall, callcode

### 2. CREATE - Contract Deployments
Contract creation via CREATE or CREATE2 opcodes.

**Key fields:**
- `createFrom` - Deployer address (INDEXED)
- `createResultAddress` - Deployed contract address (INDEXED)
- `createResultCode` - Deployed bytecode
- `createValue` - ETH sent to contract

### 3. SUICIDE (SELFDESTRUCT) - Contract Destruction
Contract self-destruct operations (deprecated but still exists on-chain).

**Key fields:**
- `suicideAddress` - Contract being destroyed (INDEXED)
- `suicideRefundAddress` - Address receiving remaining ETH (INDEXED)
- `suicideBalance` - ETH amount refunded

### 4. REWARD - Block Rewards
Mining/validator rewards (mostly historical, not used in PoS chains).

**Key fields:**
- `rewardAuthor` - Validator address (INDEXED)
- `rewardValue` - Reward amount
- `rewardType` - block, uncle, etc.

---

## Examples

### Example 1: Find Contracts Deployed by Address

**Use case:** Track all contracts deployed by a specific deployer address.

```json
{
  "type": "evm",
  "fromBlock": 19000000,
  "toBlock": 19100000,
  "traces": [{
    "type": ["create"],
    "createFrom": ["0x1234567890123456789012345678901234567890"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "createFrom": true,
      "createResultAddress": true,
      "createResultCode": true,
      "createValue": true,
      "transactionHash": true,
      "blockNumber": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Notes:**
- `type: ["create"]` filters for CREATE/CREATE2 operations
- `createFrom` is the deployer address
- `createResultAddress` is the new contract address
- `createResultCode` contains deployed bytecode (not creation bytecode)

---

### Example 2: Track Internal ETH Transfers

**Use case:** Monitor internal ETH transfers from/to specific contracts.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "traces": [{
    "type": ["call"],
    "callFrom": ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callValue": true,
      "callType": true,
      "error": true,
      "transactionHash": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Uniswap V2 Router
**Notes:**
- Captures internal calls from the router
- `callValue` shows ETH transferred
- `error: null` = success, `error: "..."` = failure
- Useful for tracking router → pair transfers

---

### Example 3: Monitor Delegatecall Patterns (Proxy Contracts)

**Use case:** Track delegatecall operations for proxy pattern analysis.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "traces": [{
    "type": ["call"],
    "callType": ["delegatecall"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callSighash": true,
      "callType": true,
      "transactionHash": true
    }
  }
}
```

**Notes:**
- `callType: ["delegatecall"]` filters specifically for delegatecalls
- `callFrom` = proxy contract
- `callTo` = implementation contract
- Useful for tracking proxy upgrades and implementation usage

---

### Example 4: Find CREATE2 Deployments

**Use case:** Track deterministic contract deployments (CREATE2).

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "traces": [{
    "type": ["create"],
    "createResultAddress": ["0x1234567890123456789012345678901234567890"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "createFrom": true,
      "createResultAddress": true,
      "createValue": true,
      "transactionHash": true,
      "blockNumber": true
    }
  }
}
```

**Notes:**
- Cannot directly filter by CREATE vs CREATE2 (both have type "create")
- Use `createResultAddress` to find specific contract deployment
- Check transaction input for CREATE2 opcode (0xf5)

---

### Example 5: Track Multi-Hop Swaps (MEV Analysis)

**Use case:** Analyze complex swap paths (e.g., Token A → B → C).

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "traces": [{
    "type": ["call"],
    "callSighash": ["0x022c0d9f"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callSighash": true,
      "callInput": true,
      "callOutput": true,
      "transactionHash": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Function:** `swap(uint256,uint256,address,bytes)` on Uniswap V2 pairs
**Notes:**
- Tracks internal swap calls between pairs
- `callFrom` = calling contract (router or previous pair)
- `callTo` = pair contract
- Multiple traces per transaction = multi-hop swap

---

### Example 6: Contract Self-Destruct Tracking

**Use case:** Monitor contracts being destroyed (rare but important).

```json
{
  "type": "evm",
  "fromBlock": 19000000,
  "toBlock": 19500000,
  "traces": [{
    "type": ["suicide"],
    "suicideRefundAddress": ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "suicideAddress": true,
      "suicideRefundAddress": true,
      "suicideBalance": true,
      "transactionHash": true,
      "blockNumber": true
    }
  }
}
```

**Notes:**
- `suicideAddress` = contract being destroyed
- `suicideRefundAddress` = recipient of remaining ETH
- `suicideBalance` = ETH amount refunded
- Post-Merge: selfdestruct is deprecated but still functional

---

## Key Concepts

### 1. Trace vs Transaction

**Transactions** = top-level operations submitted to the blockchain
**Traces** = all operations executed within transactions (including internal calls)

**Example:**
```
Transaction: User calls Uniswap Router.swap()
├─ Trace 1: Router calls Pair.swap() [internal call]
├─ Trace 2: Pair calls Token.transfer() [internal call]
└─ Trace 3: Pair transfers ETH [internal ETH transfer]
```

**Key insight:** One transaction can generate dozens of traces.

---

### 2. INDEXED Fields by Trace Type

**CALL traces:**
- `callFrom` - INDEXED (fast)
- `callTo` - INDEXED (fast)
- `callSighash` - INDEXED (fast)
- `callType` - INDEXED (fast)

**CREATE traces:**
- `createFrom` - INDEXED (fast)
- `createResultAddress` - INDEXED (fast)

**SUICIDE traces:**
- `suicideAddress` - INDEXED (fast)
- `suicideRefundAddress` - INDEXED (fast)

**REWARD traces:**
- `rewardAuthor` - INDEXED (fast)
- `rewardType` - INDEXED (fast)

**Always filter by INDEXED fields first for best performance.**

---

### 3. Call Types Explained

**4 call types in EVM:**

**1. `call` (most common):**
- Normal external function call
- Can transfer ETH
- Called contract executes in its own context
- Example: Router calling Pair contract

**2. `staticcall`:**
- Read-only call (cannot modify state)
- Cannot transfer ETH
- Used for view/pure functions
- Example: Checking balance via balanceOf()

**3. `delegatecall`:**
- Execute code in caller's context
- Used for proxy patterns
- Storage changes affect caller, not callee
- Example: Proxy → Implementation pattern

**4. `callcode` (deprecated):**
- Legacy version of delegatecall
- Rarely used in modern contracts

---

### 4. Trace Error Handling

**Error field indicates call failure:**

```json
{
  "error": null  // ✅ Call succeeded
}

{
  "error": "Out of gas"  // ❌ Call failed
}

{
  "error": "Reverted"  // ❌ Call reverted (require failed)
}
```

**Key insights:**
- Failed internal calls don't revert the transaction unless propagated
- `error: null` = successful trace
- `error: "..."` = failed trace
- Transaction can succeed even if some traces fail (try/catch pattern)

---

### 5. Trace Position and Ordering

**Traces include position fields:**
- `traceAddress` - Array indicating position in call tree
- `transactionIndex` - Position of transaction in block
- `subtraces` - Number of child traces

**Example trace tree:**
```
Transaction 0
├─ Trace [0] - Router.swap()
│  ├─ Trace [0, 0] - Pair.swap()
│  │  └─ Trace [0, 0, 0] - Token.transfer()
│  └─ Trace [0, 1] - Another internal call
└─ Trace [1] - Parallel call
```

**`traceAddress` values:**
- `[]` - Top-level call (transaction itself)
- `[0]` - First internal call
- `[0, 0]` - First call within first call
- `[0, 1]` - Second call within first call

---

## Common Mistakes

### ❌ Mistake 1: Using Transaction Filters for Internal Calls

```json
{
  "transactions": [{
    "to": ["0x..."]  // ❌ Misses internal calls
  }]
}
```

**Fix:** Use traces to capture internal calls:
```json
{
  "traces": [{
    "type": ["call"],
    "callTo": ["0x..."]  // ✅ Captures internal calls
  }]
}
```

---

### ❌ Mistake 2: Filtering CREATE by Wrong Field

```json
{
  "traces": [{
    "type": ["create"],
    "callFrom": ["0x..."]  // ❌ Wrong field (callFrom is for CALL traces)
  }]
}
```

**Fix:** Use CREATE-specific fields:
```json
{
  "traces": [{
    "type": ["create"],
    "createFrom": ["0x..."]  // ✅ Correct field for deployments
  }]
}
```

---

### ❌ Mistake 3: Ignoring Trace Type

```json
{
  "traces": [{
    "callFrom": ["0x..."]  // ❌ No type specified
  }]
}
```

**Fix:** Always specify trace type:
```json
{
  "traces": [{
    "type": ["call"],  // ✅ Explicit type
    "callFrom": ["0x..."]
  }]
}
```

---

### ❌ Mistake 4: Expecting Traces for All Transactions

**Not all transactions generate traces:**
- Simple ETH transfers (no code execution) have no traces
- Failed transactions may have no traces
- Traces are generated by contract code execution

**Solution:** Use transactions table for simple transfers, traces for contract interactions.

---

### ❌ Mistake 5: Confusing Creation Bytecode with Runtime Bytecode

```json
{
  "traces": [{
    "type": ["create"]
  }],
  "fields": {
    "trace": {
      "createResultCode": true  // Runtime bytecode (deployed)
    }
  }
}
```

**Note:**
- `createResultCode` = deployed bytecode (runtime)
- Creation bytecode includes constructor + runtime bytecode
- To get creation bytecode, query transaction.input field

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"blockNumber":19500000,"hash":"0x...","timestamp":1234567890}}
{"traces":[{"type":"call","callFrom":"0xRouter...","callTo":"0xPair...","callSighash":"0x022c0d9f","callValue":"0","callType":"call","error":null}]}
{"traces":[{"type":"create","createFrom":"0xFactory...","createResultAddress":"0xNewContract...","createResultCode":"0x6080...","createValue":"0"}]}
```

**Parsing:**
1. Split response by newlines
2. Parse each line as JSON
3. First line is block header
4. Subsequent lines contain traces array

---

## Performance Tips

### 1. Filter Selectivity

**Most selective to least selective:**
1. Specific `createFrom` or `callFrom/To` + type (best)
2. Specific address + type
3. Type + sighash
4. Type only (broad)
5. No filters (avoid)

**Example:**
```json
// Best performance
{
  "traces": [{
    "type": ["call"],
    "callFrom": ["0x..."],
    "callSighash": ["0x022c0d9f"]
  }]
}
```

---

### 2. Trace Volume Considerations

**Traces are high-volume data:**
- Complex DeFi transactions can generate 100+ traces
- Use narrow block ranges (1000-10000 blocks)
- Always add filters (type + address minimum)

**Avoid:**
```json
{
  "fromBlock": 0,
  "toBlock": 19500000,
  "traces": [{}]  // ❌ Billions of traces
}
```

---

### 3. Field Selection Strategy

**Request only needed fields:**

```json
// Minimal deployment tracking
{
  "fields": {
    "trace": {
      "type": true,
      "createFrom": true,
      "createResultAddress": true
    }
  }
}

// Full trace analysis
{
  "fields": {
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callSighash": true,
      "callInput": true,
      "callOutput": true,
      "callValue": true,
      "error": true,
      "traceAddress": true
    }
  }
}
```

---

## Related Skills

- **portal-query-evm-transactions** - Query top-level transactions that generate traces
- **portal-query-evm-logs** - Query events emitted during traced calls
- **portal-dataset-discovery** - Find correct dataset name for your chain

---

## Additional Resources

- **API Documentation:** https://beta.docs.sqd.dev/api/catalog/stream
- **Schema Reference:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json
- **EVM Trace Specification:** https://openethereum.github.io/JSONRPC-trace-module
- **Proxy Patterns:** https://docs.openzeppelin.com/contracts/4.x/api/proxy

## Official Subsquid Documentation

### Core Documentation
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Portal API traces querying
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Portal documentation
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Comprehensive traces query guide

### API Resources
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/files/evm-openapi.yaml)** - Complete traces query specification
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported EVM networks
- **[EVM Stream API](https://beta.docs.sqd.dev/api/catalog/stream)** - Traces query documentation
