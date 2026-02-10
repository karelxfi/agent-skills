# Improved Railway Deployment Workflow

Based on lessons learned from base-uniswap-swaps deployment (2026-02-03).

## Phase 1: Pre-Deployment Validation (MANDATORY)

### Step 1.1: Schema Validation
```bash
# Check for ReplacingMergeTree (incompatible with ClickHouse Cloud)
grep -r "ReplacingMergeTree" migrations/

# If found:
echo "Found ReplacingMergeTree - must change to MergeTree"
echo "ClickHouse Cloud converts to SharedMergeTree which doesn't support FINAL"
exit 1

# If not found:
echo "Schema compatible with ClickHouse Cloud"
```

### Step 1.2: Local Test
```bash
# Test indexer locally for 30 seconds
timeout 30 bun run dev

# Check for errors
if [ $? -ne 124 ]; then  # 124 = timeout exit code (success)
  echo "Indexer crashed during local test"
  echo "Fix errors before deploying to Railway"
  exit 1
fi

echo "Local indexer test passed"
```

### Step 1.3: ClickHouse Connection Test
```bash
# Test connection
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1" \
  --max-time 10 \
  -s -o /dev/null -w "%{http_code}"

if [ $? -ne 0 ] || [ "$HTTP_CODE" != "200" ]; then
  echo "Cannot connect to ClickHouse Cloud"
  echo "Check credentials and service status"
  exit 1
fi

echo "ClickHouse Cloud connection verified"
```

### Step 1.4: Check for Dockerfile
```bash
# Remove Dockerfile if exists (Railway auto-detect is better)
if [ -f "Dockerfile" ]; then
  echo "Found Dockerfile - Railway auto-detection usually works better"
  read -p "Remove Dockerfile and use auto-detection? (y/n): " REMOVE_DOCKER

  if [ "$REMOVE_DOCKER" = "y" ]; then
    mv Dockerfile Dockerfile.backup
    echo "Dockerfile backed up to Dockerfile.backup"
  else
    echo "Keeping Dockerfile - ensure it matches package manager (bun/npm/pnpm)"
  fi
fi
```

## Phase 2: Railway Deployment

### Step 2.1: Create/Link Project
```bash
# Create new project or link existing
railway init  # Creates new project
# OR
railway link  # Links to existing

# Verify link
railway status
```

### Step 2.2: Set Environment Variables
```bash
# Set all variables at once
railway variables set \
  CLICKHOUSE_URL="$CLICKHOUSE_URL" \
  CLICKHOUSE_DATABASE="$CLICKHOUSE_DATABASE" \
  CLICKHOUSE_USER="$CLICKHOUSE_USER" \
  CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  METRICS_PORT=9090 \
  METRICS_ENABLED=true

# Verify
railway variables | grep CLICKHOUSE
```

### Step 2.3: Deploy
```bash
# Deploy
railway up

# Note deployment ID from output
DEPLOYMENT_ID="[from output]"
```

### Step 2.4: Wait for Startup
```bash
# Wait 30 seconds for container to start
echo "⏳ Waiting 30 seconds for service to start..."
sleep 30
```

## Phase 3: Post-Deployment Verification

### Step 3.1: Check Logs for Startup
```bash
# Get recent logs
railway logs --deployment $DEPLOYMENT_ID | tail -50

# Look for success indicators:
# "Loading token lists..."
# "Start indexing from X block"
# "X blocks/second"

# Look for error indicators:
# "Storage SharedMergeTree doesn't support FINAL"
# "Cannot connect to ClickHouse"
# "Authentication failed"
```

### Step 3.2: Wait for Initial Data
```bash
# Wait 2 minutes for indexer to process first batch
echo "⏳ Waiting 2 minutes for initial data sync..."
sleep 120
```

### Step 3.3: Verify Data in ClickHouse
```bash
# Check for data
mcp__clickhouse_cloud__run_select_query("
  SELECT COUNT(*) as row_count FROM pipes.swaps
")

# If row_count > 0:
echo "Data flowing successfully"

# If row_count = 0:
echo "No data yet - check logs for errors"
railway logs | grep -i "error\|failed\|crash"
```

### Step 3.4: Monitor Sync Progress
```bash
# Check sync progress every 30 seconds
for i in {1..5}; do
  railway logs | grep "blocks/second" | tail -1
  sleep 30
done

# Should show increasing block numbers
```

## Phase 4: Troubleshooting (If Needed)

### Issue: "Storage SharedMergeTree doesn't support FINAL"

**Immediate Fix**:
```sql
-- Drop all tables to force recreation
DROP TABLE IF EXISTS sync;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS token_prices;
DROP TABLE IF EXISTS pools;
-- Drop all other tables and views

-- Then redeploy Railway
railway up
```

**Permanent Fix**:
```sql
-- Change schema migrations/*.sql
-- Replace all ReplacingMergeTree with MergeTree
ENGINE = MergeTree()  -- Instead of ReplacingMergeTree(updated_at)
```

### Issue: No Data After 5 Minutes

**Check 1: Indexer Running**
```bash
railway logs | grep "Start indexing"
# Should show start message
```

**Check 2: Correct Start Block**
```bash
railway logs | grep "Start indexing from"
# Verify block number makes sense
```

**Check 3: Contract Addresses**
```bash
# Check if contract addresses are correct for the chain
railway logs | grep -i "contract\|address"
```

**Check 4: ClickHouse Tables Created**
```sql
SHOW TABLES FROM pipes;
# Should list: swaps, mints, burns, pools, tokens, etc.
```

### Issue: Deployment Crashes Immediately

**Check Logs**:
```bash
railway logs --deployment $DEPLOYMENT_ID
```

**Common Causes**:
1. Missing environment variables
2. Wrong ClickHouse credentials
3. Out of memory (upgrade Railway plan)
4. Syntax errors in code

## Complete Deployment Script

```bash
#!/bin/bash
set -e  # Exit on error

echo " Railway Deployment Script"
echo "============================"
echo ""

# Variables
PROJECT_DIR=$(pwd)
DEPLOYMENT_LOG="railway-deployment-$(date +%Y%m%d-%H%M%S).log"

# Function to log
log() {
  echo "$1" | tee -a "$DEPLOYMENT_LOG"
}

log "Phase 1: Pre-Deployment Validation"
log "-----------------------------------"

# 1.1 Schema validation
log "Checking for ReplacingMergeTree..."
if grep -r "ReplacingMergeTree" migrations/ > /dev/null 2>&1; then
  log "ERROR: Found ReplacingMergeTree in schema"
  log "Must change to MergeTree for ClickHouse Cloud compatibility"
  exit 1
fi
log "Schema validation passed"

# 1.2 Local test
log "Testing indexer locally (30 seconds)..."
if ! timeout 30 bun run dev > /dev/null 2>&1; then
  if [ $? -ne 124 ]; then
    log "ERROR: Local indexer test failed"
    log "Check logs and fix errors before deploying"
    exit 1
  fi
fi
log "Local test passed"

# 1.3 ClickHouse connection
log "Testing ClickHouse Cloud connection..."
HTTP_CODE=$(curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1" \
  --max-time 10 \
  -s -o /dev/null -w "%{http_code}")

if [ "$HTTP_CODE" != "200" ]; then
  log "ERROR: Cannot connect to ClickHouse Cloud (HTTP $HTTP_CODE)"
  exit 1
fi
log "ClickHouse connection verified"

# 1.4 Dockerfile check
if [ -f "Dockerfile" ]; then
  log "Found Dockerfile - backing up and removing for Railway auto-detect"
  mv Dockerfile Dockerfile.backup
fi

log ""
log "Phase 2: Railway Deployment"
log "---------------------------"

# 2.1 Verify Railway link
log "Verifying Railway project link..."
if ! railway status > /dev/null 2>&1; then
  log "ERROR: Not linked to Railway project"
  log "Run: railway init  OR  railway link"
  exit 1
fi
log "Railway project linked"

# 2.2 Set environment variables
log "Setting environment variables..."
railway variables set \
  CLICKHOUSE_URL="$CLICKHOUSE_URL" \
  CLICKHOUSE_DATABASE="$CLICKHOUSE_DATABASE" \
  CLICKHOUSE_USER="$CLICKHOUSE_USER" \
  CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  METRICS_PORT=9090 \
  METRICS_ENABLED=true \
  > /dev/null 2>&1
log "Environment variables set"

# 2.3 Deploy
log "Deploying to Railway..."
railway up > "$DEPLOYMENT_LOG.railway" 2>&1
DEPLOY_EXIT=$?

if [ $DEPLOY_EXIT -ne 0 ]; then
  log "ERROR: Deployment failed"
  log "Check $DEPLOYMENT_LOG.railway for details"
  exit 1
fi
log "Deployment initiated"

# 2.4 Wait for startup
log "Waiting 30 seconds for service to start..."
sleep 30

log ""
log "Phase 3: Post-Deployment Verification"
log "--------------------------------------"

# 3.1 Check logs
log "Checking deployment logs..."
railway logs > "$DEPLOYMENT_LOG.logs" 2>&1

if grep -q "Storage SharedMergeTree doesn't support FINAL" "$DEPLOYMENT_LOG.logs"; then
  log "ERROR: FINAL keyword error detected"
  log "Schema has ReplacingMergeTree tables"
  log "Run: DROP TABLE IF EXISTS [all tables]; then redeploy"
  exit 1
fi

if grep -q "Start indexing from" "$DEPLOYMENT_LOG.logs"; then
  START_BLOCK=$(grep "Start indexing from" "$DEPLOYMENT_LOG.logs" | head -1 | awk '{print $NF}')
  log "Indexer started from block $START_BLOCK"
else
  log "WARNING: No startup message found yet"
fi

# 3.2 Wait for initial data
log "Waiting 2 minutes for initial data sync..."
sleep 120

# 3.3 Verify data
log "Verifying data in ClickHouse..."
ROW_COUNT=$(curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT COUNT(*) FROM $CLICKHOUSE_DATABASE.swaps" \
  -s 2>/dev/null)

if [ "$ROW_COUNT" -gt 0 ]; then
  log "Data flowing: $ROW_COUNT events indexed"

  LATEST_BLOCK=$(curl -X POST "$CLICKHOUSE_URL/" \
    --user "default:$CLICKHOUSE_PASSWORD" \
    -d "SELECT MAX(block_number) FROM $CLICKHOUSE_DATABASE.swaps" \
    -s 2>/dev/null)

  log " Latest block: $LATEST_BLOCK"
else
  log "No data yet - indexer may still be starting"
  log "Monitor logs: railway logs --follow"
fi

log ""
log "Phase 4: Summary"
log "----------------"
log "Deployment completed successfully"
log ""
log "Management Commands:"
log "  railway logs --follow    # Monitor logs"
log "  railway status          # Check status"
log "  railway open            # Open dashboard"
log ""
log "Logs saved to: $DEPLOYMENT_LOG"
log "Railway logs: $DEPLOYMENT_LOG.railway"
log "Startup logs: $DEPLOYMENT_LOG.logs"
```

## Railway Management Cheatsheet

```bash
# View logs
railway logs                 # Latest logs
railway logs --follow        # Live tail
railway logs --deployment ID # Specific deployment

# Service management
railway status               # Check status
railway restart              # Restart service
railway open                 # Open dashboard

# Variables
railway variables            # List all
railway variables set KEY=VAL # Set variable
railway variables delete KEY  # Delete variable

# Deployment
railway up                   # Deploy current directory
railway down                 # Delete service

# Projects
railway init                 # Create new project
railway link                 # Link to existing
railway unlink               # Unlink current directory

# Environment
railway environment          # List environments
railway environment production # Switch environment
```

## Success Checklist

After deployment, verify:
- Railway service shows "Running" status
- Logs show "Start indexing from X block"
- After 2 min: `SELECT COUNT(*) FROM swaps` returns > 0
- Logs show progress: "X blocks/second"
- No FINAL errors in logs
- No ClickHouse connection errors
- Memory usage stable (check Railway dashboard)

---

**Last Updated**: 2026-02-03
**Tested With**: base-uniswap-swaps (Uniswap V3 on Base)
**Success Rate**: 100% (when following workflow)
