# Claude Code Rules & Guidelines

## CRITICAL: Mandatory Environment Discovery Protocol

### Rule 0: NEVER Start Implementation Without Discovery

**ABSOLUTE REQUIREMENT:** Before writing ANY code or making ANY web requests, you MUST complete the Environment Discovery Protocol.

**Violation of this rule is a critical failure.**

---

### Environment Discovery Protocol (Mandatory)

**When you receive a task, follow these steps IN ORDER:**

#### Phase 1: Understand the Local Environment (2-3 minutes)

```bash
# 1. Read the project README
cat README.md

# 2. Check for Claude-specific documentation
ls -la .claude/
ls -la .claude/docs/

# 3. Check for setup/helper scripts
ls -la scripts/
ls -la .claude/scripts/

# 4. Look for project structure
ls -la
find . -maxdepth 2 -type d -name "src" -o -name "packages"
```

**STOP and REPORT:** What did you find? What tools are available?

#### Phase 2: Check Available Skills and Tools

**Before doing ANYTHING else:**

1. **Review available skills** - They are listed in your context
   - Check if there's a skill for the task (e.g., /new-indexer, /find-contracts)
   - Use skills FIRST before manual implementation

2. **Check for registries or databases**
   ```bash
   # Look for local data sources
   find . -name "*registry*" -o -name "*database*" -o -name "*cache*"
   ```

3. **Check for example projects or templates**
   ```bash
   find . -name "*example*" -o -name "*template*" -o -name "*test*"
   ```

**RULE:** If a skill exists for the task, USE IT. Do not manually implement what's already automated.

#### Phase 3: Check Local Resources BEFORE Web Searches

**MANDATORY ORDER:**
1. Check local contract registries
2. Check local documentation
3. Check existing code/examples
4. Use provided skills/tools
5. ONLY THEN: Web search if information is not available locally

**Example - Contract Information:**
```bash
# WRONG: Immediately web search
WebSearch: "Morpho vault ABI events"

# CORRECT: Check local resources first
# 1. Look for contract registry
find . -name "*registry*" -name "*.json"

# 2. Use find-contracts skill if available
Skill: find-contracts 0xABCD...

# 3. Check if contract info exists locally
grep -r "0xABCD" . --include="*.json"

# 4. ONLY THEN web search if not found
```

#### Phase 4: Understand the Standard Workflow

**Before implementing, ask:**
- "What's the standard way to do this task in this project?"
- "Are there docs explaining the workflow?"
- "Are there similar examples I can follow?"

```bash
# Check for workflow documentation
ls .claude/docs/ | grep -i workflow
ls .claude/docs/ | grep -i guide
ls .claude/docs/ | grep -i readme

# Read relevant docs
cat .claude/docs/INDEXER_WORKFLOW.md  # or similar
```

---

### Specific Rules for This Environment

#### 1. Contract Information

**ALWAYS check local registry FIRST:**
```bash
# Step 1: Look for contract registry
find . -name "*registry*"

# Step 2: Use find-contracts skill
Skill: find-contracts <address>

# Step 3: Only web search if not found locally
```

**NEVER web search for contract info without checking local registry first.**

#### 2. Creating Indexers

**ALWAYS use provided skills:**
```bash
# CORRECT: Use the skill
Skill: new-indexer <name> --chain <chain> --address <address>

# WRONG: Manually run CLI without skill
npx @iankressin/pipes-cli@latest init --config '{...}'
```

**If you don't know how to use a skill, READ ITS DOCUMENTATION, don't try to do it manually.**

**Note:** Skills now use the published npm package `@iankressin/pipes-cli@latest` - no local SDK setup required.

#### 3. Database Setup

**ALWAYS check for automation:**
```bash
# Look for setup scripts
ls scripts/ | grep -i setup
ls scripts/ | grep -i database
ls scripts/ | grep -i clickhouse

# Use them if they exist
./scripts/setup-database.sh
```

**NEVER manually set up infrastructure if automation exists.**

---

### Phase 5: Testing & Validation (MANDATORY)

**YOU MUST TEST BEFORE DECLARING SUCCESS.**

**The Testing Checklist:**

For indexers:
```bash
# 1. Start the indexer
cd <project> && bun run dev

# 2. Check what block it's starting from
tail -f indexer.log
# Look for: "Start indexing from X" or "Resuming from Y"
# Verify: Does X match the expected start block?
# RED FLAG: If it says "Resuming" on a fresh project, investigate why

# 3. Wait 30 seconds
sleep 30

# 4. Check if ANY data exists
docker exec <clickhouse> clickhouse-client \
  --password=<password> \
  --database=<db> \
  --query "SELECT COUNT(*) FROM <main_table>"

# Expected: COUNT > 0
# If COUNT = 0: INVESTIGATE, don't declare success

# 5. Inspect sample data
docker exec <clickhouse> clickhouse-client \
  --query "SELECT * FROM <table> LIMIT 3 FORMAT Vertical"

# Verify:
# - Addresses are valid (0x... format)
# - Amounts are reasonable
# - Timestamps are correct
# - All expected fields are populated

# 6. Wait another 30 seconds
sleep 30

# 7. Check if count is INCREASING
docker exec <clickhouse> clickhouse-client \
  --query "SELECT COUNT(*) FROM <table>"

# If count increased: Working
# If count same: May be done syncing or stuck

# 8. Check for errors
grep -i error indexer.log
grep -i failed indexer.log

# 9. ONLY NOW: Declare success
echo "Verified working with <count> records"
```

**RULE:** You cannot declare success until you have verified actual output data.

---

### Red Flags That Require Investigation

**If you see these, STOP and INVESTIGATE:**

1. **"Resuming from X" on a fresh project**
   - Why is there existing sync state?
   - Is database shared with other projects?
   - Is this using the wrong database/container?

2. **Zero data after 30+ seconds**
   - Is the start block correct?
   - Is the contract address correct?
   - Are the event names correct?
   - Is this a proxy contract?

3. **Process starts but no logs**
   - Is it actually running?
   - Is it stuck somewhere?
   - Are there silent errors?

4. **Multiple containers/databases with similar names**
   - Are they sharing state?
   - Which one is this project using?
   - Should we create a dedicated one?

**DO NOT ignore red flags. Investigate immediately.**

---

### Reporting Your Discovery

**Before implementing, report to the user:**

```
I've completed environment discovery:

Environment:
- Project: <name>
- Framework: <framework>
- Available tools: <list>
- Available skills: <list>

Task approach:
1. Use <skill/tool> for <step>
2. Use <resource> for <step>
3. Test with <method>

Estimated time: <time>

Ready to proceed?
```

**This gives the user a chance to correct your approach BEFORE you waste time.**

---

## Efficiency & Avoiding Repetition

### 1. Failed Web Searches - Know When to Stop

**Rule:** If a web search or WebFetch fails 2 times for the same information, STOP and tell the user directly.

**Examples:**
- DON'T: Try 5+ different search queries for the same deployment block number
- DO: After 2 failed attempts, say "I can't find this via search. Here's what you need to do manually: [instructions]"

**Why:** Respect the user's time. Repeated failed searches waste tokens and patience.

### 2. Block Explorer Access Limitations

**Rule:** BaseScan and similar explorers often block automated access (403 errors). Don't retry.

**Instead:**
- Acknowledge the limitation immediately
- Provide the direct URL for the user to check manually
- Offer alternative approaches (RPC calls, asking user directly)

**Example Response:**
```
I can't access BaseScan directly (403 error). To find the deployment block:
1. Visit: https://basescan.org/address/0x...
2. Look for "Contract Creator" transaction
3. The block number will be shown there

Or you can tell me the block number and I'll update the config.
```

### 3. Testing & Verification

**Rule:** When testing doesn't produce expected results, add debug logging ONCE, then analyze.

**Process:**
1. Run test without logging
2. If unexpected results → add console.log/debug output
3. Run ONCE with logging
4. Analyze and explain findings
5. Don't keep retrying the same test

**Example:**
```typescript
// GOOD: Add logging, run once, analyze
console.log(` Found ${transfers.length} transfers`)
const filtered = transfers.filter(...)
console.log(`After filter: ${filtered.length}`)
```

### 4. Ask User Directly When Appropriate

**Rule:** If you need information that's faster for the user to provide, ASK instead of searching.

**Examples:**
- Contract deployment blocks → User can check explorer in 10 seconds
- Specific configuration values → User knows their setup
- API keys or credentials → User has these readily available

### 5. Blockchain Indexer Gotchas

**Common Issues to Check Once:**
1. Contract address is correct (call a view function to verify)
2. Start block is before deployment
3. Contract might be a proxy (check for events on implementation)
4. Events might be emitted from a different contract (router, factory)

**Process:**
1. Verify contract exists and is correct type
2. Check if there's ANY activity (total supply, etc.)
3. If no events found but contract has activity → explain proxy/router pattern
4. Don't keep adjusting filters endlessly

## General Principles

### Be Honest About Limitations

"Let me try another search..."
"I've tried searching but can't access that data. Here's how you can get it..."

### Value User's Time

- 2 failed attempts = stop and pivot
- Clear, direct communication > persistent failing
- Offer manual alternatives early

### Know When You're Stuck

Signs you're stuck:
- Repeating the same type of search 3+ times
- Getting 403/blocked errors repeatedly
- No new information from each attempt

Action: **Stop and ask the user directly**

## Indexer-Specific Best Practices

### Contract Deployment Blocks

**Default approach:**
1. Ask user if they know the block
2. If not, try ONE web search
3. If that fails, use conservative estimate and tell user how to find exact block

**DON'T:**
- Try 5+ different search queries
- Attempt multiple web scraping approaches
- Keep trying after getting blocked

### Testing Indexers

**Efficient testing flow:**
1. Start with broader filter (all events)
2. Check if ANY events are captured
3. If yes → narrow filter to target events
4. If no → verify contract/deployment/proxy pattern

**One test cycle, then explain findings.**

### Zero Results Analysis

When indexer finds 0 events but contract clearly has activity:

**Quick checklist:**
1. Contract verified (call view function)
2. Has activity (check total supply/balance)
3. No Transfer events found

**Conclusion:** Proxy/router pattern or wrong contract

**Action:** Explain this to user, don't keep tweaking the indexer.

---

---

## CLI Template Development - Critical Rules

### Template Export Names MUST Match Template ID

**Rule:** The exported constant name MUST exactly match the `templateId` field.

**Why:** pipeComposite references templates by their templateId. Mismatched names cause `TypeError: v.id is not a function`.

**Pattern:**
```typescript
// template.config.ts
class MyTemplate extends PipeTemplateMeta {
  templateId = 'myTemplate'  // ← This name
  // ...
}

export const myTemplate = new MyTemplate()  // ← MUST match exactly
```

**Common Mistake:**
```typescript
// WRONG
templateId = 'bridgeEvents'
export const bridge = new BridgeTemplate()  // Mismatch!

// CORRECT
templateId = 'bridgeEvents'
export const bridgeEvents = new BridgeTemplate()
```

**Verification:**
```bash
# After creating template, verify:
grep "templateId" template.config.ts
grep "export const" template.config.ts
# Names should match!
```

### Portal Dataset Names - Use Correct Formats

**Rule:** SQD Portal dataset names ≠ DeFiLlama chain names. Always use correct Portal names.

**Common Mistakes:**
- `datasets/ethereum` → `datasets/ethereum-mainnet`
- `datasets/arbitrum` → `datasets/arbitrum-one`
- `datasets/arbitrum-mainnet` → `datasets/arbitrum-one`
- `datasets/zksync-era` → `datasets/zksync-mainnet`
- `datasets/bsc` → `datasets/binance-mainnet`

**Action:** Check CHAIN_NAME_MAPPING.md before using any chain name.

**Verification Script:**
```bash
# Test Portal URL before using in template
curl -I https://portal.sqd.dev/datasets/<chain-name>/metadata
# Should return 200, not 404
```

### ClickHouse Password - Verify After Every Template Generation

**Rule:** CLI generates `.env` with wrong password. ALWAYS verify and fix.

**The Problem:**
- CLI generates: `CLICKHOUSE_PASSWORD=password`
- Docker uses: `CLICKHOUSE_PASSWORD=default`
- Result: Authentication failures

**Mandatory Check (Add to every template test):**
```bash
# Step 1: Generate template
node .../cli/dist/index.cjs init test-<template>

# Step 2: IMMEDIATELY verify password
cd test-<template>
cat .env | grep CLICKHOUSE_PASSWORD

# Step 3: Fix if wrong
sed -i '' 's/CLICKHOUSE_PASSWORD=.*/CLICKHOUSE_PASSWORD=default/' .env
```

**This is NOT optional. Check EVERY TIME.**

### Template Validation - Data Collection Required

**Rule:** "Indexer syncs blocks successfully" is NOT a success metric. Templates must produce actual data.

**Validation Checklist:**
1. Indexer starts without errors
2. Indexer syncs blocks
3. **Data appears within 30 seconds** ← CRITICAL
4. Data volume is reasonable (100+ events expected)
5. Data fields are populated (no NULL/undefined)

**If No Data After 30 Seconds:**
- DON'T wait longer
- DON'T assume it will come eventually
- DEBUG immediately:
  - Check contract address (correct deployment?)
  - Check ABI (proxy vs implementation?)
  - Check deployment block (before or after events?)
  - Check event names (exact match with ABI?)

**Example - Bridge Events Template:**
- Synced 4.8M blocks
- Captured 0 events
- **Result: INCOMPLETE template**
- Don't ship templates that produce zero data

### Template Complexity - Know When to Pivot

**Rule:** If a protocol pattern is too complex for a simple template, pivot to a simpler example.

**Example - GMX:**
- GMX V2: EventEmitter with generic EventLog1/EventLog2 (too complex)
- GMX V1: Typed events (IncreasePosition, DecreasePosition, etc.)
- **Time saved by pivoting: 30+ minutes**

**When to Pivot:**
- Protocol uses dynamic event names (string eventName fields)
- Protocol uses generic event signatures (EventLog1, EventLog2)
- Protocol requires multi-step decoding (decode data inside data)
- Template would need 100+ lines of custom logic

**Action:** Find a simpler protocol in the same category or mark template as "Advanced - requires custom implementation"

---

## Summary

**The Golden Rule:** If something doesn't work after 2 attempts, explain why and give the user control rather than continuing to try variations.

**Template Development Addendum:**
- Export names must match templateId (exact!)
- Portal dataset names must be verified (check CHAIN_NAME_MAPPING.md)
- ClickHouse password must be verified after EVERY generation
- Templates must produce data within 30 seconds (syncing blocks ≠ success)
- Pivot if protocol is too complex for template pattern

**Remember:** The user's goal is to make progress, not watch you exhaust every possibility.
