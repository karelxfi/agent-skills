---
name: portal-query-solana-instructions
description: Query Solana program instructions using SQD Portal. Track program interactions, SPL tokens, and wallet activity with discriminator filters.
allowed-tools: [Bash, WebFetch, WebSearch]
metadata:
  author: subsquid
  version: "2.0.0"
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

## Pre-Build: Estimate Instruction Volume

**Before building an indexer, always verify the program has sufficient instruction volume.** Query Portal for a 10K-slot sample to estimate throughput:

```bash
curl -s 'https://portal.sqd.dev/datasets/solana-mainnet/stream' \
  -H 'content-type: application/json' \
  -H 'accept: application/x-ndjson' \
  -d '{"type":"solana","fromBlock":280000000,"toBlock":280010000,"instructions":[{"programId":["YOUR_PROGRAM_ID"]}],"fields":{"instruction":{"programId":true}}}' \
  | wc -l
```

**Rules of thumb:**
- **< 50 instructions per 10K slots** — very low volume. Investigate if the program is a router that delegates to other programs. Consider indexing the related programs too.
- **50-500 per 10K slots** — moderate. Suitable for indexing but let it sync longer for meaningful data.
- **500+ per 10K slots** — high volume, ideal for indexing.

*Lesson learned:* Sanctum Router had only ~2 instructions per 1K slots because most activity flows through the S Controller (Infinity pool). The Router is just a thin wrapper.

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
- `type: "solana"` - **Required for Solana chains** (not "evm")
- `fromBlock/toBlock` - Block range using Solana slot numbers (current ~300M+)
- `instructions` - Array of instruction filter objects
- `programId` - Program address (INDEXED - fast)
- `d1/d2/d4/d8` - Discriminators (INDEXED - function selectors)
- `a0-a31` - Account filters by position (INDEXED)
- `mentionsAccount` - Account appears anywhere (INDEXED)

---

## Understanding Discriminators

**Discriminators are Solana's function selectors** (similar to EVM sighash).

**Discriminator types:**
- `d1` - First 1 byte of data (SPL Token Program)
- `d2` - First 2 bytes of data
- `d4` - First 4 bytes of data
- `d8` - First 8 bytes of data (most common for Anchor programs)

**Computing discriminator (Anchor):**
```typescript
import { sha256 } from '@noble/hashes/sha256';

function getDiscriminator(name: string): string {
  const hash = sha256(Buffer.from(`global:${name}`));
  return '0x' + Buffer.from(hash).slice(0, 8).toString('hex');
}
```

**⚠️ Important:** Discriminator values are computed from the actual program IDL and may differ between program versions. Always verify against the specific program version.

---

## Examples

### Example 1: Track Jupiter Swap Instructions

```json
{
  "type": "solana",
  "fromBlock": 250000000,
  "toBlock": 250001000,
  "instructions": [{
    "programId": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
    "d8": ["0x5703feb8e7573909"]
  }],
  "fields": {
    "instruction": {
      "programId": true,
      "accounts": true,
      "data": true
    },
    "transaction": {
      "feePayer": true,
      "fee": true,
      "err": true
    }
  }
}
```

**Dataset:** `solana-mainnet` | **Program:** Jupiter Aggregator V6 | **Function:** sharedAccountsRoute

---

### Example 2: Track SPL Token Transfers

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

**Dataset:** `solana-mainnet` | **Program:** SPL Token Program | **Instruction:** Transfer (discriminator: 0x03)
**Notes:** `accounts[0]` = source, `accounts[1]` = destination, `accounts[2]` = authority

---

### Example 3: Track Wallet Activity (All Instructions)

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
      "signatures": true
    }
  }
}
```

**Notes:** `mentionsAccount` matches if the account appears ANYWHERE in accounts array. More expensive than `a0-a31` (position-specific) filters.

> **More examples:** See `references/additional-examples.md` for account position filtering, Raydium, Orca Whirlpool, token balance tracking, program deployments, and failed instructions.

---

## Available Fields

### Instruction Fields

```json
{
  "programId": true,            // Program being called
  "accounts": true,             // Array of account public keys
  "data": true,                 // Instruction data (hex string)
  "computeUnitsConsumed": true, // CU used by this instruction
  "transactionIndex": true,     // Transaction position in block
  "instructionAddress": true,   // Instruction position in transaction
  "isCommitted": true,          // Success/failure status
  "error": true,                // Error details if instruction failed
  "hasDroppedLogMessages": true,// Whether log messages were dropped
  "d1": true,                   // First 1 byte of data
  "d2": true,                   // First 2 bytes of data
  "d4": true,                   // First 4 bytes of data
  "d8": true                    // First 8 bytes of data
}
```

### Transaction Fields

> **COMMON MISTAKE:** The field is `"signatures"` (plural, array) NOT `"signature"`. Using `"signature"` causes an "unknown field" error from Portal.

```json
{
  "feePayer": true,             // Transaction initiator (wallet)
  "fee": true,                  // Transaction fee (lamports)
  "err": true,                  // Error object (null = success)
  "signatures": true,           // Transaction signatures (PLURAL — not "signature")
  "accountKeys": true,          // All account keys in transaction
  "version": true,              // Transaction version
  "computeUnitsConsumed": true, // CU used by transaction
  "addressTableLookups": true,  // Address lookup tables
  "hasDroppedLogMessages": true // Whether log messages were dropped
}
```

---

## INDEXED Fields for Filtering

**Fast filterable fields (use these for filters):**
- `programId` - INDEXED (always filter by this first - most selective)
- `d1, d2, d4, d8` - INDEXED (discriminators)
- `a0` through `a31` - INDEXED (account positions)
- `mentionsAccount` - INDEXED (slower than a0-a31)
- `isCommitted` - INDEXED (success/failure)

**Account filtering strategy:**
- Use `a0-a31` when you know the account position (faster)
- Use `mentionsAccount` when position is unknown or varies

---

## Common Mistakes

### ❌ Wrong Discriminator Length

```json
{
  "instructions": [{
    "programId": ["JUP6..."],
    "d1": ["0xe4"]  // ❌ Jupiter uses d8, not d1
  }]
}
```

**Fix:** Jupiter uses 8-byte discriminators: `"d8": ["0xe445a52e51cb9a1d"]`

---

### ❌ Filtering Without programId

```json
{
  "instructions": [{
    "d8": ["0xe445a52e51cb9a1d"]  // ❌ No programId filter
  }]
}
```

**Fix:** Always filter by `programId` first.

---

### ❌ Using EVM-Style Block Numbers

```json
{
  "type": "solana",
  "fromBlock": 19500000  // ❌ EVM block number - way too low
}
```

**Fix:** Use Solana slot numbers: `"fromBlock": 250000000` (current slot ~300M+)

---

### ❌ Forgetting Transaction Fields for Context

Include transaction context when you need fee payer or success status:
```json
{
  "fields": {
    "instruction": {"programId": true, "accounts": true},
    "transaction": {"feePayer": true, "err": true}
  }
}
```

---

## Response Format

Portal returns **JSON Lines** (one JSON object per line):

```json
{"header":{"number":250000000,"hash":"...","parentHash":"...","timestamp":1234567890}}
{"instructions":[{"programId":"JUP6...","accounts":["EPjF...","So11..."],"data":"0xe445a52e..."}],"transactions":[{"feePayer":"9WzD...","fee":5000,"err":null}]}
```

**Parsing:** Split by newlines, parse each line as JSON. First line = block header.

---

## Performance Tips

**Filter selectivity order (best to worst):**
1. `programId` + `d8` + `a0` (best)
2. `programId` + `d8`
3. `programId` + `mentionsAccount`
4. `programId` only

**Block range:** Solana processes ~2 slots/second. 1,000-10,000 slots ≈ 8-80 minutes of data.

---

## Related Skills

- **portal-dataset-discovery** - Find correct Solana dataset name
- **portal-query-evm-logs** - EVM equivalent (for comparison)

---

## Additional Resources

- **API Documentation:** https://beta.docs.sqd.dev/api/catalog/solana/stream
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Portal API Solana querying
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Portal documentation
- **[Solana OpenAPI Schema](https://beta.docs.sqd.dev/en/api/catalog/solana/openapi.yaml)** - Complete Solana query specification
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported Solana networks
