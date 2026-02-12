# Deployment Options for Subsquid Indexers

Comprehensive guide to deploying Subsquid Pipes indexers to various platforms.

## Overview

This document covers:
- **ClickHouse Cloud** - Recommended for production (managed database)
- **ClickHouse Local** - Recommended for development (Docker)
- **Railway** - Quick platform deployment option
- **Comparison table** - Which option to choose
- **Production best practices**

## Deployment Platforms

### 1. ClickHouse Cloud (Production - Recommended)

**Best for**: Production deployments with managed database

**Pros**:
- Fully managed database service
- Auto-scaling and high availability
- No infrastructure management
- Professional support available
- Optimized for analytics workloads

**Cons**:
- Costs money (but has free tier)
- Requires cloud account setup
- More complex initial setup

**When to use**:
- Production deployments
- Scaling beyond single machine
- Teams without DevOps resources
- Critical analytics workloads

**Quick Setup**:
1. Sign up at https://clickhouse.cloud/
2. Create a new service
3. Note credentials (URL, database, password)
4. Configure indexer with cloud credentials
5. Deploy indexer (can run anywhere - local, cloud, Railway)

**For detailed guide**: See `pipes-deploy-clickhouse-cloud` skill

### 2. ClickHouse Local (Development - Recommended)

**Best for**: Local development and testing

**Pros**:
- Free (runs on your machine)
- Quick setup (single Docker command)
- No cloud account needed
- Perfect for testing
- Fast iteration

**Cons**:
- Not suitable for production
- No high availability
- Limited to single machine
- Data lost if container removed
- No automatic backups

**When to use**:
- Local development
- Testing new indexers
- Learning and experimentation
- CI/CD testing

**Quick Setup**:
```bash
# Start ClickHouse container
docker run -d --name clickhouse \
  -p 8123:8123 \
  -e CLICKHOUSE_PASSWORD=default \
  clickhouse/clickhouse-server

# Configure indexer
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=pipes
CLICKHOUSE_PASSWORD=default

# Run indexer
bun run dev
```

**For detailed guide**: See `pipes-deploy-clickhouse-local` skill

### 3. Railway (Platform Deployment)

**Best for**: Quick platform deployment without infrastructure management

**Pros**:
- Easy deployment (git push)
- Free tier available ($5 credit/month)
- Automatic HTTPS
- Simple environment variable management
- No DevOps required

**Cons**:
- Costs money (after free tier)
- Platform lock-in
- Less control than self-hosted
- May need ClickHouse Cloud separately

**When to use**:
- Deploying indexer application (not database)
- Want easy git-based deployment
- Don't want to manage servers
- Prototyping or demos

**Quick Setup**:
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Deploy: `railway up`
4. Set environment variables for ClickHouse Cloud
5. Monitor via Railway dashboard

**Railway Deployment Guide**:

#### Prerequisites
- Railway account (https://railway.app/)
- ClickHouse Cloud service (for production) or local ClickHouse (for testing)
- Tested indexer locally first

#### Deployment Steps

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login  # Opens browser

# 3. Initialize project
cd your-indexer-project
railway init --name "my-indexer"

# 4. Set environment variables
railway variables set \
  CLICKHOUSE_URL="https://xxx.clickhouse.cloud:8443" \
  CLICKHOUSE_DATABASE="pipes" \
  CLICKHOUSE_PASSWORD="your-password"

# 5. Deploy
railway up

# 6. Monitor logs
railway logs

# 7. Check status
railway status
```

#### Important Notes for Railway

**Schema Compatibility**:
- DON'T use `ReplacingMergeTree` (incompatible with ClickHouse Cloud)
- DO use `MergeTree` for all tables

**Dockerfile**:
- Railway's auto-detection (Nixpacks) usually works better
- Remove custom Dockerfile unless needed

**Validation Before Deploy**:
```bash
# Test locally for 30 seconds
timeout 30 bun run dev

# Check for errors in logs
grep -i error indexer.log

# Test ClickHouse connection
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1"
```

#### Monitoring Railway Deployment

```bash
# View real-time logs
railway logs --tail

# Check service status
railway status

# Open Railway dashboard
railway open

# Check metrics
railway metrics
```

## Comparison Table

| Feature | ClickHouse Cloud | ClickHouse Local | Railway |
|---------|------------------|------------------|---------|
| **Cost** | Paid (free tier) | Free | Paid (free tier) |
| **Setup Time** | 10-15 min | 2 min | 5-10 min |
| **Use Case** | Production DB | Development | App hosting |
| **Scalability** | Auto-scaling | Single machine | Platform-managed |
| **Maintenance** | Managed | Self-managed | Managed |
| **Backups** | Automatic | Manual | N/A (for apps) |
| **High Availability** | Yes | No | Yes (for apps) |
| **DevOps Required** | Minimal | Minimal | None |
| **Best For** | Production data | Local testing | Deploying indexer |

## Recommended Deployment Strategies

### Strategy 1: Local Development → ClickHouse Cloud Production

**Workflow**:
1. Develop locally with ClickHouse Local Docker
2. Test thoroughly with recent blocks
3. Deploy to ClickHouse Cloud for production
4. Run indexer anywhere (local, cloud, Railway)

**Pros**: Simple, cost-effective, proven
**Best for**: Most use cases

### Strategy 2: Railway + ClickHouse Cloud

**Workflow**:
1. Develop locally with ClickHouse Local
2. Create ClickHouse Cloud service
3. Deploy indexer to Railway
4. Railway connects to ClickHouse Cloud

**Pros**: No server management, easy deployment
**Best for**: Teams without DevOps, prototypes

### Strategy 3: Fully Self-Hosted

**Workflow**:
1. Deploy ClickHouse on your own infrastructure
2. Deploy indexer on your own servers
3. Manage backups, monitoring, scaling yourself

**Pros**: Full control, potentially lower cost at scale
**Cons**: Requires DevOps expertise
**Best for**: Large teams, specific compliance requirements

## Production Checklist

Before deploying to production:

### Testing
- [ ] Indexer tested locally with recent blocks
- [ ] Data quality verified (no NULLs, valid addresses)
- [ ] Performance tested (acceptable sync speed)
- [ ] Error handling tested (network failures, reorgs)

### Security
- [ ] Environment variables set (not hardcoded)
- [ ] ClickHouse password secured
- [ ] API keys rotated regularly
- [ ] Firewall/IP allowlist configured

### Monitoring
- [ ] Logs accessible and monitored
- [ ] Metrics enabled (if available)
- [ ] Alerts configured for failures
- [ ] Data quality checks automated

### Database
- [ ] Schema validated (no ReplacingMergeTree for Cloud)
- [ ] Backups configured
- [ ] Connection tested from production environment
- [ ] Resource limits appropriate for workload

### Application
- [ ] Start block verified
- [ ] Sync state management working
- [ ] Graceful shutdown handling
- [ ] Restart/resume logic tested

## Common Deployment Issues

### Issue 1: ClickHouse Cloud Connection Failed

**Error**: Cannot connect to ClickHouse Cloud

**Solutions**:
```bash
# Check credentials
echo $CLICKHOUSE_URL
echo $CLICKHOUSE_PASSWORD

# Test connection
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "SELECT 1"

# Common fixes:
# - Verify URL includes port (:8443)
# - Check password is correct
# - Ensure IP allowlist includes 0.0.0.0/0 (for Railway)
# - Verify service is running in ClickHouse dashboard
```

### Issue 2: Railway Build Failed

**Error**: Build errors during Railway deployment

**Solutions**:
```bash
# Check build logs
railway logs --build

# Common fixes:
# - Add missing dependencies to package.json
# - Remove problematic Dockerfile (use auto-detection)
# - Ensure Node.js version compatible
# - Check for TypeScript errors
```

### Issue 3: Wrong Start Block

**Error**: Indexer starts from wrong block on Railway

**Solutions**:
```bash
# Clear sync state in ClickHouse
curl -X POST "$CLICKHOUSE_URL/" \
  --user "default:$CLICKHOUSE_PASSWORD" \
  -d "TRUNCATE TABLE pipes.sync"

# Or use separate database
railway variables set CLICKHOUSE_DATABASE="my_unique_db"

# Redeploy
railway up
```

### Issue 4: No Data After Deployment

**Error**: Indexer running but no data appearing

**Diagnostics**:
```bash
# Check logs for errors
railway logs | grep -i error

# Verify ClickHouse connection
# Check start block is correct
# Ensure contract address is correct
# Verify events are being emitted in that block range
```

## Environment Variables Reference

### Required for All Deployments

```bash
# ClickHouse Connection
CLICKHOUSE_URL=http://localhost:8123  # or https://xxx.clickhouse.cloud:8443
CLICKHOUSE_DATABASE=pipes
CLICKHOUSE_PASSWORD=default  # Change for production!

# Optional but recommended
CLICKHOUSE_USER=default
```

### Optional (Advanced)

```bash
# Metrics
METRICS_PORT=9090
METRICS_ENABLED=true

# Logging
LOG_LEVEL=info

# Performance tuning
BATCH_SIZE=1000
CONCURRENT_QUERIES=5
```

## Cost Estimation

### ClickHouse Cloud
- **Free tier**: 30 GB storage, limited compute
- **Pay-as-you-go**: ~$0.40/GB storage + compute charges
- **Typical indexer**: $10-50/month depending on data volume

### Railway
- **Free tier**: $5 credit/month
- **Hobby plan**: $5/month (500 hours execution)
- **Pro plan**: $20/month (more resources)

### Self-Hosted
- **ClickHouse Local**: Free (your machine resources)
- **Cloud VPS**: $5-20/month for small instance
- **Large deployment**: $100+/month depending on scale

## Related Skills

- **pipes-deploy-clickhouse-cloud** - Detailed ClickHouse Cloud deployment
- **pipes-deploy-clickhouse-local** - Detailed local Docker deployment
- **pipes-troubleshooting** - Debug deployment issues
- **pipes-performance** - Optimize deployed indexers

## Quick Decision Guide

**Choose ClickHouse Cloud if**:
- You need production-grade database
- You want managed service
- You have budget for hosting
- You need high availability

**Choose ClickHouse Local if**:
- You're developing/testing
- You want free option
- You're learning the system
- You need quick iteration

**Choose Railway if**:
- You want to deploy the indexer application
- You don't want to manage servers
- You have ClickHouse Cloud for database
- You want git-based deployment

**Choose Self-Hosted if**:
- You have DevOps expertise
- You need full control
- You have compliance requirements
- You're running at large scale

## Next Steps

1. **Development**: Start with ClickHouse Local
2. **Testing**: Validate with recent blocks locally
3. **Production**: Deploy to ClickHouse Cloud
4. **Hosting**: Use Railway, cloud VPS, or self-hosted for indexer application
5. **Monitor**: Set up logging and alerting
6. **Optimize**: Use performance best practices from PATTERNS.md
