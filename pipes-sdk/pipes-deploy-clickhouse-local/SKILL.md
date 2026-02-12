---
name: pipes-deploy-clickhouse-local
description: Deploys blockchain indexers to local ClickHouse (Docker) with validation and MCP setup for testing and development.
allowed-tools: [Read, Write, Edit, Bash]
metadata:
  author: subsquid
  version: "1.0.0"
  category: deployment
---

# Pipes: ClickHouse Local Deployer

Specialized agent for deploying Subsquid Pipes indexers to local ClickHouse instances running in Docker.

## When to Use This Skill

Activate when:
- User wants to test indexer locally before production
- User needs local development environment
- User mentions "test locally", "docker", or "local ClickHouse"

## Your Role

Deploy indexers to local ClickHouse by:
1. Setting up/validating Docker ClickHouse container
2. Creating databases
3. Configuring indexer for local deployment
4. Running migrations and starting sync
5. Verifying data flow
6. Setting up MCP for queries

## Pre-Deployment Checklist

### Required Information

```bash
# Docker Container Details
CONTAINER_NAME: [e.g., "clickhouse" or auto-detect]
CLICKHOUSE_PASSWORD: [from container or "default" for new]
DATABASE_NAME: [e.g., "pipes"]

# Indexer Details
PROJECT_PATH: [path to indexer project]
START_BLOCK: [block number to start from]
```

### Validation Questions

1. **Do you have Docker installed and running?**
   - Check: `docker ps`
   - If not: Install Docker Desktop

2. **Do you have an existing ClickHouse container?**
   - Check: `docker ps | grep clickhouse`
   - If yes: Reuse it
   - If no: Create new one

3. **What database name should we use?**
   - Default: "pipes"
   - Dedicated per indexer: Recommended for clarity

## Deployment Workflow

### Step 1: Check/Setup ClickHouse Container

```bash
# Check for existing ClickHouse
EXISTING_CONTAINER=$(docker ps --filter "name=clickhouse" --format "{{.Names}}" | head -n 1)

if [ -z "$EXISTING_CONTAINER" ]; then
  echo "No ClickHouse found, creating new container..."

  # Create new container
  docker run -d \
    --name clickhouse \
    -p 8123:8123 \
    -p 9000:9000 \
    -e CLICKHOUSE_PASSWORD=default \
    -e CLICKHOUSE_USER=default \
    clickhouse/clickhouse-server:latest

  CONTAINER_NAME="clickhouse"
  CLICKHOUSE_PASSWORD="default"

  # Wait for container to be ready
  sleep 5

else
  echo "Using existing container: $EXISTING_CONTAINER"
  CONTAINER_NAME=$EXISTING_CONTAINER

  # Get password from container
  CLICKHOUSE_PASSWORD=$(docker inspect $CONTAINER_NAME | \
    grep -A 10 "Env" | grep CLICKHOUSE_PASSWORD | \
    cut -d'=' -f2 | tr -d '",')

  # If no password found, assume "default"
  if [ -z "$CLICKHOUSE_PASSWORD" ]; then
    CLICKHOUSE_PASSWORD="default"
  fi
fi

echo "Container: $CONTAINER_NAME"
echo "Password: $CLICKHOUSE_PASSWORD"
```

### Step 2: Verify Container Health

```bash
# Test connection
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "SELECT 1"

# Expected output: 1
# If error: Container may not be ready, wait and retry
```

### Step 3: Create Database

```bash
# Create database
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME"

# Verify database exists
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "SHOW DATABASES" | grep $DATABASE_NAME
```

### Step 4: Clear Sync Table (If Reusing Database)

```bash
# If deploying new indexer to existing database
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "DROP TABLE IF EXISTS $DATABASE_NAME.sync"

echo "Sync table cleared - indexer will start from configured block"
```

### Step 5: Configure Indexer

Update `.env` file in project:

```bash
cd $PROJECT_PATH

# Update .env with local configuration
cat > .env << EOF
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=$DATABASE_NAME
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
EOF

echo ".env configured for local deployment"
```

### Step 6: Validate Table Names

```bash
cd $PROJECT_PATH

# Extract schema table names
grep "CREATE TABLE" migrations/*.sql | \
  awk '{print $3}' | sed 's/.*\.//' | sort > /tmp/schema_tables.txt

# Extract code table references
grep -rh "INSERT INTO\|FROM \|DELETE FROM" src/ | \
  grep -oE "(FROM|INTO) [a-z_.]+" | awk '{print $2}' | \
  sed 's/.*\.//' | sort -u > /tmp/code_tables.txt

# Compare
DIFF_OUTPUT=$(diff /tmp/schema_tables.txt /tmp/code_tables.txt)

if [ -n "$DIFF_OUTPUT" ]; then
  echo "Table name mismatches found:"
  echo "$DIFF_OUTPUT"
  exit 1
else
  echo "Table names validated"
fi
```

### Step 7: Start Indexer

```bash
cd $PROJECT_PATH

# Start in background
bun run dev 2>&1 | tee indexer.log &
INDEXER_PID=$!

echo "Indexer started (PID: $INDEXER_PID)"
echo "Logs: tail -f $PROJECT_PATH/indexer.log"
```

**CRITICAL**: Check first log line for start block:
```bash
# Watch logs
tail -f indexer.log | grep -m 1 "indexing from"

# Expected: "Start indexing from [your-start-block]"
# Wrong: "Resuming from [different-block]"
```

If wrong block:
1. Kill indexer: `kill $INDEXER_PID`
2. Clear sync table (Step 4)
3. Restart (Step 7)

### Step 8: Verify Data Flow (30-Second Check)

```bash
# Wait 30 seconds
sleep 30

# Check row count
ROW_COUNT=$(docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --database "$DATABASE_NAME" \
  --query "SELECT COUNT(*) FROM $MAIN_TABLE")

if [ "$ROW_COUNT" -gt 0 ]; then
  echo "Data flowing: $ROW_COUNT events indexed"
else
  echo "No data yet - checking logs..."
  tail -20 indexer.log | grep -i error
fi
```

### Step 9: Sample Data Quality

```bash
# Get sample data
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --database "$DATABASE_NAME" \
  --query "SELECT * FROM $MAIN_TABLE LIMIT 3 FORMAT Vertical"

# Validate:
# - Addresses are valid (0x... format)
# - Amounts are reasonable
# - Timestamps are correct
# - All fields populated
```

### Step 10: Setup MCP Access

```bash
# Configure MCP for local ClickHouse
claude mcp add -t stdio \
  -e CLICKHOUSE_HOST=localhost \
  -e CLICKHOUSE_PORT=8123 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  -e CLICKHOUSE_SECURE=false \
  -e CLICKHOUSE_DATABASE="$DATABASE_NAME" \
  -- clickhouse /path/to/.local/bin/mcp-clickhouse

echo "MCP configured - restart Claude Code to use"
```

## Success Criteria

Deployment successful when:

- Docker container running
- Database created
- Indexer starts from correct block
- Data appears within 30 seconds
- Data quality looks good
- MCP configured for queries

## Output Format

After successful deployment:

```markdown
# Local Deployment Summary

## ClickHouse Container
- **Container**: $CONTAINER_NAME
- **Status**: Running
- **Ports**: 8123 (HTTP), 9000 (Native)
- **Password**: $CLICKHOUSE_PASSWORD

## Database
- **Name**: $DATABASE_NAME
- **Tables**: [list of tables created]

## Indexer Status
- **Project**: $PROJECT_PATH
- **Start Block**: $START_BLOCK
- **Current Block**: [latest-block]
- **Events Indexed**: [count]
- **Status**: Syncing
- **PID**: $INDEXER_PID

## Quick Commands

### Check Sync Status
```bash
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --database "$DATABASE_NAME" \
  --query "SELECT COUNT(*) as events, MAX(block_number) as latest_block FROM $MAIN_TABLE"
```

### View Logs
```bash
tail -f $PROJECT_PATH/indexer.log
```

### Stop Indexer
```bash
kill $INDEXER_PID
```

### Query Data (MCP)
```bash
# Restart Claude Code, then:
mcp__clickhouse__run_select_query("SELECT * FROM $DATABASE_NAME.$MAIN_TABLE LIMIT 10")
```

## Monitoring

### Monitor Sync Progress
```bash
watch -n 5 "docker exec $CONTAINER_NAME clickhouse-client \
  --password '$CLICKHOUSE_PASSWORD' \
  --database '$DATABASE_NAME' \
  --query 'SELECT COUNT(*) as events, MAX(block_number) as block FROM $MAIN_TABLE'"
```

### Check Performance
```bash
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "
SELECT
  table,
  formatReadableSize(sum(bytes)) as size,
  formatReadableQuantity(sum(rows)) as rows
FROM system.parts
WHERE database = '$DATABASE_NAME' AND active
GROUP BY table
"
```
```

## Troubleshooting

### Container Won't Start

**Error**: `docker: Error response from daemon: port is already allocated`

**Solution**: Use existing container or stop the conflicting one:
```bash
# Find conflicting process
lsof -i :8123

# Stop existing ClickHouse container
docker stop clickhouse
docker rm clickhouse

# Start new container
[Step 1]
```

### Authentication Failed

**Error**: `Authentication failed: password is incorrect`

**Solution**: Get correct password from container:
```bash
docker inspect $CONTAINER_NAME | grep CLICKHOUSE_PASSWORD

# Update .env with correct password
```

### Database Doesn't Exist

**Error**: `Database $DATABASE_NAME does not exist`

**Solution**: Run Step 3 (Create Database)

### Wrong Start Block

**Error**: Indexer says "Resuming from X" instead of your start block

**Solution**: Run Step 4 (Clear Sync Table)

### Zero Data After 30 Seconds

**Error**: COUNT(*) returns 0

**Investigation**:
```bash
# Check logs for errors
tail -50 indexer.log | grep -i error

# Verify container is running
docker ps | grep clickhouse

# Test database connection
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "SELECT 1"
```

## Best Practices

### 1. Use Dedicated Databases

```bash
# Instead of sharing "pipes" database:
DATABASE_NAME="uniswap_base"      # For Uniswap Base indexer
DATABASE_NAME="morpho_ethereum"   # For Morpho Ethereum indexer

# Benefits:
# - No sync table conflicts
# - Easier to drop/recreate
# - Clear data organization
```

### 2. Named Containers

```bash
# Use descriptive container names:
docker run -d --name clickhouse-indexers ...
docker run -d --name clickhouse-dev ...
docker run -d --name clickhouse-test ...
```

### 3. Volume Persistence

```bash
# Add volume for data persistence:
docker run -d \
  --name clickhouse \
  -p 8123:8123 \
  -p 9000:9000 \
  -v clickhouse-data:/var/lib/clickhouse \
  -e CLICKHOUSE_PASSWORD=default \
  clickhouse/clickhouse-server:latest
```

### 4. Resource Limits

```bash
# For resource-intensive indexers:
docker run -d \
  --name clickhouse \
  --memory=4g \
  --cpus=2 \
  -p 8123:8123 \
  -e CLICKHOUSE_PASSWORD=default \
  clickhouse/clickhouse-server:latest
```

## Related Skills

- [pipes-deploy-clickhouse-cloud](../pipes-deploy-clickhouse-cloud/SKILL.md) - Cloud deployment
- [DEPLOYMENT_OPTIONS.md](../pipes-deployment/references/DEPLOYMENT_OPTIONS.md) - Railway and other deployment options
- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexers
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors

## Official Subsquid Documentation

- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick local deployment reference
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Docker and local development guide
