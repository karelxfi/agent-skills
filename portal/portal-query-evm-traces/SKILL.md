---
name: portal-query-evm-traces
description: Query EVM traces for internal transactions and contract deployments. Track CREATE operations, internal calls, and delegatecall patterns.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "2.0.0"
  category: portal-core
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
- `type: "evm"` - **Required for EVM chains**
- `fromBlock/toBlock` - Block range (required)
- `traces` - Array of trace filter objects
- `type` - Trace type: `call`, `create`, `suicide`, `reward`
- Filters vary by trace type (see examples below)

---

## Understanding Trace Types

**EVM has 4 trace types:**

### 1. CALL - Internal Function Calls
Internal contract-to-contract function calls (including ETH transfers).

**INDEXED filter fields:**
- `callFrom` - Caller address (INDEXED)
- `callTo` - Callee address (INDEXED)
- `callSighash` - Function selector (INDEXED)

**Response fields:** `callValue`, `callCallType` (call/staticcall/delegatecall/callcode), `callInput`, `callResultOutput`, `error`

### 2. CREATE - Contract Deployments
Contract creation via CREATE or CREATE2 opcodes.

**INDEXED filter fields:**
- `createFrom` - Deployer address (INDEXED)
- `createResultAddress` - Deployed contract address (INDEXED)

**Response fields:** `createResultCode` (deployed bytecode), `createValue`

### 3. SUICIDE (SELFDESTRUCT) - Contract Destruction

**INDEXED filter fields:**
- `suicideAddress` - Contract being destroyed (INDEXED)
- `suicideRefundAddress` - Address receiving remaining ETH (INDEXED)

**Response fields:** `suicideBalance`

### 4. REWARD - Block Rewards (historical, not used in PoS chains)

**INDEXED filter fields:** `rewardAuthor` (INDEXED)

---

## Examples

### Example 1: Find Contracts Deployed by Address

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
      "transactionIndex": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Notes:** `createResultAddress` = new contract address; `createResultCode` = deployed (runtime) bytecode

---

### Example 2: Track Internal ETH Transfers

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
      "callCallType": true,
      "error": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet` | **Contract:** Uniswap V2 Router
**Notes:** `error: null` = success; `callValue` shows ETH transferred

> **More examples:** See `references/additional-examples.md` for delegatecall patterns, CREATE2, multi-hop MEV swaps, and self-destruct tracking.

---

## Trace vs Transaction

**Transactions** = top-level operations submitted to the blockchain
**Traces** = all operations executed within transactions (including internal calls)

```
Transaction: User calls Uniswap Router.swap()
├─ Trace 1: Router calls Pair.swap() [internal call]
├─ Trace 2: Pair calls Token.transfer() [internal call]
└─ Trace 3: Pair transfers ETH [internal ETH transfer]
```

**Key insight:** One transaction can generate dozens of traces.

---

## Trace Fields Reference

**Common fields available across trace types:**
- `type` - Trace type (call/create/suicide/reward)
- `transactionIndex` - Position of transaction in block
- `traceAddress` - Array indicating position in call tree (e.g., `[0, 1]`)
- `subtraces` - Number of child traces
- `error` - Error message (null = success)
- `revertReason` - Decoded revert reason (if available)

**Response structure note:** The response uses nested `action` and `result` objects:
- `callFrom` → `action.from`, `callTo` → `action.to`
- `callCallType` → `action.callType`
- `createResultAddress` → `result.address`
- `callResultOutput` → `result.output`

---

## Common Mistakes

### ❌ Using Transaction Filters for Internal Calls

```json
{"transactions": [{"to": ["0x..."]}]}  // ❌ Misses internal calls
```
**Fix:** Use `traces` with `callTo` to capture internal calls.

---

### ❌ Filtering CREATE by Wrong Field

```json
{"traces": [{"type": ["create"], "callFrom": ["0x..."]}]}  // ❌ Wrong field
```
**Fix:** Use `createFrom` for CREATE traces (not `callFrom`).

---

### ❌ Ignoring Trace Type

```json
{"traces": [{"callFrom": ["0x..."]}]}  // ❌ No type specified
```
**Fix:** Always specify `"type": ["call"]` (or "create", "suicide").

---

### ❌ Confusing Creation Bytecode with Runtime Bytecode

`createResultCode` = deployed (runtime) bytecode. To get creation bytecode, query `transaction.input`.

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"number":19500000,"hash":"0x...","timestamp":1234567890}}
{"traces":[{"type":"call","action":{"from":"0xRouter...","to":"0xPair...","callType":"call","value":"0","input":"0x022c0d9f..."},"result":{"gasUsed":21000,"output":"0x..."}}]}
{"traces":[{"type":"create","action":{"from":"0xFactory...","value":"0"},"result":{"address":"0xNewContract...","code":"0x6080...","gasUsed":500000}}]}
```

**Parsing:** Split by newlines, parse each line as JSON. First line = block header.

---

## Performance Tips

**Traces are high-volume data** - complex DeFi transactions can generate 100+ traces.

**Filter selectivity (best to worst):**
1. Specific address + type + sighash (best)
2. Specific address + type
3. Type only (broad)
4. No filters (avoid)

**Avoid:**
```json
{"fromBlock": 0, "toBlock": 19500000, "traces": [{}]}  // ❌ Billions of traces
```

---

## Use Case: Contract Deployment Registry

CREATE traces are the definitive source for contract deployment data. Use them to build contract registries, verify deployment blocks, and discover new protocol contracts.

### Tracking Deployments from Known Deployers

Query all contracts deployed by a specific protocol's deployer address:

```json
{
  "type": "evm",
  "fromBlock": 15500000,
  "toBlock": 17500000,
  "traces": [{
    "type": ["create"],
    "createFrom": [
      "0x54705f80d7c51fcffd9c659ce3f3c9a7dccf5788",
      "0x2f39d218133afab8f2b819b1066c7e434ad94e9e"
    ]
  }],
  "fields": {
    "block": { "number": true, "timestamp": true },
    "trace": {
      "transactionIndex": true,
      "createFrom": true,
      "createResultAddress": true
    }
  }
}
```

**Real-world results (tested):**
- Rocket Pool minipool factory: 608 contract deployments discovered across blocks 15.5M-17M
- Aave V3 PoolAddressesProvider: Pool proxy deployment at block 16291127 correctly identified
- Compound V3 Comet Factory: new market deployments captured

### Key Learnings

**Response field names are nested:**
```json
{
  "traces": [{
    "transactionIndex": 157,
    "action": { "from": "0xDeployer..." },
    "result": { "address": "0xNewContract..." }
  }]
}
```
Access deployer as `trace.action.from` and new contract as `trace.result.address` (NOT `trace.createFrom` or `trace.createResultAddress` — those are request filter names, not response field names).

**No `transactionHash` on traces** — only `transactionIndex`. To get the tx hash, include the transaction in your query or look it up separately.

**Factory-deployed contracts:** Many DeFi protocols deploy via factory contracts (Uniswap, Morpho, Euler). The `createFrom` is the factory contract, not the protocol's EOA deployer. To track these, filter by the factory's address as `createFrom`.

**CREATE2 deterministic deployments:** These also appear as `type: "create"` traces. The deployer address will be the factory using CREATE2. Same query pattern works.

---

## Related Skills

- **portal-query-evm-transactions** - Query top-level transactions that generate traces
- **portal-query-evm-logs** - Query events emitted during traced calls
- **portal-dataset-discovery** - Find correct dataset name for your chain

---

## Additional Resources

- **API Documentation:** https://beta.docs.sqd.dev/api/catalog/stream
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Portal API traces querying
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Portal documentation
- **[EVM OpenAPI Schema](https://beta.docs.sqd.dev/en/api/catalog/evm/openapi.yaml)** - Complete traces query specification
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported EVM networks
