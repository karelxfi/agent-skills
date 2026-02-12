---
name: pipes-new-indexer
description: Create a new blockchain indexer project using Pipes CLI with interactive templates for EVM and Solana chains. Use when starting a new indexer from scratch.
compatibility: Requires npm/npx for @iankressin/pipes-cli
allowed-tools: [Bash, Read, Write]
metadata:
  author: subsquid
  version: "1.1.0"
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

## Overview

The Pipes CLI (`@iankressin/pipes-cli`) provides an interactive scaffolding tool that generates production-ready indexer projects with built-in templates for common use cases.

## Available Templates

Use `npx @iankressin/pipes-cli@latest init --schema` to see the full list of available templates.

### Common EVM Templates
- **erc20Transfers** (camelCase) - Track ERC20 token transfers
- **uniswapV3Swaps** (camelCase) - Track Uniswap V3 swap events
- **custom** - Start with a blank template for custom logic

### Common SVM (Solana) Templates
- **tokenBalances** (camelCase) - Track SPL token balances
- **custom** - Start with a blank template for custom logic

**Note:** Template IDs must use camelCase format when passed to the CLI.

## Supported Sinks
- **ClickHouse** - High-performance analytics database
- **PostgreSQL** - Relational database with Drizzle ORM
- **CSV** - Export to CSV files

## How to Use the CLI

### Programmatic Mode (RECOMMENDED for Claude Code)

ALWAYS use programmatic mode with the published npm package:

```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "uniswapV3Swaps"}],
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

3. **Verify your understanding:**
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
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "uniswapV3Swaps"}],
  "sink": "clickhouse"
}'
```

IMPORTANT: Use camelCase for templateId values.

### Step 3: Post-generation Setup (AUTOMATED - Do this AFTER CLI succeeds)

**If using ClickHouse (Local Docker)**:
- Get the actual password from existing container OR use "default" if creating new
- Create the database:
  ```bash
  docker exec <container-name> clickhouse-client --query "CREATE DATABASE IF NOT EXISTS pipes"
  ```
- Update the .env file with correct password:
  ```bash
  sed -i '' 's/CLICKHOUSE_PASSWORD=.*/CLICKHOUSE_PASSWORD=<actual-password>/' <project-folder>/.env
  ```
- **CRITICAL - CLEAR SYNC TABLE IF REUSING DATABASE:**

  If you're sharing a ClickHouse database between multiple indexers, ALWAYS clear the sync table:
  ```bash
  docker exec <container-name> clickhouse-client --password <password> \
    --query "DROP TABLE IF EXISTS pipes.sync"
  ```

  **Why this matters:** Shared sync tables cause indexers to resume from wrong blocks, skip data, or sync incorrect ranges. This is a common source of "missing data" errors.

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

For complete ClickHouse Cloud deployment guide, see pipes-deploy-clickhouse-cloud skill.

### Step 4: Customization

- For EVM contracts: Update contract addresses in the generated transformer
- For custom event handling: Modify the transformer logic
- For database schema: Edit the table definitions
- For ABI generation: Use pipes-abi skill

### Step 5: Start and Validate

```bash
cd <project-folder>
bun run dev
```

**VERIFY START BLOCK** - Check the first log message shows your intended start block, not a resumed block.

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

docker exec $CLICKHOUSE_CONTAINER clickhouse-client --query "CREATE DATABASE IF NOT EXISTS pipes"
```

### Step 2: Generate the indexer project
```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/my-new-indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "uniswapV3Swaps"}],
  "sink": "clickhouse"
}'
```

### Step 3: Fix the .env file
```bash
cd /path/to/my-new-indexer
sed -i '' "s/CLICKHOUSE_PASSWORD=.*/CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD/" .env
```

### Step 4: Run the indexer
```bash
bun run dev
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

- See pipes-orchestrator for workflow guidance - Mandatory 7-step workflow
- [pipes-orchestrator](../pipes-orchestrator/SKILL.md) - Routes to this skill
- See ENVIRONMENT_SETUP.md for setup verification - Verify environment first
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix issues
- [pipes-template-dex-swaps](../pipes-template-dex-swaps/SKILL.md) - DEX template details
- [pipes-deploy-clickhouse-cloud](../pipes-deploy-clickhouse-cloud/SKILL.md) - Cloud deployment

## Related Documentation

This skill includes comprehensive reference documentation in the `references/` directory:

- **[ENVIRONMENT_SETUP.md](references/ENVIRONMENT_SETUP.md)** - Development environment setup guide, prerequisites check, platform-specific notes, and troubleshooting

### How to Access

```bash
# Read environment setup guide
cat pipes-sdk/pipes-new-indexer/references/ENVIRONMENT_SETUP.md
```

Or use Claude Code's Read tool:
```
Read: pipes-sdk/pipes-new-indexer/references/ENVIRONMENT_SETUP.md
```

### Additional Resources

For comprehensive patterns and workflows:
- [PATTERNS.md](../pipes-troubleshooting/references/PATTERNS.md) - EVM patterns, troubleshooting, and performance optimization
- [Orchestrator workflow section](../pipes-orchestrator/SKILL.md#pipes-indexer-workflow-7-steps) - Mandatory 7-step workflow

### Official Subsquid Documentation
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick reference for Pipes SDK
- **[llms-full.txt](https://beta.docs.sqd.dev/llms-full.txt)** - Complete Subsquid documentation
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Comprehensive Pipes SDK guide
- **[Available Datasets](https://portal.sqd.dev/datasets)** - All supported networks and chains
