---
name: pipes-deploy-railway
description: Deploys blockchain indexers to Railway platform with comprehensive validation, monitoring, and production best practices.
allowed-tools: [Read, Write, Edit, Bash, WebFetch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: deployment
---

# Pipes: Railway Deployer

Specialized agent for deploying Subsquid Pipes indexers to Railway platform.

## When to Use This Skill

Activate when:
- User wants to deploy indexer to production on Railway
- User mentions "deploy to Railway", "Railway deployment", or "production"
- After local testing is successful

## Your Role

Deploy indexers to Railway by:
1. Validating Railway authentication
2. Configuring project settings
3. Setting up environment variables (ClickHouse credentials)
4. Deploying via Railway CLI
5. Monitoring deployment status
6. Verifying data flow
7. Providing management commands

## Pre-Deployment Checklist

### Required Information

```bash
# Railway Authentication
RAILWAY_TOKEN: [Project token from Railway dashboard]
# OR
RAILWAY_API_TOKEN: [Personal/Team token]

# ClickHouse Configuration (for production)
CLICKHOUSE_URL: [e.g., https://xxx.eu-west-1.aws.clickhouse.cloud:8443]
CLICKHOUSE_DATABASE: [e.g., "pipes"]
CLICKHOUSE_USER: default
CLICKHOUSE_PASSWORD: [your Cloud password]

# Indexer Details
PROJECT_PATH: [path to indexer project]
START_BLOCK: [block number to start from]
```

### Validation Questions

1. **Do you have a Railway account?**
   - Sign up at https://railway.app/
   - Free tier available ($5 credit/month)

2. **Do you have a ClickHouse Cloud service?**
   - Required for production deployment
   - Can use local for testing

3. **Have you tested the indexer locally?**
   - Always test locally first with pipes-deploy-clickhouse-local
   - Verify data quality before Railway deployment

## Deployment Workflow

### Phase 1: Pre-Deployment Validation (MANDATORY)

**CRITICAL**: Based on lessons learned from production deployments, these validation steps are NON-NEGOTIABLE.

#### Step 1.1: Schema Validation (ClickHouse Cloud Compatibility)

```bash
echo " Phase 1: Pre-Deployment Validation"
echo "======================================"
echo ""
echo "Step 1.1: Schema Validation"

cd $PROJECT_PATH

# Check for ReplacingMergeTree (incompatible with ClickHouse Cloud)
if grep -r "ReplacingMergeTree" migrations/ > /dev/null 2>&1; then
  echo "BLOCKING ERROR: Found ReplacingMergeTree in schema"
  echo ""
  echo "ClickHouse Cloud converts ReplacingMergeTree → SharedMergeTree"
  echo "SharedMergeTree doesn't support FINAL keyword"
  echo "Subsquid automatically adds FINAL, causing crash"
  echo ""
  echo "Required Fix:"
  echo "  1. Change all ReplacingMergeTree to MergeTree"
  echo "  2. Remove updated_at deduplication parameter"
  exit 1
fi

echo "Schema compatible with ClickHouse Cloud (no ReplacingMergeTree)"
```

#### Step 1.2: Local Test (30 seconds)

```bash
echo ""
echo "Step 1.2: Local Indexer Test"

# Test indexer locally for 30 seconds
echo "Testing indexer locally for 30 seconds..."
timeout 30 bun run dev > /tmp/indexer-test.log 2>&1 &
TEST_PID=$!

sleep 30
kill $TEST_PID 2>/dev/null || true

# Check for errors (timeout exit code 124 is success)
if grep -qi "error\|failed\|crash" /tmp/indexer-test.log; then
  echo "BLOCKING ERROR: Indexer crashed during local test"
  echo ""
  echo "Errors found:"
  grep -i "error\|failed\|crash" /tmp/indexer-test.log | head -10
  exit 1
fi

echo "Local indexer test passed (no crashes in 30 seconds)"
```

#### Step 1.3: ClickHouse Connection Test

```bash
echo ""
echo "Step 1.3: ClickHouse Cloud Connection"

# Test connection
HTTP_CODE=$(curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1" \
  --max-time 10 \
  -s -o /dev/null -w "%{http_code}")

if [ "$HTTP_CODE" != "200" ]; then
  echo "BLOCKING ERROR: Cannot connect to ClickHouse Cloud (HTTP $HTTP_CODE)"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check CLICKHOUSE_URL is correct"
  echo "  2. Check CLICKHOUSE_PASSWORD is correct"
  echo "  3. Verify ClickHouse service is running"
  echo "  4. Check IP allowlist (should include 0.0.0.0/0 for Railway)"
  exit 1
fi

echo "ClickHouse Cloud connection verified"
```

#### Step 1.4: Dockerfile Check (Railway Auto-Detection)

```bash
echo ""
echo "Step 1.4: Dockerfile Validation"

# Remove Dockerfile if exists (Railway auto-detect is better)
if [ -f "Dockerfile" ]; then
  echo "Found Dockerfile"
  echo ""
  echo "Railway's Nixpacks auto-detection usually works better"
  echo "Recommendation: Remove Dockerfile and use auto-detection"

  mv Dockerfile Dockerfile.backup
  echo "Dockerfile backed up to Dockerfile.backup"
  echo "Railway will use auto-detection"
fi

echo ""
echo "Pre-deployment validation complete"
```

### Phase 2: Railway Deployment

#### Step 2.1: Verify Railway Authentication

```bash
echo ""
echo " Phase 2: Railway Deployment"
echo "=============================="
echo ""
echo "Step 2.1: Railway Authentication"

# Check if already authenticated
if ! railway whoami > /dev/null 2>&1; then
  echo "Not authenticated to Railway"
  echo ""
  echo "Options:"
  echo "1. Run: railway login (opens browser)"
  echo "2. Set token: export RAILWAY_API_TOKEN=xxx"
  exit 1
fi

echo "Railway authentication verified"
```

#### Step 2.2: Create/Link Project

```bash
echo ""
echo "Step 2.2: Railway Project"

# Check if already linked
if railway status > /dev/null 2>&1; then
  echo "Already linked to Railway project"
  railway status
else
  echo "Creating new Railway project..."
  railway init --name "$PROJECT_NAME"
  echo "Railway project created and linked"
fi
```

#### Step 2.3: Set Environment Variables

```bash
echo ""
echo "Step 2.3: Environment Variables"

# Set all variables at once
railway variables set \
  CLICKHOUSE_URL="$CLICKHOUSE_URL" \
  CLICKHOUSE_DATABASE="$CLICKHOUSE_DATABASE" \
  CLICKHOUSE_USER="$CLICKHOUSE_USER" \
  CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  METRICS_PORT=9090 \
  METRICS_ENABLED=true

echo "Environment variables set"

# Verify
railway variables | grep CLICKHOUSE
```

#### Step 2.4: Deploy

```bash
echo ""
echo "Step 2.4: Deploy to Railway"
echo ""
echo "Deploying..."

railway up

if [ $? -ne 0 ]; then
  echo "Deployment failed"
  echo "Check logs: railway logs"
  exit 1
fi

echo "Deployment initiated"
```

#### Step 2.5: Wait for Startup

```bash
echo ""
echo "Step 2.5: Waiting for Service Startup"

echo "⏳ Waiting 30 seconds for container to start..."
sleep 30

echo "Startup wait complete"
```

### Phase 3: Post-Deployment Verification

#### Step 3.1: Check Logs for Startup

```bash
echo ""
echo " Phase 3: Post-Deployment Verification"
echo "========================================="
echo ""
echo "Step 3.1: Checking Deployment Logs"

railway logs > /tmp/railway-logs.txt 2>&1

echo ""
echo "Recent logs:"
tail -30 /tmp/railway-logs.txt

# Look for success indicators
if grep -q "Start indexing from" /tmp/railway-logs.txt; then
  START_BLOCK=$(grep "Start indexing from" /tmp/railway-logs.txt | tail -1 | grep -oE '[0-9,]+' | tr -d ',')
  echo "Indexer started from block $START_BLOCK"
else
  echo "No startup message found yet"
fi

# Look for error indicators
if grep -qi "Storage SharedMergeTree doesn't support FINAL" /tmp/railway-logs.txt; then
  echo ""
  echo "CRITICAL ERROR: FINAL keyword error detected"
  echo "This means schema still has ReplacingMergeTree tables"
  exit 1
fi
```

#### Step 3.2: Wait for Initial Data

```bash
echo ""
echo "Step 3.2: Waiting for Initial Data Sync"

echo "⏳ Waiting 2 minutes for indexer to process first batch..."
sleep 120

echo "Wait complete"
```

#### Step 3.3: Verify Data in ClickHouse

```bash
echo ""
echo "Step 3.3: Verifying Data in ClickHouse"

# Get first table name from migrations
FIRST_TABLE=$(grep "CREATE TABLE" migrations/*.sql | head -1 | awk '{print $3}' | sed 's/.*\.//')

echo "Checking table: $FIRST_TABLE"

ROW_COUNT=$(curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT COUNT(*) FROM $CLICKHOUSE_DATABASE.$FIRST_TABLE" \
  -s 2>/dev/null)

if [ "$ROW_COUNT" -gt 0 ]; then
  echo "Data flowing: $ROW_COUNT events indexed"

  LATEST_BLOCK=$(curl -X POST "$CLICKHOUSE_URL/" \
    --user "default:$CLICKHOUSE_PASSWORD" \
    -d "SELECT MAX(block_number) FROM $CLICKHOUSE_DATABASE.$FIRST_TABLE" \
    -s 2>/dev/null)

  echo " Latest block: $LATEST_BLOCK"
else
  echo "No data yet - check logs for errors"
fi
```

#### Step 3.4: Monitor Sync Progress

```bash
echo ""
echo "Step 3.4: Monitoring Sync Progress"
echo ""
echo "Checking progress every 30 seconds (5 checks)..."

for i in {1..5}; do
  echo ""
  echo "Check $i/5:"
  railway logs | grep "blocks/second" | tail -1

  if [ $i -lt 5 ]; then
    sleep 30
  fi
done

echo ""
echo "Deployment verification complete"
```

## Success Criteria

Deployment successful when:

- Railway authentication working
- Project deployed without errors
- Service running (no crash loop)
- ClickHouse connection established
- Data appears within 2-3 minutes
- Logs show sync progress

## Output Format

After successful deployment:

```markdown
# Railway Deployment Summary

## Service Details
- **Status**: Running
- **URL**: [Railway service URL]
- **Region**: [Railway region]
- **Plan**: [Free/Hobby/Pro]

## ClickHouse Connection
- **Type**: Cloud
- **URL**: $CLICKHOUSE_URL
- **Database**: $CLICKHOUSE_DATABASE
- **Status**: Connected

## Indexer Status
- **Project**: $PROJECT_PATH
- **Start Block**: $START_BLOCK
- **Events Indexed**: [count]
- **Latest Block**: [block number]
- **Status**: Syncing

## Management

### View Logs
```bash
railway logs
```

### Check Status
```bash
railway status
```

### Open Dashboard
```bash
railway open
```

### Query Data (ClickHouse Cloud)
```bash
# Using MCP (restart Claude Code)
mcp__clickhouse__run_select_query("SELECT COUNT(*) FROM $CLICKHOUSE_DATABASE.swaps")

# Using curl
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT * FROM $CLICKHOUSE_DATABASE.swaps LIMIT 10"
```

## Next Steps

1. Monitor logs for 5-10 minutes
2. Verify data quality in ClickHouse
3. Set up monitoring dashboard
4. Configure alerts (optional)
```

## Troubleshooting

### Authentication Failed

**Error**: "Not logged in to Railway"

**Solutions**:
```bash
# Option 1: Set project token
export RAILWAY_TOKEN=your-token-here

# Option 2: Set API token
export RAILWAY_API_TOKEN=your-token-here

# Option 3: Interactive login
railway login  # Opens browser
```

### ClickHouse Connection Failed

**Error**: "Cannot connect to ClickHouse"

**Investigation**:
```bash
# Test connection manually
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1" \
  --max-time 10

# Common issues:
# - Wrong password
# - Service URL incorrect
# - Cloud service not running
# - Firewall/IP restrictions
```

### Build Failed on Railway

**Error**: Build errors in Railway logs

**Investigation**:
```bash
# Check build logs
railway logs --build

# Common issues:
# - Missing dependencies
# - Dockerfile errors
# - Memory exceeded during build
# - Wrong Node.js version
```

## Best Practices

### 1. Always Test Locally First

```bash
# DON'T: Deploy directly to Railway
# DO: Test locally, then Railway
```

### 2. Use ClickHouse Cloud for Production

```bash
# DON'T: Use local ClickHouse with Railway
CLICKHOUSE_URL=http://localhost:8123  # Not accessible

# DO: Use ClickHouse Cloud
CLICKHOUSE_URL=https://xxx.clickhouse.cloud:8443  # Accessible
```

### 3. Start from Recent Blocks for Testing

```bash
# DON'T: Start from deployment block immediately
range: { from: '12345678' }  # Full history, slow

# DO: Test with recent blocks first
range: { from: '20000000' }  # Recent blocks, fast test
```

### 4. Monitor Costs

Railway and ClickHouse Cloud are paid services:
- Start with free/development tiers
- Monitor usage dashboards
- Set up billing alerts
- Optimize after testing

## Related Skills

- [pipes-deploy-clickhouse-cloud](../pipes-deploy-clickhouse-cloud/SKILL.md) - Cloud ClickHouse setup
- [pipes-deploy-clickhouse-local](../pipes-deploy-clickhouse-local/SKILL.md) - Local testing
- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexers
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors
