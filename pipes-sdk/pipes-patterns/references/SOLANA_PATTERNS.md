# Solana Patterns Reference

A comprehensive guide to building Subsquid Pipes SDK pipelines for Solana blockchain.

## Table of Contents

- [Overview](#overview)
- [Pattern 1: Instruction Discriminators](#pattern-1-instruction-discriminators)
- [Pattern 2: Inner Instructions](#pattern-2-inner-instructions)
- [Pattern 3: Token Balance Tracking](#pattern-3-token-balance-tracking)
- [Solana API Reference](#solana-api-reference)
- [Best Practices](#best-practices)

---

## Overview

Solana pipelines use `@subsquid/pipes/solana` to decode program instructions from the Solana blockchain. Key differences from EVM:

| Aspect | EVM | Solana |
|--------|-----|--------|
| **Data unit** | Events (logs) | Instructions |
| **Addressing** | Contract addresses (0x...) | Program IDs (base58) |
| **Filtering** | Event signatures | Instruction discriminators (d1/d2/d4/d8) |
| **Nesting** | No native nesting | Inner instructions |
| **Token tracking** | Manual balance calculation | Built-in token balance context |

---

## Pattern 1: Instruction Discriminators

**Use Case**: Decode Solana program instructions by discriminator bytes.

**Validated By**: Pipeline 16 (Solana discriminators)

**Code Example**:

```typescript
// FILE: src/index.ts
// REPLACES: <new file>
// DEPENDENCIES: @subsquid/pipes@^5.0.0

import { solanaPortalSource, solanaDecoder } from "@subsquid/pipes/solana";

// Replace with your program ID
const SERUM_DEX_PROGRAM = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

// Replace with your block range
const FROM_SLOT = 317_617_000;
const TO_SLOT = 317_620_000;

const stream = solanaPortalSource({
  portal: "https://portal.sqd.dev/datasets/solana-mainnet",
}).pipe(
  solanaDecoder({
    range: { from: FROM_SLOT, to: TO_SLOT },
    
    instructions: [{
      programId: SERUM_DEX_PROGRAM,
      
      // Choose one discriminator type:
      
      // d1: First byte (1 byte discriminator)
      d1: "0x00",  // InitializeMarket
      
      // d2: First 2 bytes (2 byte discriminator)
      // d2: "0x0001",
      
      // d4: First 4 bytes (4 byte discriminator)
      // d4: "0x00000001",
      
      // d8: First 8 bytes (8 byte discriminator - Anchor standard)
      // d8: "0x0000000000000001",
    }],
  })
);

// Process instructions
for await (const { data } of stream) {
  for (const ix of data.instructions) {
    console.log({
      programId: ix.programId,           // base58 string
      discriminator: ix.data.slice(0, 16), // hex string
      slot: ix.block.slot,                // uint64
      txHash: ix.transaction.id,          // base58 string
    });
    
    // Decode instruction data based on discriminator
    // Your program-specific decoding logic here
  }
}
```

### Discriminator Types

| Type | Bytes | Use Case | Example Programs |
|------|-------|----------|------------------|
| **d1** | 1 | Simple/legacy programs | SPL Token (legacy), early Solana programs |
| **d2** | 2 | Medium complexity | Token program variants |
| **d4** | 4 | Complex programs | Serum DEX v3 |
| **d8** | 8 | Anchor programs (standard) | Most modern Solana programs (Mango, Jupiter, etc.) |

**Anchor discriminators**: Anchor framework uses 8-byte discriminators computed as:
```
discriminator = sha256("global:{instruction_name}")[0..8]
```

### When to Use

- Solana program instructions
- Known discriminator values
- Anchor-based programs (always use d8)
- Want server-side filtering for efficiency
- Need to track specific instruction types

### When Not to Use

- EVM chains (use `evmDecoder` instead)
- Unknown discriminators (fetch all, decode client-side)
- Need all instruction types (omit discriminator filter)

---

## Pattern 2: Inner Instructions

**Use Case**: Track nested instructions executed by a parent instruction (e.g., DEX swaps that invoke token transfers).

**Validated By**: Pipeline 17 (Inner instructions)

**Code Example**:

```typescript
// FILE: src/index.ts
// REPLACES: <new file>
// DEPENDENCIES: @subsquid/pipes@^5.0.0

import { solanaPortalSource, solanaDecoder } from "@subsquid/pipes/solana";

// Replace with your program ID
const JUPITER_V6 = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

const stream = solanaPortalSource({
  portal: "https://portal.sqd.dev/datasets/solana-mainnet",
}).pipe(
  solanaDecoder({
    range: { from: 317_617_000, to: 317_620_000 },
    
    instructions: [{
      programId: JUPITER_V6,
      d8: "0xe445a52e51cb9a1d", // Anchor discriminator for "swap"
      
      // Enable inner instructions
      includeInnerInstructions: true,
    }],
  })
);

// Track swap hierarchy
for await (const { data } of stream) {
  for (const swap of data.instructions) {
    console.log(`Parent swap: ${swap.transaction.id}`);
    console.log(`  Instruction index: ${swap.instructionIndex}`);
    
    // Inner instructions are child operations
    if (swap.innerInstructions && swap.innerInstructions.length > 0) {
      console.log(`  Inner instructions: ${swap.innerInstructions.length}`);
      
      for (const inner of swap.innerInstructions) {
        console.log(`    - Program: ${inner.programId}`);
        console.log(`      Index: ${inner.instructionIndex}`);
        // Often token transfers, account creations, etc.
      }
    }
  }
}
```

### Inner Instruction Hierarchy

```
Transaction
├── Instruction 0 (Jupiter Swap) ← Parent
│   ├── Inner Instruction 0 (Token Transfer) ← Child
│   ├── Inner Instruction 1 (Token Transfer) ← Child
│   └── Inner Instruction 2 (Close Account) ← Child
├── Instruction 1 (Some other instruction)
└── Instruction 2 (Another instruction)
```

### Common Inner Instruction Patterns

| Parent Program | Inner Instructions Triggered |
|----------------|------------------------------|
| Jupiter/DEX aggregator | Token transfers (SPL Token), account operations |
| Raydium | Token transfers, liquidity operations |
| Orca | Token transfers, position updates |
| Solana Program Library (SPL) | Associated token account creation |

### When to Use

- DEX aggregators (Jupiter, 1inch)
- Complex DeFi protocols
- Need full transaction context
- Tracking cross-program invocations

### When Not to Use

- Simple single-program queries
- Only need top-level instructions
- Performance critical (adds data overhead)

---

## Pattern 3: Token Balance Tracking

**Use Case**: Track token balance changes per instruction without manual calculation.

**Validated By**: Pipeline 17 (Token balances)

**Code Example**:

```typescript
// FILE: src/index.ts
// REPLACES: <new file>
// DEPENDENCIES: @subsquid/pipes@^5.0.0

import { solanaPortalSource, solanaDecoder } from "@subsquid/pipes/solana";

// Replace with your token mint address
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const stream = solanaPortalSource({
  portal: "https://portal.sqd.dev/datasets/solana-mainnet",
}).pipe(
  solanaDecoder({
    range: { from: 317_617_000, to: 317_620_000 },
    
    instructions: [{
      programId: "11111111111111111111111111111111", // SPL Token Program
      
      // Enable token balance context
      includeTokenBalances: true,
    }],
  })
);

// Track balance changes
for await (const { data } of stream) {
  for (const ix of data.instructions) {
    if (ix.tokenBalances) {
      for (const balance of ix.tokenBalances) {
        // Pre-instruction balance
        const preBalance = balance.preBalance || 0n;
        
        // Post-instruction balance
        const postBalance = balance.postBalance || 0n;
        
        // Calculate delta
        const delta = postBalance - preBalance;
        
        if (delta !== 0n) {
          console.log({
            account: balance.account,       // Token account address
            mint: balance.mint,             // Token mint address
            owner: balance.owner,           // Owner of token account
            preBalance: preBalance.toString(),
            postBalance: postBalance.toString(),
            delta: delta.toString(),
            decimals: balance.decimals,     // Token decimals
          });
        }
      }
    }
  }
}
```

### Token Balance Context

Each token balance entry provides:

```typescript
// Type definition with JSON schema comments
type TokenBalance = {
  account: string;        // Token account pubkey (base58)
  mint: string;           // Token mint pubkey (base58)
  owner: string;          // Token account owner pubkey (base58)
  preBalance: bigint;     // Balance before instruction (lamports/smallest unit)
  postBalance: bigint;    // Balance after instruction (lamports/smallest unit)
  decimals: number;       // Token decimals for display conversion
};
```

### When to Use

- Track token transfers without decoding instruction data
- Portfolio tracking
- Liquidity monitoring
- Whale tracking
- Need accurate balance deltas

### When Not to Use

- Only need instruction-level data
- Non-token instructions (Native SOL transfers)
- Performance critical (adds overhead)

---

## Solana API Reference

### Portal Source

```typescript
import { solanaPortalSource } from "@subsquid/pipes/solana";

solanaPortalSource({
  portal: "https://portal.sqd.dev/datasets/solana-mainnet",
  // OR
  // portal: "https://portal.sqd.dev/datasets/solana-devnet",
  
  query: {
    from: 317_617_000,    // Start slot
    // OR
    from: "latest",       // Real-time
    
    to: 317_620_000,      // End slot (optional)
    
    includeAllBlocks: true, // Include empty blocks (default: false)
  },
})
```

**Available networks**:
- `solana-mainnet` - Production network (supports real-time via `/finalized-stream`)
- `solana-devnet` - Development network (supports real-time via `/finalized-stream`)

### Decoder

```typescript
import { solanaDecoder } from "@subsquid/pipes/solana";

solanaDecoder({
  // Slot range
  range: {
    from: 317_617_000,
    to: 317_620_000,
  },
  
  // Instructions to decode
  instructions: [{
    programId: "ProgramIdBase58String",
    
    // Discriminator (choose one)
    d1: "0x00",                    // 1 byte
    d2: "0x0001",                  // 2 bytes
    d4: "0x00000001",              // 4 bytes
    d8: "0x0000000000000001",      // 8 bytes (Anchor standard)
    
    // Optional: Include nested operations
    includeInnerInstructions: true,
    
    // Optional: Include token balance changes
    includeTokenBalances: true,
  }],
  
  // Optional: Track account balances (SOL)
  balances: {
    accounts: ["pubkey1Base58", "pubkey2Base58"],
  },
  
  // Optional: Track validator rewards
  rewards: {
    validators: ["validatorPubkeyBase58"],
  },
})
```

### Instruction Data Structure

```typescript
// Type definition with JSON schema comments
type SolanaInstruction = {
  programId: string;              // Program ID (base58)
  data: string;                   // Instruction data (hex)
  instructionIndex: number;       // Index in transaction
  accounts: string[];             // Account pubkeys involved (base58)
  
  block: {
    slot: number;                 // uint64
    hash: string;                 // Block hash (base58)
    parentSlot: number;           // Parent slot
    timestamp: number;            // Unix timestamp in seconds
  };
  
  transaction: {
    id: string;                   // Transaction signature (base58)
    fee: bigint;                  // Transaction fee in lamports
    success: boolean;             // Transaction success status
  };
  
  // Optional fields (if requested)
  innerInstructions?: SolanaInstruction[];  // Nested instructions
  tokenBalances?: TokenBalance[];           // Token balance changes
};
```

---

## Best Practices

### 1. Use Appropriate Discriminator Size

```typescript
// Correct: d8 for Anchor programs
solanaDecoder({
  instructions: [{
    programId: MODERN_ANCHOR_PROGRAM,
    d8: "0x1234567890abcdef", // 8 bytes for Anchor
  }],
})

// Wrong: d1 for Anchor programs
solanaDecoder({
  instructions: [{
    programId: MODERN_ANCHOR_PROGRAM,
    d1: "0x12", // Too short, will miss instructions
  }],
})
```

### 2. Enable Inner Instructions for DEX Aggregators

```typescript
// Correct: Track full swap path
solanaDecoder({
  instructions: [{
    programId: JUPITER_V6,
    d8: SWAP_DISCRIMINATOR,
    includeInnerInstructions: true, // See token transfers
  }],
})
```

### 3. Use Token Balances for Accurate Tracking

```typescript
// Correct: Let SDK handle balance calculation
solanaDecoder({
  instructions: [{
    programId: SPL_TOKEN_PROGRAM,
    includeTokenBalances: true, // Automatic balance deltas
  }],
})

// Wrong: Manual parsing of instruction data
// (error-prone, requires knowing all instruction formats)
```

### 4. Filter at Decoder Level

```typescript
// Correct: Server-side filtering
solanaDecoder({
  instructions: [{
    programId: TARGET_PROGRAM,
    d8: SPECIFIC_INSTRUCTION, // Only fetch this instruction type
  }],
})

// Wrong: Fetch all, filter client-side
solanaDecoder({
  instructions: [{
    programId: TARGET_PROGRAM,
    // No discriminator = fetch all instruction types
  }],
}).pipe((data) => {
  return data.instructions.filter(/* manual filter */);
})
```

### 5. Handle Slot Numbers (uint64)

```typescript
// Solana uses slots (not blocks)
// Slots are uint64 - use numbers or BigInt for large values

const FROM_SLOT = 317_617_000; // Recent slots are safe as numbers
const TO_SLOT = 317_620_000;

// For very large slot numbers, use BigInt if needed
const FUTURE_SLOT = 400_000_000n;
```

---

## Common Solana Programs

| Program | Program ID | Use Case | Discriminator Type |
|---------|-----------|----------|-------------------|
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Token transfers, mints | d1/d2 |
| SPL Token 2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | Extended token features | d1/d2 |
| Jupiter V6 | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` | DEX aggregator | d8 (Anchor) |
| Raydium AMM | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` | Raydium swaps | d8 (Anchor) |
| Orca | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` | Whirlpool DEX | d8 (Anchor) |
| Serum DEX V3 | `9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin` | Order book DEX | d4 |
| Metaplex | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` | NFT minting | d8 (Anchor) |

---

## Performance Considerations

- **Discriminator filtering**: Always use discriminators when possible to reduce data transfer
- **Inner instructions**: Adds ~2-3x data overhead - only enable when needed
- **Token balances**: Adds ~1-2x data overhead per instruction with token operations
- **Slot ranges**: Solana produces ~2.5 slots/second - plan ranges accordingly

---

## Related Resources

- **EVM Patterns**: See [EVM_PATTERNS.md](EVM_PATTERNS.md) for EVM-specific patterns
- **Portal API**: See [PORTAL_API.md](PORTAL_API.md) for direct API access
- **Performance**: See [PERFORMANCE.md](PERFORMANCE.md) for optimization tips
- **Troubleshooting**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
