# Solana Instructions - Additional Examples

## Example 4: Filter by Specific Account Position

**Use case:** Track instructions where a specific token appears as first account.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "a0": ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    }
  }
}
```

**Notes:**
- `a0` = first account in accounts array
- `a1` = second account, `a2` = third, etc. (up to a31)
- More efficient than `mentionsAccount`
- Use when you know the account position

---

## Example 5: Track Raydium Pool Interactions

**Use case:** Monitor Raydium AMM swap instructions.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"],
    "d8": ["0xf8c69e91e17587c8"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    }
  }
}
```

**Dataset:** `solana-mainnet`
**Program:** Raydium AMM V4
**Function:** swap (example discriminator)
**Notes:**
- Raydium uses Anchor program (8-byte discriminators)
- `accounts` array includes pool accounts, token accounts, etc.

---

## Example 6: Query Orca Whirlpool Instructions

**Use case:** Monitor all instructions from Orca Whirlpool program with block metadata.

```json
{
  "type": "solana",
  "fromBlock": 280000000,
  "toBlock": 280000003,
  "instructions": [{
    "programId": ["whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"]
  }],
  "fields": {
    "block": {
      "number": true,
      "timestamp": true
    },
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true,
      "transactionIndex": true
    }
  }
}
```

**Dataset:** `solana-mainnet`
**Program:** Orca Whirlpool

---

## Example 7: Filter Orca Swaps by Discriminator

**Use case:** Isolate specific swap instruction types using 8-byte discriminators.

```json
{
  "type": "solana",
  "fromBlock": 280000000,
  "toBlock": 280000003,
  "instructions": [{
    "programId": ["whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"],
    "d8": ["0xf8c69e91e17587c8"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "data": true,
      "accounts": true
    }
  }
}
```

---

## Example 8: Filter Swaps by Specific Pool

**Use case:** Isolate transactions for a particular trading pair (e.g., USDC/SOL pool).

```json
{
  "type": "solana",
  "fromBlock": 280000000,
  "toBlock": 280000003,
  "instructions": [{
    "programId": ["whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"],
    "d8": ["0xf8c69e91e17587c8"],
    "a0": ["7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    }
  }
}
```

**Pool:** USDC/SOL pool address
**Notes:** Position-based account filters (`a0`-`a31`) are more efficient than protocol-wide queries.

---

## Example 9: Track USDC Token Balance Changes

**Use case:** Monitor USDC token balance changes across blocks.

```json
{
  "type": "solana",
  "fromBlock": 280000000,
  "toBlock": 280000003,
  "fields": {
    "block": {
      "number": true,
      "timestamp": true
    },
    "tokenBalance": {
      "account": true,
      "preMint": true,
      "postMint": true,
      "preAmount": true,
      "postAmount": true,
      "preOwner": true,
      "postOwner": true
    }
  },
  "tokenBalances": [{
    "preMint": ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]
  }]
}
```

**Token:** USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)

---

## Example 10: Monitor Transactions by Fee Payer

**Use case:** Track all transactions from a specific wallet address.

```json
{
  "type": "solana",
  "fromBlock": 280000000,
  "toBlock": 280000003,
  "fields": {
    "transaction": {
      "signatures": true,
      "feePayer": true,
      "err": true
    }
  },
  "transactions": [{
    "feePayer": ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"]
  }]
}
```

---

## Example 11: Track Program Deployments

**Use case:** Monitor new program deployments using BPF Upgradeable Loader.

```json
{
  "type": "solana",
  "fromBlock": 270000044,
  "toBlock": 270000047,
  "instructions": [{
    "programId": ["BPFLoaderUpgradeab1e11111111111111111111111"]
  }],
  "fields": {
    "block": {
      "number": true,
      "timestamp": true
    },
    "transaction": {
      "signatures": true,
      "feePayer": true
    },
    "instruction": {
      "programId": true,
      "accounts": true,
      "transactionIndex": true
    }
  }
}
```

**Program:** BPF Upgradeable Loader
**Notes:** First account typically represents the deployed program; fee payer identifies deployer.

---

## Example 12: Track Failed Instructions

**Use case:** Find transactions with failed instructions.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "isCommitted": false
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    },
    "transaction": {
      "err": true,
      "feePayer": true
    }
  }
}
```

**Notes:**
- `isCommitted: false` filters for failed instructions
- `isCommitted: true` filters for successful instructions
- `transaction.err` contains error details
