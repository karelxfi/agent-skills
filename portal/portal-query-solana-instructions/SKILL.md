---
name: portal-query-solana-instructions
description: Query Solana program instructions using SQD Portal. Track program interactions, SPL tokens, and wallet activity with discriminator filters.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: portal-core
---

## When to Use This Skill

Use this skill when you need to:
- Track Solana program interactions (Jupiter swaps, Raydium pools, etc.)
- Monitor SPL token transfers
- Analyze wallet activity on Solana
- Filter by specific program functions (using discriminators)
- Track account interactions with programs

**Solana instructions are the equivalent of EVM transactions/logs** - they capture on-chain program calls.

---

## Query Structure

**Basic Solana instruction query structure:**

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "d8": ["0xe445a52e51cb9a1d"],
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

**Field explanations:**
- `type: "solana"` - Required for Solana chains
- `fromBlock/toBlock` - Block range (required, uses slot numbers)
- `instructions` - Array of instruction filter objects
- `programId` - Program address (INDEXED - fast)
- `d1/d2/d4/d8` - Discriminators (INDEXED - function selectors)
- `a0-a31` - Account filters by position (INDEXED)
- `mentionsAccount` - Account appears anywhere (INDEXED)

---

## Understanding Solana Instructions

**Solana instruction structure:**

```
Instruction:
├─ programId: "JUP6Lkb..." (Program being called)
├─ accounts: ["EPjFWdd5...", "So11111..."] (Account keys involved)
└─ data: "0xe445a52e..." (Instruction data)
```

**Key concepts:**
1. **programId** - The program being called (like contract address in EVM)
2. **accounts** - Array of account public keys involved in the instruction
3. **data** - Instruction data (includes discriminator + parameters)

---

## Understanding Discriminators

**Discriminators are Solana's function selectors** (similar to EVM sighash).

**For Anchor programs:**
- First 8 bytes of data = discriminator
- Computed from function name
- Used to identify which function is being called

**Discriminator types:**
- `d1` - First 1 byte of data
- `d2` - First 2 bytes of data
- `d4` - First 4 bytes of data
- `d8` - First 8 bytes of data (most common for Anchor)

**Example (Jupiter swap):**
```
Function: sharedAccountsRoute
Discriminator (d8): 0xe445a52e51cb9a1d
```

**Computing discriminator (Anchor):**
```typescript
import { sha256 } from '@noble/hashes/sha256';

function getDiscriminator(name: string): string {
  const hash = sha256(Buffer.from(`global:${name}`));
  return '0x' + Buffer.from(hash).slice(0, 8).toString('hex');
}

getDiscriminator('sharedAccountsRoute');
// Result: 0xe445a52e51cb9a1d
```

---

## Examples

### Example 1: Track Jupiter Swap Instructions

**Use case:** Monitor all Jupiter swap instructions on Solana.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "d8": ["0xe445a52e51cb9a1d"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true,
      "transactionHash": true
    },
    "transaction": {
      "feePayer": true,
      "fee": true,
      "err": true
    }
  }
}
```

**Dataset:** `solana-mainnet`
**Program:** Jupiter Aggregator V6
**Function:** sharedAccountsRoute (common swap function)
**Notes:**
- `d8` discriminator identifies the specific function
- `accounts` array shows all involved accounts (token accounts, pools, etc.)
- `transactionHash` links to transaction details

---

### Example 2: Track SPL Token Transfers

**Use case:** Monitor SPL token transfer instructions.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    "d1": ["0x03"]
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
**Program:** SPL Token Program
**Instruction:** Transfer (discriminator: 0x03)
**Notes:**
- SPL Token uses 1-byte discriminators
- `accounts[0]` = source account
- `accounts[1]` = destination account
- `accounts[2]` = authority
- Decode `data` to get amount

---

### Example 3: Track Wallet Activity (All Instructions)

**Use case:** Monitor all program interactions for a specific wallet.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "mentionsAccount": ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    },
    "transaction": {
      "feePayer": true,
      "blockTime": true
    }
  }
}
```

**Notes:**
- `mentionsAccount` matches if the account appears ANYWHERE in accounts array
- More expensive than `a0-a31` (position-specific) filters
- Use for comprehensive wallet tracking

---

### Example 4: Filter by Specific Account Position

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

### Example 5: Track Raydium Pool Interactions

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
      "data": true,
      "transactionHash": true
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

### Example 6: Query Orca Whirlpool Instructions

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
**Notes:**
- Retrieves all on-chain activity for the Whirlpool program
- Block metadata enables temporal analysis
- `transactionIndex` helps reconstruct execution order

---

### Example 7: Filter Orca Swaps by Discriminator

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

**Dataset:** `solana-mainnet`
**Program:** Orca Whirlpool
**Function:** Swap instruction
**Notes:**
- Instruction discriminators are typically first 8 bytes of data
- Enables granular filtering for specific operations
- Reduces result volume for focused analysis

---

### Example 8: Filter Swaps by Specific Pool

**Use case:** Isolate transactions for a particular trading pair (e.g., USDC/SOL pool).

```json
{
  "type": "solana",
  "fromBlock": 280000000,
  "toBlock": 280000003,
  "instructions": [{
    "programId": ["whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"],
    "d8": ["0xf8c69e91e17587c8"],
    "accounts": ["7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm"]
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
**Program:** Orca Whirlpool
**Pool:** USDC/SOL pool address
**Notes:**
- Pool addresses are stable identifiers for specific trading pairs
- Account filtering reduces data volume significantly
- More efficient than protocol-wide queries

---

### Example 9: Track USDC Token Balance Changes

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

**Dataset:** `solana-mainnet`
**Token:** USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
**Notes:**
- Use `preMint` filter to target specific token types
- Compare `preAmount`/`postAmount` to identify transfers
- Track ownership changes via `preOwner`/`postOwner` fields
- Block metadata provides temporal context

---

### Example 10: Monitor Transactions by Fee Payer

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

**Dataset:** `solana-mainnet`
**Notes:**
- Filter arrays support multiple addresses
- `err: null` indicates successful transaction
- Requesting only necessary fields improves performance
- Useful for wallet activity tracking

---

### Example 11: Track Program Deployments

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

**Dataset:** `solana-mainnet`
**Program:** BPF Upgradeable Loader
**Notes:**
- Captures deployment activities by filtering BPF Loader instructions
- First account typically represents the deployed program
- Block metadata enables temporal tracking
- Fee payer identifies deployer

---

### Example 12: Track Failed Instructions

**Use case:** Find transactions with failed instructions.

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "isCommitted": [false]
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
- `isCommitted: [false]` filters for failed instructions
- `isCommitted: [true]` filters for successful instructions
- `transaction.err` contains error details

---

## Key Concepts

### 1. Solana Instruction Fields

**Available instruction fields:**

```json
{
  "programId": true,          // Program being called
  "accounts": true,           // Array of account public keys
  "data": true,               // Instruction data (hex string)
  "computeUnitsConsumed": true, // CU used by this instruction
  "transactionHash": true,    // Transaction signature
  "transactionIndex": true,   // Transaction position in block
  "instructionAddress": true, // Instruction position in transaction
  "isCommitted": true,        // Success/failure status
  "d1": true,                 // First 1 byte of data
  "d2": true,                 // First 2 bytes of data
  "d4": true,                 // First 4 bytes of data
  "d8": true                  // First 8 bytes of data
}
```

---

### 2. INDEXED Fields for Filtering

**Fast filterable fields:**
- `programId` - INDEXED (always filter by this first)
- `d1, d2, d4, d8` - INDEXED (discriminators)
- `a0` through `a31` - INDEXED (account positions)
- `mentionsAccount` - INDEXED (slower than a0-a31)
- `isCommitted` - INDEXED (success/failure)

**Performance tips:**
1. Always filter by `programId` first (most selective)
2. Add discriminator filter (`d8` for Anchor programs)
3. Use `a0-a31` for position-specific account filters
4. Use `mentionsAccount` only when position unknown

---

### 3. Transaction Context

**Include transaction fields for full context:**

```json
{
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    },
    "transaction": {
      "feePayer": true,       // Transaction signer
      "fee": true,            // Transaction fee (lamports)
      "err": true,            // Error object (null = success)
      "blockTime": true,      // Unix timestamp
      "signatures": true,     // Transaction signatures
      "accountKeys": true     // All account keys in transaction
    }
  }
}
```

**Notes:**
- `feePayer` = transaction initiator (wallet)
- `err: null` = transaction succeeded
- `err: {...}` = transaction failed (contains error details)
- `blockTime` = Unix timestamp (seconds)

---

### 4. Account Position Filtering Strategy

**Use `a0-a31` when:**
- You know the account position in the instruction
- You're tracking a specific program's function
- You need maximum performance

**Use `mentionsAccount` when:**
- Account position varies
- You want comprehensive wallet tracking
- Position is unknown or changes across functions

**Example - SPL Token Transfer:**
```json
{
  "instructions": [{
    "programId": ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    "a0": ["SourceTokenAccount..."]  // Source account always at position 0
  }]
}
```

---

### 5. Discriminator Formats

**Different programs use different discriminator lengths:**

**Anchor programs (most common):**
- Use 8-byte discriminators (`d8`)
- Example: Jupiter, Raydium, Mango

**SPL Token Program:**
- Use 1-byte discriminators (`d1`)
- Example: Transfer = 0x03, Approve = 0x04

**Native programs:**
- May use 4-byte discriminators (`d4`)
- Or no discriminator at all

**Always check program documentation for correct discriminator format.**

---

## Common Mistakes

### ❌ Mistake 1: Using Wrong Discriminator Length

```json
{
  "instructions": [{
    "programId": ["JUP6..."],
    "d1": ["0xe4"]  // ❌ Jupiter uses d8, not d1
  }]
}
```

**Fix:** Use correct discriminator length:
```json
{
  "instructions": [{
    "programId": ["JUP6..."],
    "d8": ["0xe445a52e51cb9a1d"]  // ✅ 8-byte discriminator
  }]
}
```

---

### ❌ Mistake 2: Filtering Without programId

```json
{
  "instructions": [{
    "d8": ["0xe445a52e51cb9a1d"]  // ❌ No programId filter
  }]
}
```

**Fix:** Always filter by programId first:
```json
{
  "instructions": [{
    "programId": ["JUP6..."],  // ✅ Filter by program
    "d8": ["0xe445a52e51cb9a1d"]
  }]
}
```

---

### ❌ Mistake 3: Using EVM-Style Block Numbers

```json
{
  "type": "solana",
  "fromBlock": 19500000,  // ❌ This is an EVM block number
  "toBlock": 19500100
}
```

**Fix:** Use Solana slot numbers:
```json
{
  "type": "solana",
  "fromBlock": 250000000,  // ✅ Solana slot number
  "toBlock": 250001000
}
```

**Note:** Solana uses "slots" not "blocks" - current slot is ~250M+ (as of 2024).

---

### ❌ Mistake 4: Forgetting to Include Transaction Fields

```json
{
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true
    }
    // ❌ Missing transaction fields
  }
}
```

**Fix:** Include transaction context:
```json
{
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true
    },
    "transaction": {  // ✅ Add transaction fields
      "feePayer": true,
      "err": true
    }
  }
}
```

---

### ❌ Mistake 5: Confusing Account Position

```json
{
  "instructions": [{
    "a1": ["TokenAccount..."]  // ❌ Wrong position
  }]
}
```

**Fix:** Check program documentation for correct account ordering:
```json
{
  "instructions": [{
    "a0": ["TokenAccount..."]  // ✅ Correct position (first account)
  }]
}
```

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"slot":250000000,"hash":"...","parentHash":"...","timestamp":1234567890}}
{"instructions":[{"programId":"JUP6...","accounts":["EPjF...","So11..."],"data":"0xe445a52e...","transactionHash":"5J7X..."}],"transactions":[{"feePayer":"9WzD...","fee":5000,"err":null}]}
{"instructions":[{"programId":"JUP6...","accounts":["USDC...","SOL..."],"data":"0xe445a52e...","transactionHash":"3K9Y..."}],"transactions":[{"feePayer":"8QwE...","fee":5000,"err":null}]}
```

**Parsing:**
1. Split response by newlines
2. Parse each line as JSON
3. First line is block header
4. Subsequent lines contain instructions and related transaction data

---

## Performance Tips

### 1. Filter Selectivity Order

**Most selective to least selective:**
1. `programId` + `d8` + `a0` (best)
2. `programId` + `d8`
3. `programId` + `mentionsAccount`
4. `programId` only (broad)
5. No filters (avoid)

**Example progression:**
```json
// Best performance
{
  "instructions": [{
    "programId": ["JUP6..."],
    "d8": ["0xe445a52e51cb9a1d"],
    "a0": ["USDC..."]
  }]
}
```

---

### 2. Block Range Strategy

**Optimal slot ranges:**
- Real-time monitoring: 1,000-10,000 slots (~8-80 minutes)
- Historical analysis: 100,000-1,000,000 slots
- Full history: Use multiple queries with pagination

**Note:** Solana processes ~2 slots/second, so ranges translate differently than EVM.

---

### 3. Field Selection

**Request only needed fields:**

```json
// Minimal (fastest transfer)
{
  "fields": {
    "instruction": {
      "programId": true,
      "data": true
    }
  }
}

// Full analysis (larger payload)
{
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true,
      "computeUnitsConsumed": true,
      "transactionHash": true
    },
    "transaction": {
      "feePayer": true,
      "fee": true,
      "err": true,
      "blockTime": true
    }
  }
}
```

---

## Related Skills

- **portal-dataset-discovery** - Find correct Solana dataset name
- **portal-query-evm-logs** - EVM equivalent (for comparison)
- **portal-query-evm-transactions** - EVM equivalent (for comparison)

---

## Additional Resources

- **API Documentation:** https://beta.docs.sqd.dev/api/catalog/solana/stream
- **Schema Reference:** https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json
- **Solana Program Library:** https://spl.solana.com/
- **Anchor Framework:** https://www.anchor-lang.com/
- **Current Slot Number:** https://explorer.solana.com/
