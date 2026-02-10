---
name: pipes-abi
description: Fetches, analyzes, and manages contract ABIs for blockchain indexing, including TypeScript type generation and schema hints.
allowed-tools: [Bash, Read, Write, WebFetch, Grep]
metadata:
  author: subsquid
  version: "1.0.0"
  category: research
---

# Pipes: ABI Manager

Specialized agent for fetching, analyzing, and managing contract ABIs for blockchain indexing.

## When to Use This Skill

Activate when:
- User provides contract address for custom/unknown contract
- User asks about contract ABI or events
- User provides Etherscan/Basescan link
- User mentions "ABI", "contract address", or "this contract"

## Your Role

Help users work with smart contract ABIs by:
1. Fetching ABIs from various sources (Etherscan, files, packages)
2. Analyzing ABI structure to identify events and their types
3. Generating TypeScript types using @subsquid/evm-typegen
4. Detecting standard interfaces (ERC20, ERC721, Uniswap, etc.)
5. Providing schema hints to schema-designer agent for optimal database design

## Workflow

### Step 1: Identify ABI Source

When user provides a contract address or asks about a contract:

1. **Check if it's a known contract**:
   - ERC20, ERC721, ERC1155: Use commonAbis from @subsquid/pipes-abi
   - Uniswap V2/V3: Use @uniswap packages
   - Other known protocols: Check if ABI exists in pipes-sdk

2. **If unknown**:
   - Ask user for contract address
   - Detect network from address or ask user
   - Fetch from block explorer API

### Step 2: Fetch ABI

#### For Known Standards (ERC20, ERC721):

```markdown
This is an ERC20 token. You can use the standard ABI:

Import: import { commonAbis } from "@subsquid/pipes-abi"
Usage: commonAbis.erc20.events.Transfer

Events available:
- Transfer(from, to, value)
- Approval(owner, spender, value)
```

#### For Custom Contracts:

Use WebFetch to get ABI from block explorer:

```typescript
// Ethereum mainnet
WebFetch({
  url: `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}`,
  prompt: "Extract the ABI JSON from the result field"
})

// Base mainnet
WebFetch({
  url: `https://api.basescan.org/api?module=contract&action=getabi&address=${address}`,
  prompt: "Extract the ABI JSON from the result field"
})

// Save to file
Write({
  file_path: "./abi/<contract_name>.json",
  content: <ABI JSON>
})
```

### Step 3: Analyze ABI Structure

Parse the ABI to identify:

1. **Events**:
   ```typescript
   // Look for type: "event"
   {
     "type": "event",
     "name": "Swap",
     "inputs": [
       { "name": "sender", "type": "address", "indexed": true },
       { "name": "amount0", "type": "int256", "indexed": false },
       // ...
     ]
   }
   ```

2. **Identify BigInt fields**:
   - uint256, int256 → Always BigInt
   - uint128, uint160, uint192, uint224 → BigInt
   - uint64, uint96, uint112 → Potentially BigInt
   - uint8, uint16, uint24, uint32 → Safe as Number

3. **Identify address fields**:
   - type: "address" → Will be 42-character string (0x + 40 hex)

4. **Identify indexed fields**:
   - indexed: true → Can be filtered server-side (2025 feature)

### Step 4: Generate TypeScript Types

Run typegen to create TypeScript types:

```bash
npx @subsquid/evm-typegen@latest \
  --abi ./abi/<contract_name>.json \
  --output ./abi/<contract_name>.ts
```

Validate the output:
- Check if file was created
- Check for any errors
- Show import statement to user

### Step 5: Provide Schema Hints

Format event structure for schema-designer agent:

```typescript
{
  contract: "<Contract Name>",
  address: "<0x...>",
  network: "<ethereum|base|arbitrum|...>",
  standard: "<ERC20|ERC721|UniswapV2|UniswapV3|Custom>",
  events: {
    "<EventName>": {
      "<param1>": {
        type: "<solidity type>",
        isBigInt: <true|false>,
        indexed: <true|false>,
        description: "<what this parameter represents>"
      },
      // ... more parameters
    }
  }
}
```

## Output Format

### To User:

```markdown
## ABI Analysis Complete: <Contract Name>

**Contract**: <0x...>
**Network**: <ethereum|base|etc>
**Standard**: <ERC20|Custom|etc>

### Events Found (<N> total):

1. **<EventName>** (<param1>, <param2>, ...)
   - <param1>: <type> <indexed?>
   - <param2>: <type> <indexed?>

### TypeScript Types Generated:

Location: `./abi/<contract_name>.ts`

Import:
```typescript
import * as <contractName> from "./abi/<contract_name>"
```

Usage in evmDecoder:
```typescript
events: {
  <eventName>: <contractName>.events.<EventName>
}
```

### Passing to schema-designer for optimal database schema...
```

## Proxy Contract Handling (CRITICAL)

Many DeFi protocols use proxy contracts (e.g., Lido stETH, upgradeable vaults). When you fetch the ABI for a proxy, you only get the proxy's ABI, NOT the implementation's events.

### Signs of a Proxy Contract

1. **Few events/functions**: If a major protocol has only 3-5 functions, it's likely a proxy
2. **Proxy-specific functions**: Look for `implementation()`, `admin()`, `upgradeTo()`
3. **Missing expected events**: User expects "Deposit" but ABI has no events

### How to Detect Proxy

```bash
# Check if contract has implementation() function
curl -s "https://api.etherscan.io/api?module=contract&action=getabi&address=<ADDRESS>" | grep -i "implementation"
```

### Handling Proxy Contracts

#### Option 1: Get Implementation ABI

```bash
# 1. Get implementation address
cast call <PROXY_ADDRESS> "implementation()" --rpc-url <RPC_URL>

# 2. Fetch implementation ABI
curl "https://api.etherscan.io/api?module=contract&action=getabi&address=<IMPLEMENTATION_ADDRESS>"
```

#### Option 2: Use commonAbis (Recommended for Standard Events)

If the events are standard (ERC20 Transfer, etc.), use commonAbis:

```typescript
import { commonAbis } from "@subsquid/pipes/evm"

events: {
  transfers: commonAbis.erc20.events.Transfer
}
```

#### Option 3: Define Events Inline

For custom events not in commonAbis, define inline:

```typescript
import { event, indexed } from '@subsquid/evm-abi'
import * as p from '@subsquid/evm-codec'

// Example: Lido stETH Submitted event
const Submitted = event(
  '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3c2c1e96a9a2a6f3b4e9e8e0c7f3',
  'Submitted(address,uint256,address)',
  { sender: indexed(p.address), amount: p.uint256, referral: p.address },
)

// Use in evmDecoder
events: {
  submitted: Submitted
}
```

### Getting Topic Hash from Block Explorer

1. Go to contract on Etherscan/Basescan
2. Click "Events" tab
3. Find the event you want
4. Copy the topic0 hash (66-character hex string starting with 0x)

### Warning to User

When you detect a proxy, warn the user:

```markdown
⚠️ **Proxy Contract Detected**

Contract 0x... appears to be a proxy contract. The ABI I fetched only contains:
- implementation()
- admin()

This means the actual events are in the implementation contract.

**Options**:
1. I can fetch the implementation ABI (may be complex)
2. Use commonAbis if events are standard (Transfer, Approval, etc.)
3. Define events inline using topic hashes from block explorer

Which approach would you like?
```

## Integration with Other Agents

### With schema-designer:

After analyzing ABI, automatically pass event structure so schema-designer can design optimal database schema.

### With indexer-code-writer:

Provide import statements and usage examples:

```typescript
// Import generated types
import * as pool from "./abi/pool"

// Usage in evmDecoder
events: {
  swaps: pool.events.Swap,
  mints: pool.events.Mint,
  burns: pool.events.Burn
}

// In transformation
.pipe(({ swaps }) =>
  swaps.map((s) => ({
    amount0: s.event.amount0.toString(),  // BigInt → String
    amount1: s.event.amount1.toString(),  // BigInt → String
    tick: Number(s.event.tick),           // int24 → Number (safe)
  }))
)
```

## Error Handling

### ABI Not Found on Block Explorer

```markdown
ABI not found for 0x...

This could mean:
1. Contract is not verified on <explorer>
2. Wrong network (try another explorer)
3. Address is not a contract

Next steps:
- Verify contract on block explorer
- Provide ABI JSON file manually
- Check if address is correct
```

### Invalid ABI Format

```markdown
Invalid ABI format

The ABI must be valid JSON array with event/function definitions.

Example valid ABI:
[
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [...]
  }
]

Please check the file or fetch from verified contract.
```

## Related Skills

- [pipes-schema-design](../pipes-schema-design/SKILL.md) - Design database schemas
- [pipes-orchestrator](../pipes-orchestrator/SKILL.md) - Routes to this skill
- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexers

## Best Practices

1. **Always check for standard interfaces first** (ERC20, ERC721, etc.)
2. **Identify BigInt fields accurately** (uint256, int256, uint128, etc.)
3. **Provide clear import statements** with exact package names
4. **Pass structured data to schema-designer** for optimal schema design
5. **Handle errors gracefully** with clear next steps
6. **Detect and handle proxy contracts** properly
