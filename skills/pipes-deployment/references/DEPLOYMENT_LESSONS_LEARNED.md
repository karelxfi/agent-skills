# Deployment Lessons Learned - Railway + ClickHouse Cloud

## What Happened: Full Timeline

### Initial Deployment Attempt
1. User requested Railway deployment
2. Created new Railway project successfully
3. Attempted to deploy using Dockerfile
4. **FAILED**: Deployment kept failing with silent errors

### Problem #1: Dockerfile Misconfiguration
**Error**: Build failures, no detailed logs via CLI

**Root Cause**:
- Dockerfile was configured for `pnpm` but project uses `bun`
- Railway CLI doesn't show detailed Docker build errors

**Solution**:
- Removed Dockerfile entirely
- Let Railway auto-detect using Nixpacks
- **Lesson**: Trust Railway's auto-detection unless you have specific Docker requirements

### Problem #2: ClickHouse FINAL Error (Main Issue)
**Error**: `Storage SharedMergeTree doesn't support FINAL`

**Root Cause Chain**:
1. Original schema used `ReplacingMergeTree` for tokens, token_prices, pools tables
2. ClickHouse Cloud automatically converts `ReplacingMergeTree` → `SharedMergeTree`
3. Subsquid's clickhouseTarget library auto-adds `FINAL` keyword when querying ReplacingMergeTree tables
4. SharedMergeTree engine doesn't support `FINAL` modifier
5. Indexer crashes on startup during table inspection

**Failed Attempts**:
- Changed schema to MergeTree but didn't drop existing tables
- Created `000_drop_tables.sql` with only 3 tables
- Multiple redeploys without clearing database first
- Tried to debug via logs without understanding root cause

**What Finally Worked**:
- Created `000_drop_all_tables.sql` to drop ALL tables including sync table
- Changed schema from ReplacingMergeTree to MergeTree for reference tables
- Redeployed with clean slate

**Key Insight**:
The Subsquid library caches table engine types. Even after changing the schema, old tables with ReplacingMergeTree metadata persisted. The `sync` table also needed to be dropped to force a complete reset.

### Problem #3: Too Many Redeploys
**Mistake**: Deployed 6-7 times trying incremental fixes

**Better Approach**:
1. Test locally first to reproduce error
2. Inspect ClickHouse table schemas directly
3. Drop tables manually via SQL
4. Then redeploy once with fix

## Critical Deployment Rules

### Rule 1: ALWAYS Test Locally First
```bash
# NEVER deploy to Railway without local testing
railway up  # Before testing

# ALWAYS test locally first
bun run dev  # Test first
Verify data in ClickHouse
railway up  # Deploy after validation
```

### Rule 2: Verify ClickHouse Cloud Compatibility
```sql
-- DON'T use ReplacingMergeTree with ClickHouse Cloud
ENGINE = ReplacingMergeTree(updated_at)

-- DO use MergeTree for all tables
ENGINE = MergeTree()
```

**Why**: ClickHouse Cloud's SharedMergeTree doesn't support:
- `FINAL` modifier
- Some ReplacingMergeTree-specific features

### Rule 3: Clean Slate for Schema Changes
```sql
-- When changing table engines:
-- 1. Drop ALL tables including views and sync
DROP TABLE IF EXISTS sync;
DROP TABLE IF EXISTS [all_other_tables];

-- 2. Then recreate with new schema
CREATE TABLE tokens (...) ENGINE = MergeTree();
```

### Rule 4: Trust Railway Auto-Detection
```bash
# DON'T create custom Dockerfile unless needed
Dockerfile with pnpm/npm/bun

# DO let Railway auto-detect
Remove Dockerfile
Railway uses Nixpacks
Auto-detects bun.lockb
```

### Rule 5: Inspect Database Before Debugging Code
```bash
# When indexer crashes:
# 1. Check ClickHouse table schemas first
mcp__clickhouse_cloud__run_select_query("
  SELECT name, engine
  FROM system.tables
  WHERE database = 'pipes'
")

# 2. Check for ReplacingMergeTree → SharedMergeTree conversion
# 3. Drop and recreate if engine changed

# 4. THEN check code
```

## Improved Deployment Workflow

### Phase 1: Pre-Deployment Validation (Local)
```bash
# 1. Test indexer locally
bun run dev

# 2. Verify data appears in ClickHouse
mcp__clickhouse_cloud__run_select_query("
  SELECT COUNT(*) FROM pipes.swaps
")

# 3. Check for errors in local logs
# If any errors → fix before Railway

# 4. Verify schema compatibility
# - No ReplacingMergeTree tables
# - All table names match code references
```

### Phase 2: Railway Deployment
```bash
# 1. Remove Dockerfile if present
rm Dockerfile  # Let Railway auto-detect

# 2. Ensure .env is NOT in .gitignore for Railway
# Railway needs .env for initial setup

# 3. Create/link Railway project
railway init  # Or railway link

# 4. Set environment variables
railway variables set CLICKHOUSE_URL=xxx
railway variables set CLICKHOUSE_DATABASE=pipes
railway variables set CLICKHOUSE_USER=default
railway variables set CLICKHOUSE_PASSWORD=xxx
railway variables set METRICS_PORT=9090
railway variables set METRICS_ENABLED=true

# 5. Deploy
railway up

# 6. Wait 30 seconds for startup

# 7. Check logs
railway logs --deployment [latest]
```

### Phase 3: Post-Deployment Verification
```bash
# 1. Check deployment logs for startup
railway logs | grep "Start indexing"

# 2. Wait 2 minutes for initial data

# 3. Verify data in ClickHouse
mcp__clickhouse_cloud__run_select_query("
  SELECT COUNT(*) FROM pipes.swaps
")

# 4. Check sync progress
railway logs | grep "blocks/second"

# 5. Monitor for crashes
railway logs --follow
```

## Common Errors & Solutions

### Error: "Storage SharedMergeTree doesn't support FINAL"

**Diagnosis**:
```sql
-- Check table engines
SELECT name, engine, create_table_query
FROM system.tables
WHERE database = 'pipes'
  AND name IN ('tokens', 'token_prices', 'pools')
```

**Solution**:
```sql
-- Drop all tables (including sync!)
DROP TABLE IF EXISTS sync;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS token_prices;
DROP TABLE IF EXISTS pools;
DROP TABLE IF EXISTS [all_views];

-- Update schema to use MergeTree
-- Then redeploy
```

**Prevention**:
```sql
-- Never use ReplacingMergeTree with ClickHouse Cloud
-- Use MergeTree for all tables
ENGINE = MergeTree()
ORDER BY address
```

### Error: Deployment Succeeds But No Data

**Diagnosis**:
```bash
# Check logs for actual start
railway logs | grep -i "start\|error\|failed"

# Check ClickHouse connection
railway logs | grep -i "clickhouse"

# Verify tables exist
mcp__clickhouse_cloud__run_select_query("SHOW TABLES FROM pipes")
```

**Common Causes**:
1. Wrong start block (too recent, no events)
2. Wrong contract addresses
3. ClickHouse connection failed but indexer didn't crash
4. Tables not created (migration failed silently)

### Error: Build Failed (Docker)

**Solution**:
```bash
# Remove custom Dockerfile
rm Dockerfile

# Let Railway auto-detect
# Railway will use Nixpacks and detect:
# - bun.lockb → use Bun
# - package-lock.json → use npm
# - pnpm-lock.yaml → use pnpm
```

## Railway-Specific Tips

### Free Tier Limitations
- $5 credit/month
- 1 service only
- Sleeps after inactivity
- Limited compute resources

**Strategy**:
- Use for testing deployments
- Delete after full sync completes
- Run locally for development
- Upgrade to Hobby ($5/month) for production

### Environment Variables
```bash
# Set all at once
railway variables set \
  CLICKHOUSE_URL=xxx \
  CLICKHOUSE_DATABASE=pipes \
  CLICKHOUSE_USER=default \
  CLICKHOUSE_PASSWORD=xxx \
  METRICS_PORT=9090 \
  METRICS_ENABLED=true

# Verify
railway variables
```

### Logs Access
```bash
# Real-time
railway logs --follow

# Last deployment
railway logs

# Build logs only
railway logs --build

# Filter
railway logs | grep error
railway logs | grep "blocks/second"
```

## ClickHouse Cloud Tips

### Verify Connection Before Deploy
```bash
# Test connection
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1" \
  --max-time 10

# If fails:
# - Check URL (https://xxx.clickhouse.cloud:8443)
# - Check password
# - Check IP allowlist (should include 0.0.0.0/0 for Railway)
```

### Monitor Table Engines
```sql
-- After first deployment, verify engines
SELECT name, engine
FROM system.tables
WHERE database = 'pipes'

-- Should all be MergeTree or SharedMergeTree
-- If any show ReplacingMergeTree → ERROR
```

### Quick Data Verification
```sql
-- Check data exists
SELECT COUNT(*) FROM pipes.swaps;

-- Check latest block
SELECT MAX(block_number) FROM pipes.swaps;

-- Check recent events
SELECT * FROM pipes.swaps
ORDER BY block_timestamp DESC
LIMIT 5;
```

## Recommended Agent Improvements

### 1. Pre-Flight Checklist Agent
Create agent that runs BEFORE deployment:
- Verify no ReplacingMergeTree in schema
- Test ClickHouse connection
- Test local indexer (30 seconds)
- Check Railway authentication
- Verify table names match code

### 2. Schema Validator Agent
Create agent that validates schema files:
- No ReplacingMergeTree engines
- All tables use MergeTree
- Table names match code references
- Migrations numbered correctly

### 3. Deployment Monitor Agent
Create agent that monitors after deployment:
- Wait for startup
- Check logs for errors
- Verify data appears in ClickHouse
- Monitor sync progress
- Alert on crashes

### 4. Troubleshooting Diagnostic Agent
We have this! See `.claude/agents/troubleshooting-diagnostic.md`

## Questions to Ask User Before Deployment

### Before Railway Deploy:
1. "Have you tested this indexer locally?"
   - If NO → "Let's test locally first"
   - If YES → Continue

2. "Does your ClickHouse schema use ReplacingMergeTree?"
   - If YES → "We need to change to MergeTree for Cloud compatibility"
   - If NO → Continue

3. "Is your ClickHouse Cloud service running?"
   - Test connection
   - If FAIL → Help fix connection
   - If SUCCESS → Continue

4. "Do you want to deploy to Railway free tier or paid?"
   - Free → Explain 1 service limit
   - Paid → Continue

### After Deployment:
1. "Let's wait 2 minutes and verify data appears"
2. "Would you like me to set up monitoring?"
3. "Should I create a query API for this data?"

## Success Criteria

Deployment is successful when:
- Railway service running (no crash loop)
- Logs show "Start indexing from X block"
- After 2 min: Data appears in ClickHouse
- Logs show "blocks/second" progress
- No "FINAL" errors
- No ClickHouse connection errors

## Documentation Generated
- `RAILWAY_DEPLOYMENT.md` - Management guide
- `CLICKHOUSE_CLOUD_CONNECTION.md` - Connection details
- `.env.example` - Environment template

---

**Date**: 2026-02-03
**Deployment**: base-uniswap-swaps
**Result**: SUCCESS (after fixing schema)
**Total Time**: ~45 minutes (including debugging)
**Optimal Time**: 5-10 minutes (with proper validation)
