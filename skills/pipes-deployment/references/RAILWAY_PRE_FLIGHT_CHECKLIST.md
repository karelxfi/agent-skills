# Railway Deployment Pre-Flight Checklist

**Last Updated**: 2026-02-03
**Source**: base-uniswap-swaps deployment lessons learned

## Purpose

This checklist MUST be completed before EVERY Railway deployment to prevent common deployment failures. Following this checklist reduces deployment time from 45+ minutes (with errors) to 5-10 minutes (error-free).

## Mandatory Validation Steps

### Step 1: Schema Validation (ClickHouse Cloud Compatibility)

**Validation Command**:
```bash
grep -r "ReplacingMergeTree" migrations/
```

**Expected Result**: No output (no matches found)

**If ReplacingMergeTree is found**:

**BLOCKING ERROR** - Deployment will fail with:
```
Storage SharedMergeTree doesn't support FINAL
```

**Required Fixes**:

1. **Change schema** from ReplacingMergeTree to MergeTree:
```sql
-- WRONG (causes FINAL error)
ENGINE = ReplacingMergeTree(updated_at)

-- CORRECT
ENGINE = MergeTree()
```

2. **Create drop migration** `migrations/000_drop_all_tables.sql`:
```sql
-- Drop ALL tables to force recreation
DROP TABLE IF EXISTS sync;           -- CRITICAL: Must include sync
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS pools;
DROP TABLE IF EXISTS swaps;
-- ... all other tables and views
```

3. **Why this matters**:
   - ClickHouse Cloud converts ReplacingMergeTree → SharedMergeTree automatically
   - Subsquid adds FINAL keyword when querying replacing tables
   - SharedMergeTree doesn't support FINAL
   - Result: Indexer crashes on startup

**Prevention**: Always use MergeTree for ALL tables when deploying to ClickHouse Cloud.

---

### Step 2: Local Test (30 Seconds)

**Validation Command**:
```bash
timeout 30 bun run dev
```

**Expected Result**: No crashes, timeout after 30 seconds

**Check For**:
- Indexer starts successfully
- Connects to ClickHouse
- Begins processing blocks
- No error messages

**If test fails**:

**BLOCKING ERROR** - Fix locally before Railway deployment

**Common Local Errors**:
1. Missing environment variables → Create `.env` file
2. ClickHouse connection failed → Check CLICKHOUSE_URL and password
3. ABI errors → Regenerate with `/generate-abi`
4. Contract address wrong → Verify on block explorer

**Why this matters**: Errors that occur locally will occur on Railway, but debugging on Railway is slower and uses deployment credits.

---

### Step 3: ClickHouse Cloud Connection Test

**Validation Command**:
```bash
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1" \
  --max-time 10
```

**Expected Result**: `1` (HTTP 200)

**If connection fails**:

**BLOCKING ERROR** - Railway deployment will fail silently

**Troubleshooting**:

1. **Check URL format**:
```bash
# CORRECT
https://xxx.eu-west-1.aws.clickhouse.cloud:8443

# WRONG
http://xxx.eu-west-1.aws.clickhouse.cloud:8123  # Wrong protocol/port
```

2. **Check password**:
   - Copy from ClickHouse Cloud dashboard
   - No trailing spaces
   - Use quotes if special characters

3. **Check service status**:
   - ClickHouse Cloud dashboard → Service should be "Running"
   - If stopped, start it

4. **Check IP allowlist**:
   - Railway uses dynamic IPs
   - Add `0.0.0.0/0` to allowlist (or specific Railway IP ranges)

---

### Step 4: Dockerfile Validation

**Validation Command**:
```bash
ls -la Dockerfile 2>/dev/null
```

**Expected Result**: No Dockerfile (Railway auto-detection preferred)

**If Dockerfile exists**:

⚠️ **WARNING** - May cause package manager mismatch

**Recommendation**: Remove Dockerfile

**Why**:
- Railway's Nixpacks auto-detects package manager (bun/npm/pnpm)
- Custom Dockerfiles often have wrong package manager
- Example: Dockerfile with `pnpm` but project uses `bun.lockb`
- Result: Build failures with no detailed error logs

**To remove**:
```bash
mv Dockerfile Dockerfile.backup  # Keep backup
# Railway will now use auto-detection
```

**If you must keep Dockerfile**, verify it matches package manager:
```bash
# Check which package manager is used
ls -la bun.lockb pnpm-lock.yaml package-lock.json

# Ensure Dockerfile uses the same
grep -i "bun\|pnpm\|npm" Dockerfile
```

---

### Step 5: Environment Variables Ready

**Required Variables**:
```bash
CLICKHOUSE_URL=https://xxx.clickhouse.cloud:8443
CLICKHOUSE_DATABASE=pipes
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<your-password>
METRICS_PORT=9090
METRICS_ENABLED=true
```

**Validation**:
- [ ] All values copied from ClickHouse Cloud dashboard
- [ ] No trailing spaces or newlines
- [ ] Password tested in Step 3
- [ ] Database name matches migrations

---

## Pre-Flight Checklist Summary

**Before running `railway up`, verify ALL items**:

- [ ] Schema validation: No ReplacingMergeTree found
- [ ] Local test: 30 seconds without crashes
- [ ] ClickHouse connection: SELECT 1 returns success
- [ ] Dockerfile: Removed or matches package manager
- [ ] Environment variables: All required values ready

**If ANY checkbox is unchecked**: STOP and fix before deploying.

---

## Post-Deployment Verification

**After `railway up` completes**:

### Wait 30 Seconds
```bash
sleep 30
```

### Check Logs for Startup
```bash
railway logs | grep "Start indexing"
```

**Expected**: `Start indexing from X block`

**If not found**: Check for errors
```bash
railway logs | grep -i "error\|crash\|fail"
```

### Wait 2 Minutes for Data
```bash
sleep 120
```

### Verify Data in ClickHouse
```bash
# Using MCP
mcp__clickhouse_cloud__run_select_query("
  SELECT COUNT(*) FROM pipes.swaps
")

# Using curl
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT COUNT(*) FROM pipes.swaps"
```

**Expected**: COUNT > 0

**If COUNT = 0**: Check Railway logs for sync progress

---

## Success Criteria

Deployment is successful when ALL of these are true:

- Railway service status: "Running" (not "Crashed")
- Logs show: "Start indexing from X block"
- After 2 min: COUNT(*) > 0 in ClickHouse
- Logs show: "X blocks/second" progress
- No "FINAL" errors in logs
- No ClickHouse connection errors in logs
- Memory usage stable in Railway dashboard

---

## Common Deployment Failures

### Failure 1: "Storage SharedMergeTree doesn't support FINAL"

**Cause**: Schema uses ReplacingMergeTree

**Prevention**: Step 1 (Schema Validation)

**Fix**:
1. Drop all tables in ClickHouse (including sync)
2. Change schema to MergeTree
3. Redeploy

---

### Failure 2: Build Failed (Silent Errors)

**Cause**: Dockerfile package manager mismatch

**Prevention**: Step 4 (Dockerfile Validation)

**Fix**:
1. Remove Dockerfile
2. Let Railway use auto-detection
3. Redeploy

---

### Failure 3: No Data After 5 Minutes

**Cause**: ClickHouse connection failed silently

**Prevention**: Step 3 (Connection Test)

**Fix**:
1. Check Railway logs for ClickHouse errors
2. Verify environment variables
3. Test connection from Railway dashboard
4. Restart deployment

---

## Time Estimates

**With Pre-Flight Checklist**:
- Pre-flight validation: 2-3 minutes
- Railway deployment: 2-3 minutes
- Post-deployment verification: 2-3 minutes
- **Total: 5-10 minutes**

**Without Pre-Flight Checklist** (if errors occur):
- Initial deploy: 3 minutes
- Error 1 (FINAL): 5 minutes to debug + redeploy
- Error 2 (Dockerfile): 5 minutes to debug + redeploy
- Error 3 (No data): 10 minutes to debug + redeploy
- Multiple iterations: 6-7 redeploys
- **Total: 45+ minutes**

**Savings**: 35-40 minutes per deployment

---

## Integration with Agents

### Railway Deployer Agent

The railway-deployer agent has been updated to automatically run all pre-flight checks before deployment. It will:

1. Run all validation steps
2. Block deployment if any check fails
3. Provide clear error messages
4. Suggest fixes for each error

### Indexer Code Writer Agent

The indexer-code-writer agent has been updated to:

1. Generate ClickHouse Cloud compatible schemas (MergeTree only)
2. Never use ReplacingMergeTree
3. Include proper environment variable loading
4. Validate package versions before generating package.json

---

## Reference

- **Original Lessons**: `.claude/docs/DEPLOYMENT_LESSONS_LEARNED.md`
- **Improved Workflow**: `.claude/docs/IMPROVED_RAILWAY_WORKFLOW.md`
- **Railway Deployer Agent**: `.claude/agents/railway-deployer.md`
- **Indexer Code Writer Agent**: `.claude/agents/indexer-code-writer.md`

---

**Remember**: 5 minutes of validation prevents 45+ minutes of debugging.
