---
name: pipes-new-indexer
description: Create a new blockchain indexer project using Pipes CLI with templates for EVM, Solana, and Hyperliquid chains. Use when starting a new indexer from scratch.
compatibility: Requires npm/npx for @iankressin/pipes-cli
allowed-tools: [Bash, Read, Write]
metadata:
  author: subsquid
  version: "2.0.0"
  category: core
---

# Pipes: New Indexer

Create new blockchain indexer projects using the Pipes CLI.

## When to Use This Skill

Activate when user wants to:
- Create a new indexer from scratch
- Generate a project with templates (ERC20, Uniswap V3, etc.)
- Start indexing a new blockchain protocol
- Set up a fresh indexer with proper structure
- Build a Hyperliquid perpetual futures fills indexer

## Overview

The Pipes CLI (`@iankressin/pipes-cli`) provides an interactive scaffolding tool that generates production-ready indexer projects with built-in templates for common use cases.

## Available Templates

Use `npx @iankressin/pipes-cli@latest init --schema` to see the full list of available templates and their parameter schemas.

### EVM Templates

**erc20Transfers** - Track ERC20 token transfers:
```json
{"templateId": "erc20Transfers", "params": {"contractAddresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], "range": {"from": "21000000"}}}
```

**uniswapV3Swaps** - Track Uniswap V3 swap events via factory pattern:
```json
{"templateId": "uniswapV3Swaps", "params": {"factoryAddress": "0x1F98431c8aD98523631AE4a59f267346ea31F984", "range": {"from": "21000000"}}}
```

**custom** - Custom contract events (**requires full ABI event objects, NOT just event names**):
```json
{"templateId": "custom", "params": {"contracts": [{"contractAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "contractName": "WETH", "contractEvents": [{"name": "Deposit", "type": "event", "inputs": [{"name": "dst", "type": "address", "indexed": true}, {"name": "wad", "type": "uint256"}]}, {"name": "Withdrawal", "type": "event", "inputs": [{"name": "src", "type": "address", "indexed": true}, {"name": "wad", "type": "uint256"}]}], "range": {"from": "21000000"}}]}}
```

**COMMON MISTAKE**: Passing `"contractEvents": ["Deposit", "Withdrawal"]` (just names) will fail with `Invalid input: expected array, received undefined`. Each event must be a full ABI object with `name`, `type`, and `inputs` fields. For indexed parameters, include `"indexed": true`.

### SVM (Solana) Templates
- **custom** - Start with a blank template for custom logic

**CRITICAL**: Template IDs must use camelCase format. Each template has specific required `params` - check the schema.

### Hyperliquid Fills (No CLI Template — Manual Setup)

The Pipes SDK supports Hyperliquid fills natively via `@subsquid/pipes/hyperliquid`, but there is **no CLI template yet**. You must scaffold the project manually.

**Import:**
```typescript
import { hyperliquidFillsPortalSource, HyperliquidFillsQueryBuilder } from '@subsquid/pipes/hyperliquid'
```

**Query builder pattern:**
```typescript
const query = new HyperliquidFillsQueryBuilder()
  .addRange({ from: 920000000 })
  .addFields({
    block: { number: true, timestamp: true },
    fill: {
      user: true, coin: true, px: true, sz: true,
      side: true, dir: true, closedPnl: true,
      fee: true, feeToken: true, crossed: true, startPosition: true,
    },
  })
  .addFill({ range: { from: 920000000 }, request: { coin: ['BTC', 'ETH', 'SOL'] } })
```

**CRITICAL**: `.addFill()` requires a `range` parameter — passing only `{ request: {...} }` will crash with `Cannot read properties of undefined (reading 'from')`.

**Choosing a start block:** Blocks increment at ~1/second. Use `current_block - (days × 86400)` to estimate. For a 7-day window, subtract ~604,800 from the current head block. A 7-day BTC/ETH/SOL sync yields ~6M fills in ~2-3 minutes.

**Source:**
```typescript
await hyperliquidFillsPortalSource({
  portal: 'https://portal.sqd.dev/datasets/hyperliquid-fills',
  query,
})
```

**Data shape:** Each block has `header` (number, timestamp) and `fills` array. Use `.pipe()` to transform:
```typescript
.pipe(({ blocks }) => {
  const fills = blocks.flatMap((block) =>
    block.fills.map((fill) => ({
      block_number: block.header.number,
      timestamp: new Date(block.header.timestamp).toISOString(),
      user: fill.user,
      coin: fill.coin,
      px: fill.px,
      sz: fill.sz,
      side: fill.side === 'B' ? 'Buy' : 'Sell',
      dir: fill.dir,
      closed_pnl: fill.closedPnl,
      fee: fill.fee,
      notional: fill.px * fill.sz,
      sign: 1,
    })),
  )
  return { fills }
})
```

**Key differences from EVM indexers:**
- No `evmDecoder` — use `HyperliquidFillsQueryBuilder` + `.pipe()` directly
- Dataset starts at block **750,000,000** (not block 0)
- Timestamps are in **milliseconds**. Use `new Date(block.header.timestamp).toISOString()` for ClickHouse (with `date_time_input_format: 'best_effort'`). Unlike EVM indexers, you do NOT divide by 1000 — the ISO string approach handles it.
- `side` is `'B'` (buy) or `'S'` (sell) — single character codes. The pipe transform maps these to `'Buy'`/`'Sell'` for ClickHouse, so SQL queries use the mapped values.
- `dir` values: `"Open Long"`, `"Close Long"`, `"Open Short"`, `"Close Short"`, `"Long > Short"`, `"Short > Long"`, `"Net Child Vaults"`
- All numeric values (`px`, `sz`, `closedPnl`, `fee`) are native floats, not BigInt
- `closedPnl` is only non-zero for closing trades
- `fee` can be negative (maker rebate)

**Fill filter options** (pass in `addFill({ request: {...} })`):
- `coin` — Filter by asset: `['BTC', 'ETH', 'SOL']`
- `user` — Filter by trader address: `['0x...']`
- `dir` — Filter by direction: `['Open Long', 'Close Short']`
- `feeToken` — Filter by fee denomination
- `builder` — Filter by builder address

**ClickHouse schema for fills:**
```sql
CREATE TABLE IF NOT EXISTS hl_fills (
    block_number UInt64,
    timestamp DateTime64(3, 'UTC'),
    user LowCardinality(String),
    coin LowCardinality(String),
    px Float64,
    sz Float64,
    side LowCardinality(String),
    dir LowCardinality(String),
    closed_pnl Float64,
    fee Float64,
    notional Float64,
    sign Int8
) ENGINE = CollapsingMergeTree(sign)
ORDER BY (coin, block_number, user, dir)
PARTITION BY toYYYYMM(timestamp);
```

**Common use cases (tested):**
- **Whale tracker** — filter by `user` to track specific whale addresses, monitor PnL and positions (894K fills for 5 whales in 60s)
- **Multi-coin volume** — filter by `coin` with 10+ assets including HYPE, DOGE, WIF (2.35M fills for 9 coins in 60s)
- **Perps analytics** — track all fills for majors, aggregate daily volume and long/short ratios (5M fills in 70s)

**Coin tickers:** Use uppercase symbols: `BTC`, `ETH`, `SOL`, `HYPE`, `DOGE`, `WIF`, `ARB`, `SUI`, `AVAX`, etc. Some tokens use prefixed tickers: `kPEPE` (not `PEPE`), `kBONK`, `kFLOKI`, `cash:GOLD`, `cash:TSLA`, `xyz:GOLD`. Not all tokens use obvious tickers — run a broad query first to discover available coins.

**Computed fields:** The `notional` field (`fill.px * fill.sz`) is NOT a native fill field — it's computed in the `.pipe()` transform. Native fields are listed in the addFields section above.

See `references/HYPERLIQUID_GUIDE.md` for the complete manual setup walkthrough, use case examples, and SQL queries.

## Supported Sinks
- **ClickHouse** - High-performance analytics database (recommended)
- **PostgreSQL** - Relational database with Drizzle ORM

**Note:** Memory sink is listed in the schema but not yet implemented in the CLI.

## Node.js Version Requirement

**Use Node.js LTS (v20 or v22).** Node.js v25.x has known zstd decompression bugs that cause random crashes during Portal data streaming. If `node --version` shows v25.x, switch to LTS:

```bash
# Option 1: nvm (if installed)
nvm install 22
nvm use 22

# Option 2: Homebrew (macOS)
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# Option 3: Direct download
# Visit https://nodejs.org/ and install the LTS version
```

If you cannot switch Node versions, the indexer may still work for smaller syncs. The zstd bug tends to crash on large syncs (millions of blocks). For quick tests with recent blocks, v25 often works.

## How to Use the CLI

### CLI Known Issue: `ora` ESM/CJS Crash

The CLI `init` command crashes with `(0 , import_ora.default) is not a function` on **every** `init` call. This is because the CLI bundles ESM-only `ora` v6+ as CJS. The `--schema` and `--version` commands still work.

**IMPORTANT: This happens on every `init` call, not just the first time.** Additionally, `npx` may re-download the CLI at any time, overwriting any previous patch. You must patch before every `init`.

**Automatic pre-flight patch (MANDATORY before every `init`):**

Run this before EVERY `npx @iankressin/pipes-cli@latest init` call:
```bash
# Pre-flight: ensure CLI is cached, then patch ora
npx @iankressin/pipes-cli@latest --version 2>/dev/null || true
CLI_PATH=$(find ~/.npm/_npx -name "index.cjs" -path "*pipes-cli*" 2>/dev/null | head -1)
if [ -n "$CLI_PATH" ] && ! grep -q 'import_ora = { default: function' "$CLI_PATH"; then
  sed -i.bak 's/var import_ora = __toESM(require("ora"), 1);/var import_ora = { default: function(opts) { var t = typeof opts === "string" ? opts : (opts \&\& opts.text) || ""; return { start: function(m) { console.log(m || t); return this; }, succeed: function(m) { console.log(m || t); return this; }, fail: function(m) { console.log(m || t); return this; }, stop: function() { return this; }, text: t }; } };/' "$CLI_PATH"
  echo "ora patch applied"
else
  echo "ora patch already in place (or CLI not found)"
fi
```

**When using this skill programmatically, ALWAYS run the pre-flight patch as a single block immediately before the `init` command.** Do not assume a previous patch is still in place.

### Programmatic Mode (RECOMMENDED for Claude Code)

ALWAYS use programmatic mode with the published npm package:

```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-indexer",
  "packageManager": "npm",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "erc20Transfers", "params": {"contractAddresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]}}],
  "sink": "clickhouse"
}'
```

**CRITICAL**: Template IDs must use camelCase:
- Use `"uniswapV3Swaps"` NOT `"uniswap-v3-swaps"`
- Use `"erc20Transfers"` NOT `"erc20-transfers"`

### Inspecting Available Templates

Before creating an indexer, inspect supported templates and their configuration:

```bash
npx @iankressin/pipes-cli@latest init --schema
```

This displays:
- All available template IDs (camelCase format)
- Required and optional parameters for each template
- Sink-specific configurations
- Network options

### Template ID to Parameters Mapping

The `--schema` output uses an `anyOf` structure without discriminators. Here is the mapping:

| templateId | Required params | Description |
|------------|----------------|-------------|
| `custom` | `contracts` (array of `{contractAddress, contractName, contractEvents, range}`) | Custom contract events with full ABI |
| `erc20Transfers` | `contractAddresses` (array of address strings), `range` | ERC20 Transfer events |
| `uniswapV3Swaps` | `factoryAddress` (single address string), `range` | Uniswap V3 swaps via factory pattern |

**Known issue**: The schema `anyOf` variants do not include `const` discriminators on `templateId`. Match by the `params` property names (`contracts` vs `contractAddresses` vs `factoryAddress`).

## Critical Rule: NEVER MANUALLY CREATE INDEXER FILES

**ALWAYS use the Pipes CLI programmatic mode. Manual file creation = YOLO mode = guaranteed problems.**

If the CLI fails:
- Fix the CLI issue first
- Never work around it by creating files manually
- Manual creation bypasses all scaffolding, dependency setup, and configuration

## Workflow for Helping Users

### Step 0: Research Protocol Architecture (MANDATORY)

**Before writing ANY code or generating the project:**

1. **Understand the protocol structure:**
   - Visit the protocol's documentation
   - Identify contract relationships (vault vs underlying protocol, factory vs instances, etc.)
   - Determine which contract emits the events you need

2. **Ask clarifying questions:**
   - What blockchain do they want to index? (Ethereum, Polygon, Solana, etc.)
   - **What does "track X" mean in this context?** (e.g., "allocations" could mean rebalancing events OR actual positions)
   - **Which contract emits the relevant events?** (Don't assume - verify!)
   - **Is there a specific contract, pool, or address?** (Important for customization)
   - **Time range needed?** (Recent data only = faster, full history = slower)
   - Where should the data be stored? (ClickHouse, PostgreSQL, CSV)
   - What should the project be named?

3. **Check for proxy contracts (MANDATORY for custom template):**

   **This is the #1 failure mode for DeFi protocol indexers.** Most major DeFi protocols (Aave, Compound, Uniswap governance, etc.) use proxy contracts. If the target contract is a proxy, the CLI will fetch only the proxy ABI (typically just an `Upgraded` event), not the implementation ABI with the actual business logic events.

   **Before running the CLI, check EVERY target contract:**
   ```bash
   # Check Etherscan for proxy status (replace chain/address as needed)
   # Look for: "This contract is a proxy" banner on the contract page
   # Or check the "Read as Proxy" tab — if it exists, the contract IS a proxy
   ```

   **If the contract IS a proxy:**
   1. Find the implementation address (Etherscan "Read as Proxy" tab → implementation address)
   2. You will need the **implementation's ABI** for event decoding
   3. But you will use the **proxy's address** in the indexer config (events emit from the proxy)
   4. Plan to run `evm-typegen` against the implementation address AFTER CLI generation:
      ```bash
      npx @subsquid/evm-typegen@latest <project>/src/contracts \
        <IMPLEMENTATION_ADDRESS> --chain-id <CHAIN_ID>
      ```
   5. Then update the import in `src/index.ts` to use the implementation's generated file

   **Real example — Aave V3 Pool:**
   - Proxy: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` (this is what users provide)
   - CLI fetches proxy ABI → only gets `Upgraded` event (WRONG)
   - Implementation has `Supply`, `Borrow`, `Repay`, `Withdraw`, `LiquidationCall` events
   - Solution: Generate types from implementation, keep proxy address in config

4. **Verify your understanding:**
   - Look at actual transactions on Etherscan to see which events are emitted
   - Check if there are multiple contracts involved
   - Understand the data flow between contracts

### Step 1: Inspect Available Templates

Before generating the project, inspect the available templates:

```bash
npx @iankressin/pipes-cli@latest init --schema
```

This ensures you use the correct templateId and understand the required configuration.

### Step 2: Run the CLI

```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-indexer",
  "packageManager": "npm",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "erc20Transfers", "params": {"contractAddresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]}}],
  "sink": "clickhouse"
}'
```

IMPORTANT: Use camelCase for templateId values. Every template requires a `params` object - check `--schema` for required fields.

### Step 3: Post-generation Setup (AUTOMATED - Do this AFTER CLI succeeds)

**WARNING: The CLI defaults to `pipes` as the database name. This WILL cause sync table conflicts if you run more than one indexer.** Every indexer writes sync state to `{database}.sync` with `id = 'stream'`. Two indexers sharing a database = the second one resumes from the first's position, causing wrong data or missing events.

**MANDATORY: Always create a project-specific database.** Use the project name or a descriptive name (e.g., `aave_v3_eth`, `usdc_transfers`, `uniswap_base`):

```bash
# Step 3a: Derive a database name from the project
DB_NAME=$(basename <project-folder> | tr '-' '_')
# Examples: aave-v3-indexer → aave_v3_indexer, usdc-transfers → usdc_transfers

# Step 3b: Create the dedicated database
docker exec <container> clickhouse-client --password <pw> \
  --query "CREATE DATABASE IF NOT EXISTS $DB_NAME"

# Step 3c: Update .env to use the dedicated database (NOT the default 'pipes')
sed -i '' "s/CLICKHOUSE_DATABASE=.*/CLICKHOUSE_DATABASE=$DB_NAME/" <project-folder>/.env
```

**If using ClickHouse (Local Docker)**:
- Get the actual password from existing container OR use "default" if creating new
- Update the .env file with correct password AND database:
  ```bash
  sed -i '' 's/CLICKHOUSE_PASSWORD=.*/CLICKHOUSE_PASSWORD=<actual-password>/' <project-folder>/.env
  sed -i '' "s/CLICKHOUSE_DATABASE=.*/CLICKHOUSE_DATABASE=$DB_NAME/" <project-folder>/.env
  ```
- **If you MUST reuse a database**, clear the sync table first:
  ```bash
  docker exec <container-name> clickhouse-client --password <password> \
    --query "DROP TABLE IF EXISTS <db>.sync"
  ```

**If using ClickHouse Cloud**:

1. **Configure .env for Cloud**:
   ```env
   CLICKHOUSE_URL=https://[service-id].[region].aws.clickhouse.cloud:8443
   CLICKHOUSE_DATABASE=pipes
   CLICKHOUSE_USER=default
   CLICKHOUSE_PASSWORD=[your-actual-cloud-password]
   ```

2. **Create database manually** (CLI migrations don't create databases):
   - Go to https://clickhouse.cloud/
   - Navigate to your service
   - Click "SQL Console"
   - Run: `CREATE DATABASE IF NOT EXISTS pipes;`

3. **Verify connection** before running indexer:
   ```bash
   curl -X POST "https://[your-service-id].[region].aws.clickhouse.cloud:8443/" \
     --user "default:[your-password]" \
     -d "SELECT 1"
   ```

For complete deployment guide (local Docker or ClickHouse Cloud), see pipes-deploy skill.

### Step 3.5: Post-Generation Verification Checklist

After the CLI generates the project, verify these BEFORE running:

1. **Factory address injected** (uniswapV3Swaps template only):
   ```bash
   grep "address:" <project-folder>/src/index.ts
   # Should show your factory address, NOT an empty string ['']
   # Known bug: CLI drops the factoryAddress param — fix with:
   sed -i '' "s|address: \[''\]|address: ['<YOUR_FACTORY_ADDRESS>']|" <project-folder>/src/index.ts
   ```

2. **ClickHouse password correct**:
   ```bash
   grep CLICKHOUSE_PASSWORD <project-folder>/.env
   # CLI generates "password" — standalone Docker typically uses "default"
   # If using the generated docker-compose.yml, "password" is correct
   # If using an existing standalone container, change to match your container
   ```

3. **Contract addresses present** (custom template):
   ```bash
   grep "contracts:" <project-folder>/src/index.ts
   # Verify your contract address(es) appear in the generated code
   ```

4. **Know your table names** (custom template):
   The custom template creates **one table per event**, named `{contractName}_{eventName}` in snake_case.
   Example: Contract "WETH" with events "Deposit" and "Withdrawal" creates:
   - `weth_deposit`
   - `weth_withdrawal`

   There is NO combined `weth_events` table. Query each event table separately.

5. **Proxy contract detection** (custom template — CRITICAL):
   Check the generated contract file for proxy-only ABI:
   ```bash
   grep "export const events" <project-folder>/src/contracts/*.ts
   # If you ONLY see "Upgraded" → it's a proxy contract!
   # The CLI fetched the proxy ABI, not the implementation.
   ```

   **If proxy detected:**
   1. Find implementation address on Etherscan ("Read as Proxy" tab)
   2. Generate types from implementation:
      ```bash
      npx @subsquid/evm-typegen@latest <project-folder>/src/contracts \
        <IMPLEMENTATION_ADDRESS> --chain-id <CHAIN_ID>
      ```
   3. Update import in `src/index.ts` to point to the implementation file
   4. Keep the proxy address in `contracts:` array (events emit from proxy)

   See `references/ABI_GUIDE.md` for detailed proxy handling guide.

6. **Contract file naming** (custom template):
   The generated contract file is named by address, not by `contractName`:
   ```
   src/contracts/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2.ts  (not weth.ts)
   ```
   This is cosmetic — the file works fine. The import in `src/index.ts` references it correctly.

6. **Database exists**:
   ```bash
   docker exec <container> clickhouse-client --password <pw> \
     --query "SHOW DATABASES" | grep <your-db-name>
   ```

### Step 4: Customization

- For EVM contracts: Update contract addresses in the generated transformer
- For custom event handling: Modify the transformer logic
- For database schema: Edit the table definitions
- For ABI generation: See references/ABI_GUIDE.md

### Step 5: Start and Validate

```bash
cd <project-folder>
npm run dev
```

**VERIFY START BLOCK** - Check the first log message shows your intended start block, not a resumed block.

**NOTE**: On the very first start, you will see an error about `Unknown table expression identifier 'pipes.sync'`. This is **harmless** — the SDK tries to read the sync table before it exists, then creates it. Ignore this error on first run.

### Resume vs Fresh Start Decision Tree

When you see `"Resuming from block X"` in the logs, use this to decide what to do:

| Scenario | Action |
|----------|--------|
| Indexer crashed mid-sync and you want to continue | **Keep it** — resume is correct. Verify X is near where it stopped. |
| You changed the start block or contract address | **Drop sync** — old sync state is stale. |
| You're running a different indexer on the same database | **Drop sync** — the sync state belongs to a different indexer. Better yet, use a separate database. |
| This is a brand new project, first ever run | **Drop sync** — there shouldn't be one. If there is, the database was used by another indexer. |
| You want to re-index from scratch | **Drop sync AND data tables** — clean slate. |

**How to drop sync:**
```bash
docker exec <container> clickhouse-client --password <pw> \
  --query "DROP TABLE IF EXISTS <database>.sync"
```

**How to restart after a crash (resume is wanted):**
```bash
cd <project-folder>
npm run dev
# First log line should say "Resuming from X" where X is near where it stopped
```

## Complete Automation Script

Follow these steps IN ORDER for first-time setup:

### Step 1: Check/setup database (ClickHouse example)
```bash
CLICKHOUSE_CONTAINER=$(docker ps --filter "name=clickhouse" --format "{{.Names}}" | head -n 1)

if [ -z "$CLICKHOUSE_CONTAINER" ]; then
  echo "No ClickHouse found, starting new one..."
  docker run -d --name clickhouse \
    -p 8123:8123 -p 9000:9000 \
    -e CLICKHOUSE_PASSWORD=default \
    clickhouse/clickhouse-server
  CLICKHOUSE_PASSWORD="default"
else
  echo "Using existing ClickHouse: $CLICKHOUSE_CONTAINER"
  CLICKHOUSE_PASSWORD=$(docker inspect $CLICKHOUSE_CONTAINER | grep CLICKHOUSE_PASSWORD | cut -d'"' -f4)
fi

DB_NAME=$(basename /path/to/my-new-indexer | tr '-' '_')
docker exec $CLICKHOUSE_CONTAINER clickhouse-client --query "CREATE DATABASE IF NOT EXISTS $DB_NAME"
```

### Step 2: Generate the indexer project
```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-new-indexer",
  "packageManager": "npm",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "erc20Transfers", "params": {"contractAddresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]}}],
  "sink": "clickhouse"
}'
```

### Step 3: Fix the .env file
```bash
cd /path/to/my-new-indexer
sed -i '' "s/CLICKHOUSE_PASSWORD=.*/CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD/" .env
sed -i '' "s/CLICKHOUSE_DATABASE=.*/CLICKHOUSE_DATABASE=$DB_NAME/" .env
```

### Step 4: Run the indexer
```bash
npm run dev
```

## Performance Considerations

### Sync Speed Factors

1. **Start block range**:
   - Smaller range = faster sync
   - 1M blocks: 5-10 minutes
   - 5M blocks: 30-60 minutes
   - Full chain: 2-4 hours

2. **Filtering type**:
   - **Contract events** (fastest): Events from specific contracts
   - **Token pair filtering** (medium): Factory pattern with filters
   - **Address filtering** (slowest): Requires scanning all transfers

3. **Number of contracts tracked**:
   - Fewer contracts = faster processing
   - Start with 1-3 key tokens, expand later if needed

### Quick Testing Strategy

For fast iteration during development:

1. **Start with recent blocks** (last 1-2 weeks):
   ```typescript
   range: { from: '21,000,000' }
   ```

2. **Test with limited contracts**:
   ```typescript
   contracts: ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'] // Just WETH
   ```

3. **Once working, expand the range and contracts**

## Key SDK Patterns (Latest)

### Event Parameter Filtering

Filter events by indexed parameters at the source level for maximum performance:

```typescript
events: {
  transfers: {
    event: commonAbis.erc20.events.Transfer,
    params: {
      from: ['0x87482e84503639466fad82d1dce97f800a410945'],
      to: '0x10b32a54eeb05d2c9cd1423b4ad90c3671a2ed5f',
    },
  },
}
```

### Factory Pattern

Track dynamically created contracts (e.g., Uniswap pools, MetaMorpho vaults). Use `factory()` inside the `contracts` field of `evmDecoder`:

```typescript
import { evmDecoder, factory, factorySqliteDatabase } from '@subsquid/pipes/evm'

const swaps = evmDecoder({
  range: { from: '12,369,621' },
  contracts: factory({
    address: ['0x1f98431c8ad98523631ae4a59f267346ea31f984'],
    event: factoryEvents.PoolCreated,
    parameter: 'pool',
    database: await factorySqliteDatabase({ path: './factory-pools.sqlite' }),
  }),
  events: {
    swaps: poolEvents.Swap,
  },
})
```

**Factory pattern key concepts:**
- `address`: The factory contract(s) that emit creation events
- `event`: The creation event (e.g., `PoolCreated`, `CreateMetaMorpho`)
- `parameter`: The event parameter containing the child contract address
- `database`: SQLite database to persist discovered child contracts across restarts

**Accessing factory event metadata in `.pipe()`:**
Each decoded event includes a `factory` property with the creation event's data:
```typescript
.pipe(({ deposits }) => ({
  deposits: deposits.map((d) => ({
    vault: d.contract,                    // child contract address
    vaultName: d.factory?.event.name ?? '',  // from creation event
    asset: d.factory?.event.asset ?? '',     // from creation event
    sender: d.event.sender,               // from the decoded event itself
  })),
}))
```
Use `d.factory?.event.<param>` to access any parameter from the factory creation event. This is how you enrich child contract events with metadata from deployment (names, symbols, assets, etc.).

**CRITICAL: Factory cold-start behavior.** The factory pattern only discovers child contracts from the `range.from` block forward. If the factory deployed 100 contracts before your start block, those are NOT tracked. This means:
- You may see **zero data for 30-60+ seconds** while the indexer catches up to a block where the factory creates a new child contract
- This is normal, not a bug — but it can be alarming during testing
- To track ALL child contracts, set `range.from` to the factory's deployment block
- For testing, a recent start block works but expect a delay before data appears

**Restarting a factory indexer from scratch:**
The factory pattern stores discovered contracts in a SQLite file. If you need a clean restart:
```bash
# 1. Kill the indexer
# 2. Delete the SQLite database
rm <project-folder>/*.sqlite
# 3. Drop ClickHouse sync + data tables
docker exec <container> clickhouse-client --password <pw> \
  --query "DROP TABLE IF EXISTS <db>.sync; DROP TABLE IF EXISTS <db>.<table1>; DROP TABLE IF EXISTS <db>.<table2>"
# 4. Restart
cd <project-folder> && npm run dev
```
```

### Adapting Factory Pattern for Any Protocol

The `uniswapV3Swaps` template uses the factory pattern for Uniswap pools, but you can apply it to **any** protocol that deploys child contracts via a factory. Here's the general approach:

1. **Identify the factory contract** — the contract that deploys child contracts
2. **Find the creation event** — the event emitted when a child is deployed (e.g., `PoolCreated`, `CreateMetaMorpho`, `CreateVault`)
3. **Identify the address parameter** — the event field containing the new child contract's address
4. **Generate ABIs** for both the factory and the child contracts:
   ```bash
   # Generate factory ABI
   npx @subsquid/evm-typegen@latest src/contracts \
     <FACTORY_ADDRESS> --chain-id 1

   # Generate child contract ABI (use any known child address)
   npx @subsquid/evm-typegen@latest src/contracts \
     <ANY_CHILD_CONTRACT_ADDRESS> --chain-id 1
   ```
5. **Wire up the factory pattern** — replace the Uniswap-specific values with your protocol's:
   ```typescript
   contracts: factory({
     address: ['<FACTORY_ADDRESS>'],
     event: factoryEvents.YourCreationEvent,  // e.g., CreateMetaMorpho
     parameter: 'childAddress',                // event param with child address
     database: await factorySqliteDatabase({ path: './your-factory.sqlite' }),
   }),
   events: {
     yourEvents: childContractEvents.YourEvent,  // events on child contracts
   },
   ```

**Real-world example — MetaMorpho vaults:**
- Factory: `0x1897A8997241C1cD4bD0698647e4EB7213535c24` (MetaMorpho Factory V1.1)
- Creation event: `CreateMetaMorpho` with `metaMorpho` (indexed address)
- Child contracts: ERC-4626 vaults emitting `Deposit`, `Withdraw`, etc.
- Metadata from creation event: `name`, `symbol`, `asset` — accessible via `d.factory?.event`

### Combining Multiple Decoders

Use `.pipeComposite()` to run multiple named decoders in a single pipeline:

```typescript
const stream = evmPortalSource({ portal: '...' }).pipeComposite({
  transfers: evmDecoder({ events: { transfers: commonAbis.erc20.events.Transfer } }),
  swaps: evmDecoder({ events: { swaps: uniswapV3Abi.events.Swap } }),
})
```

### Target Configuration (ClickHouse)

```typescript
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse'

stream.pipeTo(clickhouseTarget({
  client: createClient({ url: process.env.CLICKHOUSE_URL }),
  onData: async (ctx, data) => {
    await ctx.insert('transfers', data.transfers)
  },
  onRollback: async (ctx, range) => {
    // Handle chain reorgs
  },
}))
```

### Target Configuration (PostgreSQL with Drizzle)

```typescript
import { drizzleTarget } from '@subsquid/pipes/targets/drizzle/node-postgres'

stream.pipeTo(drizzleTarget({
  db: drizzle(pool),
  tables: [transfersTable],
  onData: async (ctx, data) => {
    await ctx.db.insert(transfersTable).values(data.transfers)
  },
}))
```

## Timestamp Handling (CRITICAL)

**ClickHouse `DateTime` expects seconds, but `d.timestamp.getTime()` returns milliseconds.** If you don't divide by 1000, timestamps will show as `1970-01-28` instead of the correct date.

### When using the auto-generated `enrichEvents` helper

The CLI-generated `enrichEvents` function (in `src/utils/index.ts`) handles this correctly — it divides by 1000 internally. If your indexer uses `enrichEvents`, timestamps are fine:
```typescript
// enrichEvents does this internally:
timestamp: new Date(v.timestamp).getTime() / 1000  // ← correct
```

### When writing manual `.pipe()` transforms

If you write a custom `.pipe()` transform (e.g., to access factory metadata), you handle timestamps yourself. **You MUST divide by 1000:**

```typescript
// WRONG — produces 1970 dates in ClickHouse
.pipe(({ deposits }) => ({
  deposits: deposits.map((d) => ({
    timestamp: d.timestamp.getTime(),  // milliseconds! ClickHouse stores as year 1970
  })),
}))

// CORRECT — produces proper dates
.pipe(({ deposits }) => ({
  deposits: deposits.map((d) => ({
    timestamp: Math.floor(d.timestamp.getTime() / 1000),  // seconds
  })),
}))
```

### When to use `enrichEvents` vs manual `.pipe()`

| Scenario | Approach |
|----------|----------|
| Standard contract events, no factory metadata needed | Use `enrichEvents` (auto-generated) — handles timestamps, block data, tx hash automatically |
| Need factory metadata (vault names, asset addresses from creation event) | Write manual `.pipe()` — access `d.factory?.event` fields, but handle timestamps yourself |
| Need to combine factory metadata + standard enrichment | Write manual `.pipe()` and include `Math.floor(d.timestamp.getTime() / 1000)` |

## Pipes Best Practices

### Single Source of Truth (Database-Centric)

State should live in the database, not in process memory:
- Prevents data loss from crashes or restarts
- Enables recovery and replay from any point
- Use idempotent inserts/updates

**ClickHouse patterns:**
- Materialized views for derived metrics
- SummingMergeTree for additive aggregations
- AggregatingMergeTree for complex metrics
- CollapsingMergeTree for reorg handling

**PostgreSQL patterns:**
- ON CONFLICT UPDATE clauses for state reconciliation
- Ensures safe re-runs without duplicates

### Block-Aware Pipelines

Always start collection at or **before** contract deployment block:
- Critical for metrics requiring complete event history
- Ensures historical accuracy from block 0
- Check deployment block on Etherscan before configuring

### Reorg Handling (ClickHouse)

For reorg-sensitive events, use CollapsingMergeTree:

```typescript
// Schema with sign field
CREATE TABLE events (
  ...
  sign Int8
) ENGINE = CollapsingMergeTree(sign)
ORDER BY (entity_id, block_number, tx_hash, event_type)

// Rollback handler
onRollback: (ctx, range) => {
  // Insert sign=-1 records for rolled-back blocks
  const rollbackRecords = events
    .filter(e => e.block >= range.from)
    .map(e => ({ ...e, sign: -1 }))

  return ctx.insert(rollbackRecords)
}
```

**Critical:** ORDER BY must include ALL distinguishing fields to prevent unwanted event deduplication.

### Event-Based vs. State Queries

**Indexers track historical flow** (event-based):
- Example: "User deposited 100, withdrew 110" = -10 net flow
- Good for: Transaction history, activity tracking, audit logs

**RPC queries track current state**:
- Example: "User currently holds 50 shares" = current balance
- Good for: Current positions, real-time snapshots

**Important:** Withdrawals including accrued interest can make event flows appear negative even when positions are positive. Use RPC for current balances, events for historical analysis.

### Validation Requirements

Always validate indexed data before production use:
- Cross-reference sample transactions with block explorer
- Verify event counts match expected ranges
- Check for missing blocks or gaps
- Reconcile aggregated metrics with known totals

## Troubleshooting

### CLI Issues

**"Network timeout with npx"**
- Check internet connection
- Try again or wait a moment
- Ensure npm registry is accessible

**"Template 'uniswap-v3-swaps' not found"**
- Use camelCase: `uniswapV3Swaps` not `uniswap-v3-swaps`
- Run `npx @iankressin/pipes-cli@latest init --schema` to see available templates

**"Template ID not recognized"**
- Run `--schema` flag to verify available templates and their exact IDs
- Ensure you're using the latest CLI version with `@latest`

### Database Issues

**"Authentication failed: password is incorrect"**
- Check actual password: `docker inspect <container> | grep CLICKHOUSE_PASSWORD`
- Update .env file with correct password

**"Database pipes does not exist"**
- Create it: `docker exec <container> clickhouse-client --query "CREATE DATABASE IF NOT EXISTS pipes"`

**"port is already allocated"**
- Use existing container instead of starting new one

**"Indexer starts from wrong block / Missing data"**
- MOST COMMON ISSUE: Shared sync table between projects
- Clear the sync table: `docker exec <container> clickhouse-client --query "DROP TABLE IF EXISTS pipes.sync"`
- Restart the indexer - it will now start from the configured block

## Related Skills

- See ENVIRONMENT_SETUP.md for setup verification - Verify environment first
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix issues
- [pipes-deploy](../pipes-deploy/SKILL.md) - Local and cloud deployment

## Related Documentation

This skill includes comprehensive reference documentation in the `references/` directory:

- **[ENVIRONMENT_SETUP.md](references/ENVIRONMENT_SETUP.md)** - Development environment setup guide, prerequisites check, platform-specific notes, and troubleshooting
- **[ABI_GUIDE.md](references/ABI_GUIDE.md)** - Fetching contract ABIs, `commonAbis` usage, proxy contract detection and handling, TypeScript type generation
- **[SCHEMA_GUIDE.md](references/SCHEMA_GUIDE.md)** - ClickHouse engine selection, ORDER BY strategy, BigInt handling, partitioning patterns
- **[RESEARCH_CHECKLIST.md](references/RESEARCH_CHECKLIST.md)** - Protocol research workflow, contract discovery, deployment block finding, common gotchas
- **[HYPERLIQUID_GUIDE.md](references/HYPERLIQUID_GUIDE.md)** - Complete Hyperliquid fills indexer setup, API reference, query builder usage, and performance benchmarks

### How to Access

```bash
cat pipes-sdk/pipes-new-indexer/references/ABI_GUIDE.md
cat pipes-sdk/pipes-new-indexer/references/SCHEMA_GUIDE.md
cat pipes-sdk/pipes-new-indexer/references/RESEARCH_CHECKLIST.md
```

### Additional Resources

For comprehensive patterns and workflows:
- [PATTERNS.md](../pipes-troubleshooting/references/PATTERNS.md) - EVM patterns, troubleshooting, and performance optimization

### Official Subsquid Documentation
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Pipes SDK
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Subsquid documentation
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Comprehensive Pipes SDK guide
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported networks and chains
