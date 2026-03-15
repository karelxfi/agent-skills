---
name: pipes-deploy
description: Deploys blockchain indexers to ClickHouse — either local Docker for development or ClickHouse Cloud for production — with full validation and data verification.
allowed-tools: [Read, Write, Edit, Bash, WebFetch]
metadata:
  author: subsquid
  version: "1.0.0"
  category: deployment
---

# Pipes: Deploy

Deploy Subsquid Pipes indexers to ClickHouse — locally via Docker for development and testing, or to ClickHouse Cloud for production.

## When to Use This Skill

Activate when:
- User wants to run an indexer locally (Docker, development, testing)
- User wants to deploy to ClickHouse Cloud (production, staging)
- User mentions "deploy", "run locally", "docker", "ClickHouse Cloud", or "production deployment"

---

## Local Docker Deployment

For development and testing. Uses a local ClickHouse container.

### Quick Start

```bash
# Check for existing ClickHouse container
docker ps | grep clickhouse

# If none exists, create one:
docker run -d \
  --name clickhouse \
  -p 8123:8123 \
  -p 9000:9000 \
  -v clickhouse-data:/var/lib/clickhouse \
  -e CLICKHOUSE_PASSWORD=default \
  -e CLICKHOUSE_USER=default \
  clickhouse/clickhouse-server:latest
```

### Setup Steps

**Step 1: Detect or create container**

```bash
EXISTING=$(docker ps --filter "name=clickhouse" --format "{{.Names}}" | head -n 1)

if [ -z "$EXISTING" ]; then
  docker run -d \
    --name clickhouse \
    -p 8123:8123 -p 9000:9000 \
    -e CLICKHOUSE_PASSWORD=default \
    -e CLICKHOUSE_USER=default \
    clickhouse/clickhouse-server:latest
  CONTAINER_NAME="clickhouse"
  CLICKHOUSE_PASSWORD="default"
else
  CONTAINER_NAME=$EXISTING
  CLICKHOUSE_PASSWORD=$(docker inspect $CONTAINER_NAME | \
    grep -A 10 "Env" | grep CLICKHOUSE_PASSWORD | \
    cut -d'=' -f2 | tr -d '",')
  CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD:-default}
fi
```

**Step 2: Verify container health**

```bash
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "SELECT 1"
# Expected output: 1
```

**Step 3: Create database**

```bash
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME"
```

**Step 4: Clear sync table** (only if reusing a database from a previous indexer)

```bash
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "DROP TABLE IF EXISTS $DATABASE_NAME.sync"
```

**Step 5: Configure `.env`**

```env
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=<database-name>
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<password>
```

**Step 6: Start indexer**

```bash
cd $PROJECT_PATH
bun run dev 2>&1 | tee indexer.log &
INDEXER_PID=$!
```

Check the first log line:
- `"Start indexing from [start-block]"` — correct
- `"Resuming from [different-block]"` — wrong, clear sync table (Step 4) and restart

### Local Validation (30-Second Check)

```bash
sleep 30

ROW_COUNT=$(docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --database "$DATABASE_NAME" \
  --query "SELECT COUNT(*) FROM $MAIN_TABLE")

echo "Rows: $ROW_COUNT"
# Expected: > 0
```

Sample data:

```bash
docker exec $CONTAINER_NAME clickhouse-client \
  --password "$CLICKHOUSE_PASSWORD" \
  --database "$DATABASE_NAME" \
  --query "SELECT * FROM $MAIN_TABLE LIMIT 3 FORMAT Vertical"
```

### MCP Setup (Local)

```bash
claude mcp add -t stdio \
  -e CLICKHOUSE_HOST=localhost \
  -e CLICKHOUSE_PORT=8123 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  -e CLICKHOUSE_SECURE=false \
  -e CLICKHOUSE_DATABASE="$DATABASE_NAME" \
  -- clickhouse /path/to/.local/bin/mcp-clickhouse
```

### Local Deployment Summary Template

```markdown
## ClickHouse Container
- Container: $CONTAINER_NAME (ports 8123/9000)
- Database: $DATABASE_NAME

## Indexer Status
- Start Block: $START_BLOCK
- Current Block: [latest-block]
- Events Indexed: [count]
- PID: $INDEXER_PID

## Commands
tail -f $PROJECT_PATH/indexer.log
docker exec $CONTAINER_NAME clickhouse-client --password "$CLICKHOUSE_PASSWORD" \
  --database "$DATABASE_NAME" \
  --query "SELECT COUNT(*) as events, MAX(block_number) as block FROM $MAIN_TABLE"
kill $INDEXER_PID
```

---

## ClickHouse Cloud Deployment

For production deployments using [ClickHouse Cloud](https://clickhouse.cloud/).

### Required Information

```
SERVICE_URL:   https://[service-id].[region].aws.clickhouse.cloud:8443
DATABASE_NAME: [e.g., "pipes"]
USERNAME:      default
PASSWORD:      [actual cloud password — NOT "default"]
```

If the user doesn't have a Cloud service yet, direct them to https://clickhouse.cloud/.

### Setup Steps

**Step 1: Validate connection (MANDATORY)**

```bash
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT 1" \
  --max-time 10
# Expected: 1
```

Common errors:
- Authentication failed → wrong password
- Connection timeout → check service status / firewall
- SSL error → verify HTTPS URL with port 8443

**Step 2: Create database**

```bash
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "CREATE DATABASE IF NOT EXISTS [database-name]"
```

**Step 3: Configure `.env`**

```env
CLICKHOUSE_URL=https://[service-id].[region].aws.clickhouse.cloud:8443
CLICKHOUSE_DATABASE=<database-name>
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<actual-cloud-password>
```

**Step 4: Clear sync table** (only if reusing a database from a previous indexer)

```bash
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "DROP TABLE IF EXISTS [database-name].sync"
```

**Step 5: Start indexer**

```bash
cd [project-path]
bun run dev
```

Check the first log line — same rule as local: `"Start indexing from X"` is correct, `"Resuming from X"` means sync table conflict.

### Cloud Validation (30-Second Check)

```bash
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT COUNT(*) FROM [database-name].[main-table]"
# Expected: > 0
```

Sample data:

```bash
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT * FROM [database-name].[main-table] LIMIT 5 FORMAT Vertical"
```

Sync progress:

```bash
curl -X POST "https://[service-id].[region].aws.clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "
SELECT
    COUNT(*) as total_events,
    MIN(block_number) as first_block,
    MAX(block_number) as latest_block,
    MAX(block_timestamp) as latest_time
FROM [database-name].[main-table]
FORMAT Vertical"
```

### MCP Setup (Cloud)

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

### Deploying the Indexer Application (Cloud Options)

ClickHouse Cloud is the database. The indexer process itself can run anywhere:

| Option | Best for |
|--------|----------|
| Local machine | Development / testing |
| Railway | Simple platform deployment |
| AWS / GCP / Azure | Full control, production scale |
| Docker / Kubernetes | Containerized workloads |

**Railway quick reference:**

```bash
npm i -g @railway/cli
railway login && railway init
railway variables set \
  CLICKHOUSE_URL="$CLICKHOUSE_URL" \
  CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD"
railway up
```

### Cloud Deployment Summary Template

```markdown
## Service Details
- URL: https://[service-id].[region].aws.clickhouse.cloud:8443
- Database: [database-name]

## Indexer Status
- Start Block: [block-number]
- Current Block: [latest-block]
- Events Indexed: [count]

## Quick Queries
SELECT COUNT(*) as total_events, MAX(block_number) as latest_block
FROM [database-name].[main-table];
```

---

## Common Issues & Troubleshooting

### Authentication Failed

**Error**: `Code: 516. DB::Exception: Authentication failed` or `password is incorrect`

**Fix**:
- Local: `docker inspect $CONTAINER_NAME | grep CLICKHOUSE_PASSWORD`
- Cloud: Verify password in ClickHouse Cloud console
- Update `.env` with the correct password

### Container Port Conflict (Local only)

**Error**: `port is already allocated`

**Fix**:
```bash
lsof -i :8123          # find conflict
docker stop clickhouse && docker rm clickhouse
# then re-run Step 1
```

### Database Doesn't Exist

**Error**: `Database [name] does not exist`

**Fix**: Run the Create Database step (Step 3 for local, Step 2 for cloud)

### Wrong Start Block ("Resuming from X")

**Cause**: Leftover `sync` table in the database from a previous indexer run.

**Fix**:
1. Stop indexer
2. Drop sync table (Step 4 in either workflow)
3. Restart indexer
4. Verify first log line shows correct start block

### Zero Data After 30 Seconds

**Investigation**:
```bash
# Local
tail -50 indexer.log | grep -i error

# Cloud — check logs
# Then verify:
```
1. Contract address is correct
2. Start block is before contract deployment
3. Event names match the ABI exactly
4. Contract is not a proxy (may need implementation ABI)

### Validate Table Names Before Running

If you suspect schema/code mismatches:

```bash
# Extract schema table names
grep "CREATE TABLE" migrations/*.sql | \
  awk '{print $3}' | sed 's/.*\.//' | sort > /tmp/schema_tables.txt

# Extract code table references
grep -rh "INSERT INTO\|FROM \|DELETE FROM" src/ | \
  grep -oE "(FROM|INTO) [a-z_.]+" | awk '{print $2}' | \
  sed 's/.*\.//' | sort -u > /tmp/code_tables.txt

diff /tmp/schema_tables.txt /tmp/code_tables.txt
# Empty output = no mismatches
```

---

## Best Practices

- **Use dedicated databases per indexer** (`uniswap_base`, `morpho_ethereum`) to avoid sync table conflicts
- **Local**: Use named containers (`clickhouse-dev`, `clickhouse-test`) and add `-v clickhouse-data:/var/lib/clickhouse` for data persistence
- **Cloud**: Store passwords in a password manager; use environment variables, not hardcoded values
- **Cloud cost**: Start with recent blocks for testing; monitor storage in the Cloud console

---

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create indexers
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize performance

## Official Subsquid Documentation

- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick deployment reference
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Deployment guide
- **[Available Datasets](https://portal.sqd.dev/datasets)** - Network endpoints
