# Deployment Agents & Commands

**Date**: 2025-02-03
**Status**: Production Ready

---

## Overview

This document describes the specialized deployment agents and commands for deploying Subsquid Pipes indexers to different ClickHouse targets.

## Architecture

```
User Request → Slash Command → Specialized Agent → Validated Deployment
```

### Available Deployments

1. **Local Deployment** (Docker)
   - Command: `/deploy-local`
   - Agent: `clickhouse-local-deployer`
   - Target: ClickHouse in Docker container

2. **Cloud Deployment** (ClickHouse Cloud)
   - Command: `/deploy-cloud`
   - Agent: `clickhouse-cloud-deployer`
   - Target: ClickHouse Cloud service

3. **Railway Deployment** (Platform)
   - Command: `/deploy-railway`
   - Agent: `railway-deployer`
   - Target: Railway platform with ClickHouse Cloud

---

## Quick Start

### Deploy Locally (Development)

```bash
# Create indexer
/new-indexer

# Deploy to local Docker
/deploy-local my-indexer

# Result:
# - ClickHouse container running
# - Database created
# - Indexer syncing
# - MCP configured
```

### Deploy to Cloud (Production)

```bash
# Test locally first
/deploy-local my-indexer

# Deploy to Cloud when ready
/deploy-cloud my-indexer

# Result:
# - Cloud database created
# - Indexer syncing to Cloud
# - Monitoring queries generated
# - Dashboard guide provided
```

### Deploy to Railway (Production Platform)

```bash
# Test locally first
/deploy-local my-indexer

# Deploy to Railway for 24/7 operation
/deploy-railway my-indexer

# Result:
# - Railway service running 24/7
# - Containerized deployment
# - ClickHouse Cloud integration
# - Management commands provided
```

---

## Agents Deep Dive

### 1. ClickHouse Local Deployer

**File**: `.claude/agents/clickhouse-local-deployer.md`

**Purpose**: Automate local deployment to Docker ClickHouse.

**What It Does**:
1. Detects/creates ClickHouse container
2. Gets password from container
3. Creates database
4. Clears sync table (prevents conflicts)
5. Updates .env for local config
6. Validates table names
7. Starts indexer
8. Verifies data flowing
9. Configures MCP for queries
10. Provides management commands

**Key Features**:
- Automatic container detection/creation
- Password auto-discovery
- Sync table conflict prevention
- 30-second data verification
- MCP auto-configuration

**Best For**:
- Development
- Testing
- Quick iterations
- Learning

**Example Output**:
```markdown
Local Deployment Successful!

Container: clickhouse
Database: pipes
Events Indexed: 1,247
Status: Syncing

Commands:
- Logs: tail -f indexer.log
- Query: docker exec clickhouse clickhouse-client ...
- Stop: kill [PID]
```

---

### 2. ClickHouse Cloud Deployer

**File**: `.claude/agents/clickhouse-cloud-deployer.md`

**Purpose**: Automate deployment to ClickHouse Cloud services.

**What It Does**:
1. Validates Cloud service connection
2. Creates database via Cloud API
3. Updates .env for Cloud config
4. Clears sync table (prevents conflicts)
5. Validates table names
6. Starts indexer
7. Verifies data flowing
8. Creates monitoring queries
9. Generates dashboard setup guide
10. Provides deployment summary

**Key Features**:
- Connection validation
- Manual database creation (required)
- Cloud-specific error handling
- Monitoring query generation
- Analytics query library
- Dashboard setup guide

**Best For**:
- Production deployments
- Scalable infrastructure
- Professional projects
- Team collaboration

**Example Output**:
```markdown
Deployment Successful!

Service: pipes-sdk-test (EU-West-1)
Database: pipes
Events Indexed: 1,247
Status: Syncing (~10,000 blocks/sec)

Monitoring:
- queries/monitoring/sync-status.sql
- queries/monitoring/sync-rate.sql
- queries/monitoring/data-quality.sql

Dashboard: DASHBOARD_SETUP.md
```

---

### 3. Railway Deployer

**File**: `.claude/agents/railway-deployer.md`

**Purpose**: Automate deployment to Railway platform for 24/7 operation.

**What It Does**:
1. Validates Railway authentication
2. Validates project structure
3. Checks table name consistency
4. Configures ClickHouse connection
5. Deploys via Pipes CLI
6. Monitors deployment progress
7. Verifies data flowing
8. Creates management guide
9. Provides Railway commands
10. Generates deployment summary

**Key Features**:
- Railway authentication handling (token or login)
- ClickHouse Cloud integration
- Containerized deployment via Pipes CLI
- Pre-flight table validation
- Deployment monitoring
- MCP integration (Railway + ClickHouse)
- Management command reference

**Best For**:
- Production 24/7 deployment
- Scalable platform hosting
- Team collaboration
- Managed infrastructure

**Example Output**:
```markdown
Railway Deployment Successful!

Service: base-uniswap-swaps
Status: Running
Region: us-west1

ClickHouse: Cloud (EU-West-1)
Database: pipes
Events Indexed: 247
Status: Syncing

Management:
- railway logs
- railway status
- railway open

Documentation: RAILWAY_DEPLOYMENT.md
```

---

## Commands Deep Dive

### 1. `/deploy-local` Command

**File**: `.claude/commands/deploy-local.md`

**Usage**: `/deploy-local [project-path]`

**What It Provides**:
- Clear usage instructions
- Prerequisites checklist
- Step-by-step expectations
- Common issue solutions
- Post-deployment commands

**Workflow**:
```
User Types: /deploy-local my-indexer
     ↓
Command Expands with Context
     ↓
Launches clickhouse-local-deployer Agent
     ↓
Agent Executes Full Deployment
     ↓
Returns Summary to User
```

**When to Use**:
- First time setup
- Development workflow
- Testing changes
- Learning the system

---

### 2. `/deploy-cloud` Command

**File**: `.claude/commands/deploy-cloud.md`

**Usage**: `/deploy-cloud [project-path]`

**What It Provides**:
- Cloud-specific instructions
- Service setup guidance
- Connection validation steps
- Monitoring setup
- Cost considerations

**Workflow**:
```
User Types: /deploy-cloud my-indexer
     ↓
Command Expands with Context
     ↓
Asks for Cloud Service Details
     ↓
Launches clickhouse-cloud-deployer Agent
     ↓
Agent Executes Full Cloud Deployment
     ↓
Returns Summary + Monitoring + Dashboard
```

**When to Use**:
- Production deployment
- After local testing passes
- Scalable infrastructure needed
- Team collaboration required

---

### 3. `/deploy-railway` Command

**File**: `.claude/commands/deploy-railway.md`

**Usage**: `/deploy-railway [project-path]`

**What It Provides**:
- Railway authentication guidance
- Platform deployment workflow
- ClickHouse Cloud integration
- Cost considerations (Railway + ClickHouse)
- Management command reference

**Workflow**:
```
User Types: /deploy-railway my-indexer
     ↓
Command Expands with Context
     ↓
Checks Railway Authentication
     ↓
Asks for ClickHouse Configuration
     ↓
Launches railway-deployer Agent
     ↓
Agent Deploys via Pipes CLI to Railway
     ↓
Returns Summary + Management Guide
```

**When to Use**:
- 24/7 production deployment
- After local and Cloud testing
- Managed platform needed
- Team collaboration required

---

## Agent Capabilities Comparison

| Feature | Local Deployer | Cloud Deployer | Railway Deployer |
|---------|---------------|----------------|------------------|
| **Container Setup** | Auto-creates | N/A (Cloud service) | Via Railway |
| **Password Discovery** | Auto-detects | User provides | User provides |
| **Database Creation** | Automated | Manual step | Manual (CH Cloud) |
| **Connection Test** | Docker exec | curl/API | Railway CLI |
| **Sync Table Clear** | Automated | Automated | Automated |
| **Table Validation** | Pre-flight | Pre-flight | Pre-flight |
| **Data Verification** | 30-second check | 30-second check | 2-minute check |
| **MCP Setup** | Automated | Manual config | Manual config |
| **Monitoring Queries** | Not generated | Auto-generated | Generated in guide |
| **Dashboard Guide** | Not included | Included | Included |
| **24/7 Uptime** | Local machine only | Cloud | Railway platform |
| **Cost** | Free | ~$40-500/month | ~$50-550/month |
| **Deployment Time** | ~2 minutes | ~5 minutes | ~8-10 minutes |

---

## Deployment Workflow Comparison

### Local Deployment Flow

```
1. Check Docker (5s)
2. Setup Container (30s)
3. Create Database (10s)
4. Configure .env (5s)
5. Validate Tables (10s)
6. Start Indexer (10s)
7. Verify Data (30s)
8. Setup MCP (10s)
───────────────────────
Total: ~2 minutes
```

### Cloud Deployment Flow

```
1. Validate Connection (30s)
2. Ask for Service Details (user input)
3. Create Database (30s)
4. Configure .env (5s)
5. Validate Tables (10s)
6. Start Indexer (10s)
7. Verify Data (30s)
8. Generate Monitoring (30s)
9. Create Dashboard Guide (30s)
───────────────────────
Total: ~5 minutes
```

### Railway Deployment Flow

```
1. Check Railway Auth (10s)
2. Validate Project (30s)
3. Ask for ClickHouse Config (user input)
4. Test CH Connection (30s)
5. Configure .env (5s)
6. Validate Tables (10s)
7. Deploy to Railway (3-5 min)
8. Wait for Service Start (30s)
9. Verify Data (2 min)
10. Create Management Guide (30s)
───────────────────────
Total: ~8-10 minutes
```

---

## Common Deployment Patterns

### Pattern 1: Development → Production

```bash
# 1. Create indexer
/new-indexer my-protocol-indexer

# 2. Test locally with recent blocks
cd my-protocol-indexer
# Edit src/index.ts: range: { from: '20000000' }  # Recent block
/deploy-local my-protocol-indexer

# 3. Validate data looks good
docker exec clickhouse clickhouse-client \
  --query "SELECT * FROM pipes.events LIMIT 10"

# 4. Update to full history
# Edit src/index.ts: range: { from: '12345678' }  # Deployment block
# Clear local database
docker exec clickhouse clickhouse-client \
  --query "DROP DATABASE pipes; CREATE DATABASE pipes;"

# 5a. Deploy to Cloud for ClickHouse (data storage)
/deploy-cloud my-protocol-indexer

# 5b. OR deploy to Railway for 24/7 platform hosting
/deploy-railway my-protocol-indexer
```

### Pattern 2: Multiple Indexers (Isolated Databases)

```bash
# Deploy multiple indexers with separate databases

# Indexer 1: Uniswap Base
/deploy-local uniswap-base
# Database: uniswap_base

# Indexer 2: Morpho Ethereum
/deploy-local morpho-ethereum
# Database: morpho_ethereum

# Benefits:
# - No sync table conflicts
# - Easy to drop/recreate individual indexers
# - Clear data organization
```

### Pattern 3: Shared Database (Multiple Indexers)

```bash
# Deploy multiple indexers to same database

# Indexer 1
/deploy-local indexer-1
# Database: pipes

# Indexer 2
/deploy-local indexer-2
# Database: pipes (same)
# Agent auto-clears sync table to prevent conflicts

# Benefits:
# - Single database to manage
# - Can join across indexers

# Drawbacks:
# - Must clear sync table each time
# - Harder to reset individual indexers
```

---

## Error Handling

Both agents handle common errors automatically:

### Automatic Error Recovery

| Error | Local Agent | Cloud Agent |
|-------|-------------|-------------|
| **Container not found** | Creates new | N/A |
| **Wrong password** | Auto-detects from container | Asks user |
| **Database doesn't exist** | Creates it | Creates via API |
| **Sync table collision** | Auto-clears | Auto-clears |
| **Table name mismatch** | Validates & reports | Validates & reports |
| **Zero data** | Checks logs, reports | Checks logs, reports |
| **Connection timeout** | Retries | Tests & reports |

### User Intervention Required

| Scenario | Local | Cloud |
|----------|-------|-------|
| Docker not running | ✋ Start Docker | N/A |
| Port conflict | ✋ Choose action | N/A |
| Cloud service down | N/A | ✋ Check console |
| Wrong service URL | N/A | ✋ Correct URL |

---

## Validation & Safety

### Pre-Deployment Validations

Both agents perform these checks:

1. **Connection Validation**
   - Test database connection
   - Verify credentials
   - Check service health

2. **Table Name Validation**
   - Extract schema tables from migrations
   - Extract code references from src/
   - Flag mismatches before deployment

3. **Sync Table Check**
   - Check if sync table exists
   - Verify start block matches config
   - Auto-clear if conflict detected

4. **ABI Validation** (if integrated)
   - Verify ABI files exist
   - Check event exports present
   - Validate contract addresses

### Post-Deployment Verifications

1. **Data Flow Check** (30 seconds)
   - Wait 30 seconds after start
   - Query row count
   - Verify > 0 events

2. **Data Quality Check**
   - Sample 5 rows
   - Check for NULL values
   - Validate field formats

3. **Sync Progress Check**
   - Get latest block
   - Compare to expected
   - Verify increasing

---

## Monitoring & Management

### Local Deployment Monitoring

```bash
# View logs
tail -f [project]/indexer.log

# Check status
docker exec clickhouse clickhouse-client \
  --query "SELECT COUNT(*) FROM pipes.swaps"

# Monitor progress
watch -n 5 "docker exec clickhouse clickhouse-client \
  --query 'SELECT MAX(block_number) FROM pipes.swaps'"

# Stop indexer
kill [PID]
```

### Cloud Deployment Monitoring

```bash
# Use generated monitoring queries
cat queries/monitoring/sync-status.sql

# Or via curl
curl -X POST "https://[service].clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "SELECT COUNT(*) FROM pipes.swaps"

# Or via ClickHouse Cloud SQL Console
# (see DASHBOARD_SETUP.md)
```

---

## Best Practices

### 1. Always Test Locally First

```bash
# DON'T: Deploy directly to Cloud
/deploy-cloud untested-indexer  #

# DO: Test locally first
/deploy-local untested-indexer   # Test
# Verify data looks good
/deploy-cloud untested-indexer   # Deploy
```

### 2. Use Dedicated Databases

```bash
# DON'T: Share database for unrelated indexers
DATABASE=pipes  # For everything

# DO: Use dedicated databases
DATABASE=uniswap_base       # Clear ownership
DATABASE=morpho_ethereum    # No conflicts
DATABASE=aave_polygon       # Easy management
```

### 3. Verify Start Block

```bash
# Always check first log line:
tail -f indexer.log | head -1

# Expected: "Start indexing from [your-block]"
# Wrong: "Resuming from [different-block]"

# If wrong: Agent auto-detects and fixes
```

### 4. Monitor Data Quality

```bash
# After deployment, check:
# 1. Row count increasing
# 2. No NULL values in critical fields
# 3. Timestamps are recent
# 4. Amounts are reasonable

# Both agents verify this automatically
```

---

## Future Enhancements

### Planned Features

1. **Multi-Chain Deployment**
   - Deploy same indexer to multiple chains
   - Aggregate data across chains
   - Chain-specific configuration

2. **Automated Monitoring**
   - Alert on sync failures
   - Monitor performance degradation
   - Automatic restarts

3. **Backup & Restore**
   - Automated backups
   - Point-in-time recovery
   - Cross-region replication

4. **CI/CD Integration**
   - GitHub Actions for deployment
   - Automated testing
   - Progressive rollout

---

## Related Documentation

- **Agents**:
  - `.claude/agents/clickhouse-local-deployer.md`
  - `.claude/agents/clickhouse-cloud-deployer.md`
  - `.claude/agents/railway-deployer.md`

- **Commands**:
  - `.claude/commands/deploy-local.md`
  - `.claude/commands/deploy-cloud.md`
  - `.claude/commands/deploy-railway.md`

- **Guides**:
  - `.claude/docs/CLICKHOUSE_CLOUD_DEPLOYMENT.md` - Complete Cloud guide
  - `.claude/docs/CLICKHOUSE_MCP_USAGE.md` - MCP configuration
  - `.claude/docs/RAILWAY_MCP_USAGE.md` - Railway MCP usage
  - `.claude/docs/INDEXER_WORKFLOW.md` - General workflow

- **Templates**:
  - `.claude/templates/analytics/` - Analytics query templates

---

## Quick Reference

### Local Deployment
```bash
/deploy-local [project-path]
```
- **Time**: ~2 minutes
- **Cost**: Free
- **Best For**: Development

### Cloud Deployment
```bash
/deploy-cloud [project-path]
```
- **Time**: ~5 minutes
- **Cost**: ~$40-500/month
- **Best For**: Production data storage

### Railway Deployment
```bash
/deploy-railway [project-path]
```
- **Time**: ~8-10 minutes
- **Cost**: ~$50-550/month (Railway + ClickHouse)
- **Best For**: 24/7 platform hosting

### Workflow
```bash
1. /new-indexer           # Create
2. /deploy-local          # Test
3. /deploy-cloud          # Deploy ClickHouse
4. /deploy-railway        # Deploy to platform (optional)
```

---

**Document Version**: 1.1
**Last Updated**: 2025-02-03
**Status**: Production Ready
