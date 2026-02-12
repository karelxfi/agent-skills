---
name: pipes-deployment
description: Comprehensive deployment documentation for Pipes indexers. Covers local Docker deployment, ClickHouse Cloud deployment, and Railway platform deployment with specialized agents, MCP integration, and best practices.
metadata:
  author: subsquid
  version: "1.0.0"
  category: documentation
---

# Pipes: Deployment Documentation

Complete deployment infrastructure for Pipes indexers across local, cloud, and platform environments.

## When to Use This Skill

Use this skill when you need to:
- Deploy an indexer to local Docker (development/testing)
- Deploy to ClickHouse Cloud (production data storage)
- Deploy to Railway platform (24/7 hosting)
- Understand deployment workflows and best practices
- Set up MCP servers for deployment monitoring
- Troubleshoot deployment issues
- Compare deployment options

## Overview

This skill provides access to comprehensive deployment guides covering three deployment targets:

1. **Local Deployment** - Docker-based development environment
2. **ClickHouse Cloud** - Production data storage
3. **Railway Platform** - 24/7 managed hosting

Each deployment type has specialized documentation, automated workflows, and MCP integration.

## Deployment Options Comparison

| Feature | Local | Cloud | Railway |
|---------|-------|-------|---------|
| **Purpose** | Development | Data Storage | 24/7 Hosting |
| **Uptime** | When machine on | 24/7 | 24/7 |
| **Cost** | Free | $40-500/mo | $50-550/mo |
| **Setup Time** | 2 min | 5 min | 8-10 min |
| **Best For** | Testing | Production DB | Production Platform |
| **ClickHouse** | Local Docker | Cloud | Cloud (required) |
| **Access** | Local only | Global | Global |
| **Monitoring** | Manual | Dashboard | Railway + MCP |
| **Scalability** | Limited | High | High |

## 1. Local Deployment (Docker)

### Purpose
Development and testing with local Docker-based ClickHouse.

### Key Features
- Automatic Docker container detection/creation
- Auto-discovery of ClickHouse password
- Sync table conflict prevention
- 30-second data verification
- MCP auto-configuration

### Quick Start

```bash
# Start ClickHouse container
docker run -d --name clickhouse \
  -p 8123:8123 -p 9000:9000 \
  -e CLICKHOUSE_PASSWORD=default \
  clickhouse/clickhouse-server

# Deploy indexer
cd my-indexer
bun run dev

# Verify data (after 30 seconds)
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT COUNT(*) FROM pipes.my_table"
```

### When to Use
- Development workflow
- Quick iterations
- Testing before cloud deployment
- Learning the system

### Documentation
- `DEPLOYMENT_AGENTS.md` - Section: ClickHouse Local Deployer
- `DEPLOYMENT_LESSONS_LEARNED.md` - Local deployment patterns

## 2. ClickHouse Cloud Deployment

### Purpose
Production-grade data storage with global access and scalability.

### Key Features
- Connection validation before deployment
- Manual database creation (required step)
- Cloud-specific error handling
- Automatic monitoring query generation
- Analytics query library
- Dashboard setup guides

### Quick Start

```bash
# Prerequisites
# 1. Create ClickHouse Cloud service
# 2. Get service URL and credentials

# Update .env
CLICKHOUSE_URL=https://xxx.clickhouse.cloud:8443
CLICKHOUSE_PASSWORD=your_cloud_password
CLICKHOUSE_DATABASE=pipes

# Deploy indexer
cd my-indexer
bun run dev

# Verify via Cloud Console or MCP
```

### When to Use
- Production deployments
- Scalable infrastructure
- Team collaboration
- Global data access

### Documentation
- `DEPLOYMENT_AGENTS.md` - Section: ClickHouse Cloud Deployer
- `CLICKHOUSE_MCP_USAGE.md` - MCP integration
- `CLICKHOUSE_CLOUD_IMPROVEMENTS.md` - Cloud optimizations

## 3. Railway Platform Deployment

### Purpose
24/7 managed platform hosting for production indexers.

### Key Features
- Railway authentication handling (token or login)
- ClickHouse Cloud integration (required)
- Containerized deployment via Pipes CLI
- Pre-flight table validation
- Deployment monitoring
- Management command reference

### Quick Start

```bash
# Prerequisites
# 1. Railway account with token
# 2. ClickHouse Cloud service ready

# Set Railway token
export RAILWAY_TOKEN=xxx

# Deploy via Pipes CLI
cd my-indexer
npx @iankressin/pipes-cli-test@latest deploy --provider railway

# Monitor deployment
railway logs -f
```

### When to Use
- 24/7 production hosting
- Managed infrastructure
- Team collaboration
- After local and cloud testing

### Documentation
- `RAILWAY_DEPLOYMENT_SUMMARY.md` - Complete Railway guide
- `RAILWAY_MCP_USAGE.md` - Railway MCP tools
- `IMPROVED_RAILWAY_WORKFLOW.md` - Optimized workflows
- `RAILWAY_PRE_FLIGHT_CHECKLIST.md` - Pre-deployment validation

## Common Deployment Workflow

### Pattern 1: Development to Production

```bash
# 1. Create indexer
/new-indexer my-protocol-indexer

# 2. Test locally with recent blocks
cd my-protocol-indexer
# Edit src/index.ts: range: { from: '20000000' }  # Recent
bun run dev

# 3. Verify data
docker exec clickhouse clickhouse-client \
  --query "SELECT * FROM pipes.events LIMIT 10"

# 4. Update to full history
# Edit src/index.ts: range: { from: '12345678' }  # Deployment block

# 5. Deploy to Cloud
CLICKHOUSE_URL=https://xxx.clickhouse.cloud:8443 bun run dev

# 6. Deploy to Railway (optional, for 24/7)
export RAILWAY_TOKEN=xxx
npx @iankressin/pipes-cli-test@latest deploy --provider railway
```

### Pattern 2: Multiple Indexers (Isolated Databases)

```bash
# Indexer 1: Uniswap Base
DATABASE=uniswap_base bun run dev

# Indexer 2: Morpho Ethereum
DATABASE=morpho_ethereum bun run dev

# Benefits:
# - No sync table conflicts
# - Easy to drop/recreate individual indexers
# - Clear data organization
```

## MCP Integration

### ClickHouse MCP

Monitor and query data from deployed indexers.

```typescript
// List databases
mcp__clickhouse__list_databases()

// List tables
mcp__clickhouse__list_tables({ database: "pipes" })

// Query data
mcp__clickhouse__run_select_query({
  query: "SELECT COUNT(*) FROM pipes.swaps"
})

// Analyze table
mcp__clickhouse__run_select_query({
  query: "DESCRIBE pipes.swaps"
})
```

### Railway MCP

Manage Railway deployments.

```typescript
// Check service status
mcp__railway__get_service(service_id)

// View logs
mcp__railway__stream_logs(service_id)

// Manage environment variables
mcp__railway__list_variables(service_id)
mcp__railway__set_variable(service_id, key, value)

// Deployment management
mcp__railway__list_deployments(service_id)
mcp__railway__restart_service(service_id)
```

## Deployment Validation

### Mandatory Checks (All Deployments)

After starting any indexer:

```bash
# 1. Check start block (within 30 seconds)
tail -f indexer.log
# Expected: "Start indexing from X" (your deployment block)
# Wrong: "Resuming from Y" (indicates sync table conflict)

# 2. Wait 30 seconds, check for data
# For local Docker:
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT COUNT(*) FROM pipes.my_table"

# For Cloud:
# Use ClickHouse Cloud Console or MCP

# 3. Verify data quality
docker exec clickhouse clickhouse-client --password=default \
  --query "SELECT * FROM pipes.my_table LIMIT 3 FORMAT Vertical"

# Check:
# - Addresses valid (0x... format)
# - Amounts reasonable
# - Timestamps correct
# - All fields populated

# 4. Wait another 30 seconds, verify increasing
# Count should be higher than step 2
```

## Troubleshooting Common Issues

### Issue 1: Wrong Start Block / Skipped Blocks

**Symptom**: Indexer starts from unexpected block (e.g., 27M instead of 21M)

**Cause**: Shared sync table with other indexers

**Solution**:
```bash
# Option A: Clear sync table before starting
docker exec clickhouse clickhouse-client --password=default \
  --query "TRUNCATE TABLE pipes.sync"

# Option B: Use separate database
CLICKHOUSE_DATABASE=my_unique_db bun run dev
```

### Issue 2: ClickHouse Authentication Failed

**Symptom**: "Authentication failed" error

**Solution**:
```bash
# Get actual password from container
docker inspect clickhouse | grep CLICKHOUSE_PASSWORD

# Update .env with correct password
CLICKHOUSE_PASSWORD=actual_password
```

### Issue 3: Railway Deployment Stuck

**Symptom**: Railway service won't start or crashes immediately

**Solution**:
```bash
# Check logs for errors
railway logs

# Verify ClickHouse connection
# Must use ClickHouse Cloud (not local Docker)
CLICKHOUSE_URL=https://xxx.clickhouse.cloud:8443

# Check environment variables
railway variables

# Restart service
railway restart
```

### Issue 4: Zero Data After Deployment

**Symptom**: Indexer syncing but database empty

**Possible Causes**:
- Wrong start block (after events occurred)
- Wrong contract address
- Proxy contract (need implementation ABI)
- Event name mismatch

**Solution**:
```bash
# Verify contract address is correct
# Check start block is before first event
# Verify ABI matches contract events
# Check for proxy contracts
```

## Best Practices

### 1. Always Test Locally First

```bash
# DON'T: Deploy directly to Cloud/Railway
CLICKHOUSE_URL=https://xxx.clickhouse.cloud:8443 bun run dev

# DO: Test locally first
docker run -d --name clickhouse -p 8123:8123 \
  -e CLICKHOUSE_PASSWORD=default \
  clickhouse/clickhouse-server

bun run dev  # Test local first
# Then deploy to Cloud/Railway
```

### 2. Use Dedicated Databases

```bash
# DON'T: Share 'pipes' for everything
DATABASE=pipes  # For all indexers

# DO: Use unique databases
DATABASE=uniswap_base
DATABASE=morpho_ethereum
DATABASE=aave_polygon
```

### 3. Verify Start Block

```bash
# ALWAYS check first log line:
tail -f indexer.log | head -1

# Expected: "Start indexing from [your-block]"
# Wrong: "Resuming from [different-block]"
```

### 4. Monitor Data Quality

```bash
# After deployment:
# 1. Row count increasing ✓
# 2. No NULL values in critical fields ✓
# 3. Timestamps are recent ✓
# 4. Amounts are reasonable ✓
```

## Available Reference Documents

All reference documents are in the `references/` directory:

1. **DEPLOYMENT_AGENTS.md**
   - Complete overview of all deployment options
   - Agent capabilities comparison
   - Deployment workflows
   - Error handling

2. **RAILWAY_DEPLOYMENT_SUMMARY.md**
   - Railway-specific deployment guide
   - Complete workflow from setup to production
   - Cost breakdown
   - Success metrics

3. **CLICKHOUSE_MCP_USAGE.md**
   - ClickHouse MCP server setup
   - Query patterns and examples
   - Integration with indexer validation
   - Troubleshooting

4. **RAILWAY_MCP_USAGE.md**
   - Railway MCP server setup
   - Service management tools
   - Monitoring and logging
   - Deployment management

5. **DEPLOYMENT_IMPROVEMENTS_COMPLETE.md**
   - Implementation details
   - Lessons learned
   - Future enhancements

6. **DEPLOYMENT_LESSONS_LEARNED.md**
   - Real-world deployment experiences
   - Common pitfalls and solutions
   - Performance insights

7. **IMPROVED_RAILWAY_WORKFLOW.md**
   - Optimized Railway deployment workflow
   - Pre-flight checks
   - Validation steps

8. **RAILWAY_PRE_FLIGHT_CHECKLIST.md**
   - Pre-deployment validation checklist
   - Required credentials
   - Configuration verification

9. **CLICKHOUSE_CLOUD_IMPROVEMENTS.md**
   - Cloud-specific optimizations
   - Connection management
   - Performance tuning

## How to Access Documentation

```bash
# Read deployment overview
cat references/DEPLOYMENT_AGENTS.md

# Read Railway guide
cat references/RAILWAY_DEPLOYMENT_SUMMARY.md

# Read ClickHouse MCP guide
cat references/CLICKHOUSE_MCP_USAGE.md
```

Or use Claude Code's Read tool:
```
Read: agent-skills/skills/pipes-deployment/references/DEPLOYMENT_AGENTS.md
```

## Related Skills

- See pipes-orchestrator for workflow guidance - Core indexer workflow (Steps 1-7)
- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Project generation
- [pipes-validation](../pipes-validation/SKILL.md) - Post-deployment validation
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Debugging deployments
- [pipes-performance](../pipes-performance/SKILL.md) - Performance optimization
- [PATTERNS.md](../pipes-troubleshooting/references/PATTERNS.md) - Implementation patterns

## Cost Considerations

### Development (Local)
- **Docker ClickHouse**: Free
- **Total**: $0/month

### Production (Cloud Only)
- **ClickHouse Cloud Dev**: $40-80/month
- **Total**: $40-80/month

### Production (Cloud + Railway)
- **Railway Hobby**: $5-20/month
- **ClickHouse Cloud Production**: $200-500/month
- **Total**: $205-520/month

### Comparison with Alternatives
- AWS ECS + RDS: ~$300-800/month
- Digital Ocean + Managed DB: ~$200-500/month
- Heroku + CloudDB: ~$250-600/month

Railway + ClickHouse is competitive for blockchain indexing.

## Success Metrics

### Deployment Speed
- Local: ~2 minutes
- Cloud: ~5 minutes
- Railway: ~8-10 minutes

### Automation Benefits
- 6x faster than manual deployment
- 95% success rate (up from 50%)
- Zero manual configuration errors

## Key Takeaways

1. **Test locally first** - Always validate before cloud deployment
2. **Use dedicated databases** - Prevent sync table conflicts
3. **Verify immediately** - Check data within 30 seconds
4. **Monitor continuously** - Use MCP tools for ongoing monitoring
5. **Follow the workflow** - Development → Cloud → Railway
6. **Read the guides** - Each deployment type has specific requirements

## Documentation Hierarchy

```
pipes-deployment (THIS SKILL)        ← Deployment guides
    ├── references/DEPLOYMENT_OPTIONS.md         ← Platform comparison (NEW)
    ├── references/DEPLOYMENT_AGENTS.md          ← All options overview
    ├── references/RAILWAY_DEPLOYMENT_SUMMARY.md ← Railway complete guide
    ├── references/CLICKHOUSE_MCP_USAGE.md       ← ClickHouse MCP
    └── references/RAILWAY_MCP_USAGE.md          ← Railway MCP

pipes-orchestrator                   ← Includes core workflow
pipes-troubleshooting               ← Debugging guide (includes patterns)
```

### Quick Access

```bash
# Read deployment options comparison
cat pipes-sdk/pipes-deployment/references/DEPLOYMENT_OPTIONS.md
```

Or use Claude Code's Read tool:
```
Read: pipes-sdk/pipes-deployment/references/DEPLOYMENT_OPTIONS.md
```

### Official Subsquid Documentation
- **[llms.txt](https://beta.docs.sqd.dev/llms.txt)** - Quick deployment reference
- **[skill.md](https://beta.docs.sqd.dev/skill.md)** - Comprehensive deployment guide
- **[Available Datasets](https://portal.sqd.dev/datasets)** - Network endpoints for production deployment
