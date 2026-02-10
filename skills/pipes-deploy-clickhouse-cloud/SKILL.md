---
name: pipes-deploy-clickhouse-cloud
description: Deploys blockchain indexers to ClickHouse Cloud with full validation, monitoring, and data verification.
allowed-tools: [Read, Write, Edit, Bash, WebFetch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: deployment
---

# Pipes: ClickHouse Cloud Deployer

Specialized agent for deploying Subsquid Pipes indexers to ClickHouse Cloud services.

## When to Use This Skill

Activate when:
- User wants to deploy indexer to ClickHouse Cloud
- User has a Cloud service and needs deployment help
- User mentions "deploy to cloud", "production deployment", or "ClickHouse Cloud"

## Your Role

Deploy indexers to ClickHouse Cloud by:
1. Validating Cloud service configuration
2. Creating databases and setting up permissions
3. Configuring indexer for Cloud deployment
4. Running migrations and starting sync
5. Verifying data is flowing correctly
6. Creating monitoring queries

## Pre-Deployment Checklist

Before starting deployment, gather this information:

### Required Information
```bash
# ClickHouse Cloud Service Details
SERVICE_NAME: [e.g., "pipes-sdk-test"]
SERVICE_URL: https://[service-id].[region].aws.clickhouse.cloud:8443
DATABASE_NAME: [e.g., "pipes"]
USERNAME: default
PASSWORD: [actual-cloud-password]
REGION: [e.g., "eu-west-1"]

# Indexer Details
PROJECT_PATH: [path to indexer project]
START_BLOCK: [block number to start from]
CONTRACTS: [addresses to index]
```

### Validation Questions

Ask the user these questions if not already known:

1. **Do you have a ClickHouse Cloud service set up?**
   - If no: Guide them to create one at https://clickhouse.cloud/
   - If yes: Get service details

2. **What's your ClickHouse Cloud password?**
   - Critical: Need actual password, not "default"
   - Test connection before proceeding

3. **What database name should we use?**
   - Default: "pipes"
   - Can use custom name for isolation

4. **Is this a fresh deployment or updating existing?**
   - Fresh: Create new tables
   - Updating: Check for sync table conflicts

## Deployment Workflow

### Step 1: Validate Cloud Service (MANDATORY)

```bash
# Test connection to ClickHouse Cloud
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT 1" \
  --max-time 10

# Expected: 1
# If error: STOP and fix connection issues
```

**Common errors**:
- Authentication failed → Wrong password
- Connection timeout → Check service status / firewall
- SSL error → Verify HTTPS URL with port 8443

### Step 2: Create Database

```bash
# Create database (migrations don't do this)
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "CREATE DATABASE IF NOT EXISTS [database-name]"

# Verify database exists
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SHOW DATABASES" | grep [database-name]
```

### Step 3: Configure Indexer for Cloud

Update the `.env` file with Cloud credentials:

```env
CLICKHOUSE_URL=https://[service-id].[region].aws.clickhouse.cloud:8443
CLICKHOUSE_DATABASE=[database-name]
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=[actual-cloud-password]
```

**Critical**: Use actual Cloud password, not "default" or "password".

### Step 4: Clear Sync Table (If Reusing Database)

If this database was used by another indexer:

```bash
# Drop sync table to prevent resuming from wrong block
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "DROP TABLE IF EXISTS [database-name].sync"
```

### Step 5: Validate Table Names

Check that code table references match migration schema:

```bash
# Extract schema table names
grep "CREATE TABLE" [project-path]/migrations/*.sql | \
  awk '{print $3}' | sed 's/.*\.//' | sort > /tmp/schema_tables.txt

# Extract code table references
grep -rh "INSERT INTO\|FROM \|DELETE FROM" [project-path]/src/ | \
  grep -oE "(FROM|INTO) [a-z_.]+" | awk '{print $2}' | \
  sed 's/.*\.//' | sort -u > /tmp/code_tables.txt

# Compare
diff /tmp/schema_tables.txt /tmp/code_tables.txt

# If differences found: STOP and fix naming mismatches
```

### Step 6: Run Indexer

```bash
cd [project-path]
bun run dev
```

**CRITICAL**: Check first log line:
- "Start indexing from [start-block]" → Correct
- "Resuming from [different-block]" → Wrong, sync table collision

If wrong start block:
1. Stop indexer (Ctrl+C)
2. Drop sync table (Step 4)
3. Restart indexer

### Step 7: Verify Data is Flowing (30-Second Check)

Wait 30 seconds, then check data:

```bash
# Check row count
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT COUNT(*) as count FROM [database-name].[main-table]"

# Expected: count > 0
# If count = 0 after 30 seconds: Investigate
```

**If zero data**:
- Check indexer logs for errors
- Verify start block is correct
- Check contract addresses are valid
- Verify events are in ABI

### Step 8: Validate Data Quality

```bash
# Sample data
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT * FROM [database-name].[main-table] LIMIT 5 FORMAT Vertical"

# Check for:
# - Valid addresses (0x... format)
# - Reasonable amounts (not all zeros)
# - Correct timestamps
# - All fields populated
```

### Step 9: Monitor Sync Progress

```bash
# Get current sync status
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "
SELECT
    COUNT(*) as total_events,
    MIN(block_number) as first_block,
    MAX(block_number) as latest_block,
    MIN(block_timestamp) as first_time,
    MAX(block_timestamp) as latest_time
FROM [database-name].[main-table]
FORMAT Vertical
"
```

### Step 10: Create Monitoring Queries

Generate monitoring queries for the user:

```sql
-- queries/monitoring/sync-status.sql
SELECT
    COUNT(*) as total_events,
    MAX(block_number) as latest_block,
    MAX(block_timestamp) as latest_time,
    now() - MAX(block_timestamp) as time_behind
FROM [database-name].[main-table];

-- queries/monitoring/sync-rate.sql
SELECT
    toStartOfHour(block_timestamp) as hour,
    COUNT(*) as events_per_hour
FROM [database-name].[main-table]
WHERE block_timestamp >= now() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour DESC;
```

## Success Criteria

Deployment is successful when:

- Connection to Cloud service works
- Database created and accessible
- Indexer starts from correct block
- Data appears within 30 seconds
- Data quality looks good (no nulls, valid values)
- Sync is progressing (increasing block numbers)
- Monitoring queries return results

## Failure Scenarios & Recovery

### Scenario 1: Authentication Failed

**Error**: `Code: 516. DB::Exception: Authentication failed`

**Solution**:
1. Verify password in .env matches Cloud console
2. Test connection manually with curl
3. Update password if needed

### Scenario 2: Database Doesn't Exist

**Error**: `Code: 81. DB::Exception: Database [name] does not exist`

**Solution**:
1. Run Step 2 (Create Database)
2. Verify with SHOW DATABASES
3. Restart indexer

### Scenario 3: Wrong Start Block

**Error**: Indexer says "Resuming from X" where X is not your start block

**Solution**:
1. Stop indexer
2. Drop sync table (Step 4)
3. Verify sync table is gone
4. Restart indexer
5. Verify first log shows correct start block

### Scenario 4: Zero Data After 30 Seconds

**Error**: COUNT(*) returns 0 after 30+ seconds

**Investigation**:
1. Check indexer logs for errors
2. Verify contract address is correct
3. Check start block is before contract deployment
4. Verify events are in ABI
5. Check if contract is a proxy (need implementation ABI)

## Post-Deployment Tasks

### 1. Create Analytics Queries

Generate common analytics queries:
- Protocol overview (total volume, events, entities)
- Time series (daily/hourly metrics)
- Rankings (top pools, tokens, users)
- Recent activity (latest events, large events)

### 2. Set Up Monitoring

Create monitoring dashboard:
- Sync status (current block, time behind)
- Sync rate (blocks/events per hour)
- Data quality (null checks, validation)
- Error tracking (failed events, retries)

### 3. Document Deployment

Create deployment document:
- Service details (URL, region, database)
- Start block and reason
- Contracts being indexed
- Expected data volume
- Monitoring links

### 4. Configure MCP (Optional)

Set up MCP for easy queries:

```bash
claude mcp add -t stdio \
  -e CLICKHOUSE_HOST=[service-id].[region].aws.clickhouse.cloud \
  -e CLICKHOUSE_PORT=8443 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=[password] \
  -e CLICKHOUSE_SECURE=true \
  -e CLICKHOUSE_DATABASE=[database-name] \
  -- clickhouse-cloud /path/to/.local/bin/mcp-clickhouse
```

## Output Format

After successful deployment, provide this summary:

```markdown
# Deployment Summary

## Service Details
- **Service Name**: [name]
- **URL**: https://[service-id].[region].aws.clickhouse.cloud:8443
- **Database**: [database-name]
- **Region**: [region]

## Indexer Status
- **Project**: [project-name]
- **Start Block**: [block-number]
- **Current Block**: [latest-block]
- **Events Indexed**: [count]
- **Status**: Syncing

## Quick Queries

### Check Sync Status
```sql
SELECT
    COUNT(*) as total_events,
    MAX(block_number) as latest_block,
    MAX(block_timestamp) as latest_time
FROM [database-name].[main-table];
```

### View Recent Activity
```sql
SELECT *
FROM [database-name].[main-table]
ORDER BY block_timestamp DESC
LIMIT 10;
```

## Next Steps
1. Monitor sync progress (see queries/monitoring/)
2. Create dashboards (see DASHBOARD_SETUP.md)
3. Set up alerts for sync failures
4. Optimize queries based on usage patterns
```

## Best Practices

### 1. Database Isolation

**Per-Indexer Database** (Recommended):
```sql
CREATE DATABASE uniswap_base;
CREATE DATABASE morpho_eth;
CREATE DATABASE aave_polygon;
```

**Benefits**:
- No sync table conflicts
- Easier to manage
- Clear data ownership

### 2. Password Management

- Store Cloud password in password manager
- Use environment variables, not hardcoded
- Different passwords for dev/prod
- Rotate passwords regularly

### 3. Cost Optimization

- Start with recent blocks for testing
- Monitor storage usage in Cloud console
- Use partitioning for large tables
- Archive old data if not needed

### 4. Monitoring

- Set up alerts for sync failures
- Monitor time behind (should be < 5 minutes)
- Track data quality metrics
- Monitor Cloud service health

## Related Skills

- [pipes-deploy-clickhouse-local](../pipes-deploy-clickhouse-local/SKILL.md) - Local testing
- [pipes-deploy-railway](../pipes-deploy-railway/SKILL.md) - Railway deployment
- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexers
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors
