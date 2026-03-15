# EVM Traces - Additional Examples

## Example 3: Monitor Delegatecall Patterns (Proxy Contracts)

**Use case:** Track delegatecall operations for proxy pattern analysis.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "traces": [{
    "type": ["call"]
  }],
  "fields": {
    "trace": {
      "type": true,
      "callFrom": true,
      "callTo": true,
      "callSighash": true,
      "callCallType": true
    }
  }
}
```

**Notes:**
- `callCallType` is NOT a valid filter field; filter by `type: ["call"]` and then filter for `callCallType == "delegatecall"` client-side
- `callFrom` = proxy contract, `callTo` = implementation contract

---

## Example 4: Find CREATE2 Deployments

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
      "transactionIndex": true
    }
  }
}
```

**Notes:**
- Cannot directly filter by CREATE vs CREATE2 (both have type "create")
- Use `createResultAddress` to find specific contract deployment
- Check transaction input for CREATE2 opcode (0xf5)

---

## Example 5: Track Multi-Hop Swaps (MEV Analysis)

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
      "callResultOutput": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Function:** `swap(uint256,uint256,address,bytes)` on Uniswap V2 pairs
**Notes:**
- Multiple traces per transaction = multi-hop swap
- `callFrom` = calling contract (router or previous pair)

---

## Example 6: Contract Self-Destruct Tracking

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
      "transactionIndex": true
    }
  }
}
```

**Notes:**
- `suicideAddress` = contract being destroyed
- `suicideRefundAddress` = recipient of remaining ETH
- Post-Merge: selfdestruct is deprecated but still functional

---

## Call Types Reference

**4 call types in EVM:**

**1. `call` (most common):**
- Normal external function call; can transfer ETH; called contract executes in its own context

**2. `staticcall`:**
- Read-only call; cannot modify state or transfer ETH; used for view/pure functions

**3. `delegatecall`:**
- Execute code in caller's context; used for proxy patterns; storage changes affect caller, not callee

**4. `callcode` (deprecated):**
- Legacy version of delegatecall; rarely used in modern contracts

---

## Trace Position and Ordering

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
