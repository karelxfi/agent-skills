---
name: pipes-find-contracts
description: Finds actual contract addresses for protocols on specific chains using multiple authoritative sources including Addybook.xyz and contracts registry.
allowed-tools: [WebSearch, WebFetch, Read]
metadata:
  author: subsquid
  version: "1.0.0"
  category: research
---

# Pipes: Find Contracts

Find actual contract addresses for a protocol on a specific chain (not just governance token).

## When to Use This Skill

Activate when:
- User needs contract addresses for indexing
- User asks "where is the [protocol] contract on [chain]"
- User mentions finding deployment addresses
- Before creating an indexer for a protocol

## The Problem This Solves

DeFiLlama gives you the **governance token** address, but indexing requires **actual contract addresses**:

- DEX: Need factory address
- Lending: Need pool/aToken addresses
- Vaults: Need vault addresses
- Staking: Need staking contract addresses

**This skill finds them automatically.**

## Multi-Source Search Strategy

Execute these searches **in order of priority**:

### Source 1: Addybook.xyz (PRIMARY - Source of Truth)

**This is our contracts-registry-llm project deployed at https://addybook.xyz/**

**API Endpoint** (fastest, structured data):
```typescript
// Fetch full protocol index
WebFetch({
  url: "https://addybook.xyz/api/v1/search/index.json",
  prompt: "Find {protocol} and extract its contract addresses for {chain}"
})
```

**Protocol Page** (human-readable, detailed):
```typescript
// For specific protocol details
WebFetch({
  url: "https://addybook.xyz/protocols/{protocol-slug}",
  prompt: "Extract all contract addresses for {chain}"
})
```

**The API returns structured data with**:
- Contract addresses per chain
- Deployment blocks
- Verification status
- Key events and functions
- Source attribution

**If found in Addybook**: Return immediately with HIGH confidence

### Source 2: Contracts Registry GitHub (Fallback)

**Use index file** (35KB, fast):

```typescript
// FALLBACK - if addybook.xyz is unavailable
WebFetch({
  url: "https://raw.githubusercontent.com/karelxfi/contracts-registry-llm/main/data/generated/indexes/by-address.json",
  prompt: "Find contract addresses for {protocol} on {chain}"
})
```

**Chain-specific file** (if not found in index):

```typescript
// Available: ethereum.json, base.json, arbitrum.json, optimism.json, polygon.json, avalanche.json, bsc.json
WebFetch({
  url: "https://raw.githubusercontent.com/karelxfi/contracts-registry-llm/main/data/generated/by-chain/{chain}.json",
  prompt: "Find {protocol} addresses"
})
```

**If found in registry**: Return with high confidence

### Source 3: Protocol Documentation

```typescript
// Common doc patterns to check
const docPatterns = [
  `${protocol.url}/docs/deployments`,
  `https://docs.${domain}/deployed-contracts`,
  `https://docs.${domain}/developers/deployments`,
  `https://docs.${domain}/contracts/${chain}`,
]
```

**Known documentation patterns**:

**Aave**:
- Pattern: `https://docs.aave.com/developers/deployed-contracts/v3-mainnet`
- Structure: Lists Pool, PoolAddressesProvider, aTokens per chain

**Uniswap**:
- Pattern: `https://docs.uniswap.org/contracts/v3/reference/deployments`
- Structure: Table with Factory, Router, etc. per chain

**Action**: Use WebFetch to scrape docs and extract addresses

### Source 4: Block Explorer

Search block explorer for labeled contracts:

```bash
# For Ethereum
https://etherscan.io/accounts/label/{protocol-name}

# For Base
https://basescan.org/accounts/label/{protocol-name}
```

**Action**: Use WebFetch to search explorer, parse labeled contracts

## Aggregate and Rank Results

Combine all sources and assign confidence scores:

```typescript
interface ContractAddress {
  address: string
  label: string
  source: 'addybook' | 'registry' | 'docs' | 'github' | 'explorer'
  confidence: 'high' | 'medium' | 'low'
  verified: boolean  // If contract is verified on explorer
}

// Confidence ranking:
// - addybook + verified = HIGH
// - registry + verified = HIGH
// - docs + verified = HIGH
// - github + verified = MEDIUM
// - explorer labeled = MEDIUM
// - single source only = LOW
```

## Output Format

### Single Contract Type

```markdown
## {Protocol Name} on {Chain}

### {Contract Type} (e.g., "Factory", "Pool", "aUSDC Token")

**Address**: `0x...`
**Confidence**: High (found in Addybook + verified on explorer)

**Sources**:
- [Addybook](https://addybook.xyz/protocols/...)
- [Official Docs](https://docs.protocol.com/...)
- [Etherscan](https://etherscan.io/address/0x...) - Verified ✓

**Usage**:
```typescript
const FACTORY = '0x...'
evmDecoder({
  contracts: factory({
    address: FACTORY,
    event: factoryAbi.PoolCreated,
    parameter: 'pool',
  }),
})
```
```

### Multiple Contracts

```markdown
## {Protocol Name} on {Chain}

Found **3 contracts**:

### 1. Factory Contract
- **Address**: `0x...`
- **Confidence**: High
- **Sources**: Addybook, Docs, GitHub, Explorer (verified)
- **Use for**: Creating indexer with factory pattern

### 2. Pool Contract
- **Address**: `0x...`
- **Confidence**: High
- **Sources**: Addybook, Docs, Explorer (verified)
- **Use for**: Direct pool indexing

### Recommended Approach

For {protocol type}, use the **{recommended contract}**:
```typescript
{example code}
```
```

### Not Found

```markdown
## {Protocol Name} on {Chain}

**No contract addresses found**

**Searched**:
- Addybook: Not found
- Contracts Registry: Not found
- Protocol docs: Checked {url}, no addresses listed
- GitHub: No deployment files found
- Explorer: No labeled contracts found

### Next Steps

1. **Check protocol docs manually**: {protocol.url}
2. **Check GitHub**: {github_url if available}
3. **Search explorer**: {explorer_url}
4. **Ask user**: "Do you have the contract address for {protocol} on {chain}?"
```

## Report Missing Contracts

If addresses are NOT found in Addybook but discovered via docs/GitHub/explorer:

1. **Tell the user** to consider adding to Addybook
2. **Provide the repo link**: https://github.com/karelxfi/contracts-registry-llm
3. **Show the format** needed for contribution

## Real-World Examples

### Example 1: Aave V3 on Ethereum

**Input**: User asks for Aave V3 addresses on Ethereum

**Process**:
1. Check Addybook → Found
2. Verify addresses:
   - Pool: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
   - aUSDC: 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c
3. Verify on Etherscan → Both verified ✓

**Output**: Return addresses with high confidence

### Example 2: Uniswap V3 on Base

**Input**: User asks for Uniswap V3 Factory on Base

**Process**:
1. Check Addybook → Found
2. Extract factory address: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
3. Verify on Basescan → Verified ✓

**Output**: Return factory address with usage example

## Advanced Features

### Feature 1: Type-Specific Search

```bash
# Only returns aToken addresses:
# - aUSDC: 0x...
# - aWETH: 0x...
```

### Feature 2: Multi-Chain Search

```bash
# Returns factory addresses for ALL chains
```

## Protocol-Specific Helpers

### Aave V3

```typescript
// Known patterns:
// - Pool: Main lending pool contract
// - aTokens: Interest-bearing tokens (aUSDC, aWETH, etc.)
// - PoolAddressesProvider: Registry of pool addresses

// For deposits/withdrawals: Use aToken addresses
// For liquidations: Use Pool address
```

### Uniswap V3

```typescript
// Known patterns:
// - Factory: Creates pools
// - Router: Swap router (not usually needed for indexing)
// - NFTPositionManager: LP position NFTs

// For swaps: Use Factory with factory pattern
// For LP tracking: Use NFTPositionManager
```

## Error Handling

### If docs WebFetch fails
→ Try GitHub
→ Fall back to explorer
→ Ask user

### If GitHub 404
→ Try alternative repo names
→ Try organization search
→ Fall back to docs/explorer

### If all sources fail
→ Provide manual search instructions
→ Give example search queries
→ Suggest asking in protocol Discord/Twitter

## Related Skills

- [pipes-research-protocol](../pipes-research-protocol/SKILL.md) - Full protocol research
- [pipes-abi](../pipes-abi/SKILL.md) - Fetch contract ABIs
- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexers
- [pipes-orchestrator](../pipes-orchestrator/SKILL.md) - Routes to this skill
