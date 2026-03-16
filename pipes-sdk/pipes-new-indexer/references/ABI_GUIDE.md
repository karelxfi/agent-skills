# ABI Guide

Reference for fetching, analyzing, and using contract ABIs in Pipes indexers.

## commonAbis (Built-in Standard ABIs)

Import pre-built ABIs for standard token interfaces - no fetching required:

```typescript
import { commonAbis } from "@subsquid/pipes/evm"

// Usage in evmDecoder
events: {
  transfers: commonAbis.erc20.events.Transfer,    // Transfer(from, to, value)
  approvals: commonAbis.erc20.events.Approval,    // Approval(owner, spender, value)
}

// ERC721
events: {
  transfers: commonAbis.erc721.events.Transfer,
}
```

Available in `commonAbis`: `erc20`, `erc721`, `erc1155`

## Fetching ABIs from Block Explorers

For custom/unknown contracts, use the block explorer APIs:

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
```

Save to `./abi/<contract_name>.json` then generate TypeScript types:

```bash
npx @subsquid/evm-typegen@latest \
  --abi ./abi/<contract_name>.json \
  --output ./abi/<contract_name>.ts
```

Import and use the generated types:

```typescript
import * as pool from "./abi/pool"

events: {
  swaps: pool.events.Swap,
  mints: pool.events.Mint,
}
```

## Solidity Type → BigInt Mapping

| Solidity Type | Use BigInt? | Notes |
|---------------|-------------|-------|
| `uint256`, `int256` | Always | `.toString()` before storing |
| `uint128`, `uint160`, `uint192`, `uint224` | Always | Too large for native integers |
| `uint64`, `uint96`, `uint112` | Yes | Can be large |
| `uint32`, `uint16`, `uint8` | No | Safe as Number |
| `int24`, `int32` | No | Safe as Number |
| `address` | N/A | Already a string |

## Struct/Tuple Parameters and bytes32

Some DeFi protocols use struct (tuple) parameters in events and `bytes32` identifiers (e.g., Morpho market IDs). The `evm-typegen` tool handles these automatically.

### bytes32 Fields

`bytes32` values are common as identifiers (market IDs, salt values, etc.). They decode to `string` in TypeScript:

```typescript
// In generated ABI
id: indexed(p.bytes32)

// Access in .pipe()
marketId: d.event.id  // string, "0x..." (66 chars)
```

Store as `FixedString(66)` in ClickHouse (same as transaction hashes).

### Struct (Tuple) Parameters

Events can include struct parameters. Typegen generates nested `p.struct()` definitions:

```typescript
// Generated code for Morpho's CreateMarket event
CreateMarket: event(
  '0xac4b2400...',
  'CreateMarket(bytes32,(address,address,address,address,uint256))',
  {
    id: indexed(p.bytes32),
    marketParams: p.struct({
      loanToken: p.address,
      collateralToken: p.address,
      oracle: p.address,
      irm: p.address,
      lltv: p.uint256,
    }),
  },
)

// Access in .pipe()
d.event.marketParams.loanToken       // address string
d.event.marketParams.lltv.toString() // BigInt → String
```

## Proxy Contract Detection and Handling

Many DeFi protocols use proxy contracts (e.g., Lido stETH, upgradeable vaults). Fetching the proxy ABI only gives you the proxy's interface, NOT the implementation's events.

### Signs of a Proxy

1. Very few events/functions (3-5) for a major protocol
2. Has `implementation()`, `admin()`, or `upgradeTo()` functions
3. Expected events are missing from the ABI

### Handling Proxies

**Option 1: Get the implementation ABI**

```bash
# Get implementation address
cast call <PROXY_ADDRESS> "implementation()" --rpc-url <RPC_URL>

# Then fetch implementation ABI using the address above
```

**Option 2: Use commonAbis (recommended when events are standard)**

```typescript
import { commonAbis } from "@subsquid/pipes/evm"
events: { transfers: commonAbis.erc20.events.Transfer }
```

**Option 3: Define events inline using topic hash**

Find the topic0 hash from the block explorer Events tab, then define inline:

```typescript
import { event, indexed } from '@subsquid/evm-abi'
import * as p from '@subsquid/evm-codec'

const Submitted = event(
  '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3c2c1e96a9a2a6f3b4e9e8e0c7f3',
  'Submitted(address,uint256,address)',
  { sender: indexed(p.address), amount: p.uint256, referral: p.address },
)

events: { submitted: Submitted }
```

## ABI Not Found

If the block explorer returns no ABI:
1. Contract may not be verified - provide the explorer URL for manual inspection
2. Wrong network - try the correct chain's explorer
3. It's a proxy - fetch the implementation ABI instead

## Protocol Research Workflow

For researching unknown protocols before fetching ABIs, see:
- `references/RESEARCH_CHECKLIST.md` in this skill's references directory
