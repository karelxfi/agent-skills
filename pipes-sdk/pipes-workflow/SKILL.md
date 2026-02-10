---
name: pipes-workflow
description: Core workflow documentation for building blockchain indexers with Pipes SDK. Includes 7-step mandatory workflow, quick reference guides, and 2025 feature updates. Read this first before starting any indexer project.
metadata:
  author: subsquid
  version: "1.0.0"
  category: documentation
  priority: critical
---

# Pipes: Workflow Documentation

Essential workflow documentation that prevents 60-70% of common indexer errors.

## When to Use This Skill

**Read this FIRST** before:
- Starting a new indexer project
- Unclear about the correct workflow steps
- Want to understand best practices
- Need quick reference during development
- Encountering errors (likely skipped a workflow step)

## Overview

This skill provides access to three critical reference documents:

1. **INDEXER_WORKFLOW.md** - The mandatory 7-step workflow (single source of truth)
2. **QUICK_REF_EVM.md** - Fast lookup during coding
3. **QUICK_START_2025.md** - New 2025 SDK features and patterns

## The 7-Step Mandatory Workflow

**Following this workflow prevents most common errors.**

### Step 1: Environment Setup
- Install Node.js 18+, Bun, Docker
- Start ClickHouse or PostgreSQL container
- Verify npm/npx availability for Pipes CLI

### Step 2: Project Generation (NEVER MANUAL)
**ALWAYS use Pipes CLI** - never manually create files!

```bash
npx @iankressin/pipes-cli@latest init --config '{
  "projectFolder": "/path/to/indexer",
  "packageManager": "bun",
  "networkType": "evm",
  "network": "ethereum-mainnet",
  "templates": [{"templateId": "uniswapV3Swaps"}],
  "sink": "clickhouse"
}'
```

**Why**: CLI ensures correct dependencies, configuration, and structure.

**Tip**: Run `npx @iankressin/pipes-cli@latest init --schema` to see all available templates before generating.

### Step 3: Contract Discovery
**Check local registry FIRST**, then web search:

```bash
# 1. Check contracts-registry-llm (addybook.xyz)
WebFetch({
  url: "https://raw.githubusercontent.com/karelxfi/contracts-registry-llm/main/data/generated/indexes/by-address.json",
  prompt: "Find {protocol} addresses on {chain}"
})

# 2. ONLY THEN: Web search if not found
```

### Step 4: ABI Fetching
- Use `/generate-abi` command or abi-manager agent
- Verify events match what you need to track
- Generate TypeScript types automatically

### Step 5: Schema Design
- Use schema-designer agent for optimal structure
- ClickHouse: Consider ORDER BY for query patterns
- PostgreSQL: Add indexes for foreign keys

### Step 6: Implementation
- Customize the generated transformer
- Add filters (use event parameter filtering for performance!)
- Test with recent blocks first (last 1-2 weeks)

### Step 7: Validation
**MANDATORY before declaring success:**

```bash
# 1. Start indexer
bun run dev

# 2. Verify start block (within 30 seconds)
tail -f indexer.log
# Should say "Start indexing from X" NOT "Resuming from Y"

# 3. Wait 30 seconds, check for data
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT COUNT(*) FROM pipes.my_table"
# Count MUST be > 0

# 4. Inspect sample data
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT * FROM pipes.my_table LIMIT 3 FORMAT Vertical"
# Verify: addresses valid, amounts reasonable, timestamps correct

# 5. Wait another 30 seconds, verify count increasing
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT COUNT(*) FROM pipes.my_table"
# Count should have increased
```

## Key Principles

### Principle 1: NEVER Skip the Workflow
Each step builds on the previous one. Skipping steps causes:
- Wrong dependency versions
- Missing configuration
- Authentication failures
- Wasted debugging time

### Principle 2: Use Provided Tools
- **Wrong**: Manual file creation
- **Right**: Use Pipes CLI
- **Wrong**: Copy-paste schemas
- **Right**: Use schema-designer agent

### Principle 3: Test Early and Often
- Start with recent blocks (faster iteration)
- Verify data within 30 seconds of starting
- Don't wait hours to check if it's working

### Principle 4: Validate Before Claiming Success
"Indexer is syncing" ≠ "Indexer is working correctly"

Must verify:
- Data appears in database
- Data fields are populated (no NULLs)
- Data values are reasonable
- Count is increasing over time

## Common Workflow Violations (DON'T DO THESE)

### Violation 1: Manual File Creation
```bash
# WRONG - Bypasses all safety checks
mkdir my-indexer
npm init -y
touch src/index.ts
# ... manually write everything
```

**Why it fails**: Wrong package versions, missing config, no validation

### Violation 2: Skipping Contract Discovery
```bash
# WRONG - Immediately web searching
WebSearch: "Morpho vault ABI"
```

**Why it fails**: Local registry has verified addresses and deployment blocks

### Violation 3: Not Testing with Recent Blocks
```typescript
// WRONG - Starting from contract deployment
range: { from: '12369621' }  // 2+ years of data
```

**Why it fails**: Takes hours to see if it works. Use recent blocks for testing!

### Violation 4: Declaring Success Without Verification
```bash
# WRONG
bun run dev
# ... indexer starts
echo "Done!"
```

**Why it fails**: Indexer might be running but not capturing any data!

## 2025 Feature Updates

### Factory Event Parameter Filtering
**MAJOR performance improvement** - filter at Portal API level:

```typescript
// NEW (2025): 10x faster!
const decoder = evmDecoder({
  contracts: factory({
    address: factoryAddress,
    event: {
      event: factoryAbi.PoolCreated,
      params: { token0: WETH },  // Filter at source!
    },
    parameter: 'pool',
  }),
})

// OLD: Downloads all, filters locally
.pipe(({ swaps }) => swaps.filter(...))  // Slower
```

### Multi-Event Parameter Filtering
```typescript
events: {
  inbound: {
    event: erc20Abi.Transfer,
    params: { to: TARGET_ADDRESS },  // Only transfers TO address
  },
  outbound: {
    event: erc20Abi.Transfer,
    params: { from: TARGET_ADDRESS },  // Only transfers FROM address
  },
}
```

## Quick Reference Files

### Available References

All reference documents are in the `references/` directory:

1. **INDEXER_WORKFLOW.md**
   - Full 7-step workflow with detailed explanations
   - Red flags and troubleshooting
   - Validation checklists

2. **QUICK_REF_EVM.md**
   - Syntax quick lookup
   - Common patterns
   - Code snippets

3. **QUICK_START_2025.md** (if available)
   - Latest 2025 features
   - Migration guides
   - New APIs

### How to Access

```bash
# Read workflow documentation
cat references/INDEXER_WORKFLOW.md

# Read quick reference
cat references/QUICK_REF_EVM.md
```

Or use Claude Code's Read tool:
```
Read: agent-skills/skills/pipes-workflow/references/INDEXER_WORKFLOW.md
```

## When Things Go Wrong

If you encounter errors, likely causes:

### Error: "Database authentication failed"
**Workflow step skipped**: Step 1 (Environment Setup)
- Fix: Check actual ClickHouse password, update .env

### Error: "Template not found"
**Workflow step skipped**: Step 2 (Using CLI correctly)
- Fix: Use camelCase templateId: `uniswapV3Swaps` not `uniswap-v3-swaps`

### Error: "No events captured"
**Workflow step skipped**: Step 3 (Contract Discovery)
- Fix: Verify contract address, check if it's a proxy

### Error: "TypeScript type errors"
**Workflow step skipped**: Step 4 (ABI Fetching)
- Fix: Regenerate ABI types, check ABI version matches SDK

### Error: Zero data after 30 seconds
**Workflow step skipped**: Step 7 (Validation)
- Fix: Check start block, verify event names, check for proxy contracts

## Success Checklist

Before declaring a project complete:

- [ ] Used Pipes CLI to generate project (not manual)
- [ ] Checked contracts-registry-llm before web search
- [ ] Fetched and verified ABIs
- [ ] Designed schema with optimization in mind
- [ ] Tested with recent blocks first
- [ ] **Verified data appears within 30 seconds**
- [ ] **Verified data values are correct**
- [ ] **Verified count increases over time**
- [ ] Documented any deviations from standard workflow

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Implements Step 2 (project generation)
- [pipes-find-contracts](../pipes-find-contracts/SKILL.md) - Implements Step 3 (contract discovery)
- [pipes-abi](../pipes-abi/SKILL.md) - Implements Step 4 (ABI fetching)
- [pipes-schema-design](../pipes-schema-design/SKILL.md) - Implements Step 5 (schema design)
- [pipes-validation](../pipes-validation/SKILL.md) - Implements Step 7 (validation)
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - When steps fail
- [pipes-patterns](../pipes-patterns/SKILL.md) - Advanced implementation patterns

## Key Takeaways

1. **Follow the 7-step workflow** - It prevents 60-70% of errors
2. **Use provided tools** - They enforce best practices
3. **Test with recent blocks** - Faster iteration
4. **Verify data immediately** - Don't wait hours to check
5. **Read INDEXER_WORKFLOW.md first** - It's the single source of truth

## Documentation Hierarchy

```
pipes-workflow (THIS SKILL)           ← Start here: mandatory workflow
    ├── references/INDEXER_WORKFLOW.md  ← Detailed 7-step guide
    ├── references/QUICK_REF_EVM.md     ← Fast syntax lookup
    └── references/QUICK_START_2025.md  ← Latest features

pipes-patterns                        ← Advanced patterns & troubleshooting
pipes-deployment                      ← Production deployment guides
```

Read this skill first, then refer to pipes-patterns for advanced use cases.
