# EVM Transactions - Additional Examples

## Example 4: Query Transactions to USDT Contract

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
**Notes:** Including block fields enables temporal analysis; captures all interaction types.

---

## Example 5: Monitor Contract Deployments by Address

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
      "input": true
    }
  }
}
```

**Notes:**
- `to: []` filters for contract creation transactions
- `contractAddress` field contains the deployed contract address
- `input` contains the contract bytecode

---

## Example 6: Track Transactions and Filter by Status Client-Side

**Use case:** Find failed transactions to a specific contract.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"]
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
- `status` is NOT a valid filter field - only available as a response field
- Filter client-side: `status === 0` = failed, `status === 1` = success

---

## Example 7: Multi-Function Call Tracking

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

## Example 8: Incoming Transactions with Related Data

**Use case:** Track all transactions TO a contract with their logs and traces.

```json
{
  "type": "evm",
  "fromBlock": 19500000,
  "toBlock": 19500100,
  "transactions": [{
    "to": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    "logs": true,
    "traces": true
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
- `"logs": true` and `"traces": true` in the filter fetch related data for matched transactions
- Must also request the corresponding fields in the `fields` section
