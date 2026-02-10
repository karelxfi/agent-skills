# ClickHouse Cloud Deployment - Configuration Improvements

**Date**: 2025-02-03
**Context**: Based on successful deployment of base-uniswap-swaps indexer to ClickHouse Cloud
**Status**: Proposed improvements for Claude configuration

---

## Executive Summary

This document proposes improvements to Claude Code configuration based on lessons learned from deploying a Pipes SDK indexer to ClickHouse Cloud. The deployment revealed several gaps in our current workflow that should be codified.

## What We Accomplished

Successfully deployed the base-uniswap-swaps indexer to ClickHouse Cloud:
- **Service**: pipes-sdk-test (EU-West-1)
- **Data Indexed**: 713K+ swaps from Uniswap V3 on Base
- **Deliverables**:
  - Working indexer syncing to ClickHouse Cloud
  - Comprehensive analytics query library (dashboard-queries.sql)
  - Dashboard setup guide (DASHBOARD_SETUP.md)
  - Complete deployment tutorial (CLICKHOUSE_CLOUD_DEPLOYMENT.md)

## Key Learnings & Gaps Identified

### 1. ClickHouse Cloud vs Local ClickHouse

**Current State**: Documentation and workflows assume local ClickHouse via Docker.

**Gap**: No specific guidance for ClickHouse Cloud deployment:
- Different connection parameters (HTTPS vs HTTP, port 8443 vs 8123)
- No Docker exec commands needed
- Database must be created manually (migrations don't create the database)
- MCP tools need different configuration for cloud instances

**Improvement Needed**: Separate documentation for Cloud vs Local deployments.

---

### 2. Database Creation Workflow

**Current State**: Pipes SDK migrations automatically run `.sql` files but don't create the database itself.

**Issue Encountered**:
- Generated `.env` file with cloud credentials
- Ran indexer, got "Database pipes does not exist" error
- Had to manually create database via curl/SQL Console

**Improvement**: Update `/new-indexer` command to handle database creation.

---

### 3. Table Name Consistency

**Issue Encountered**:
- Migration files created tables: `swaps`, `mints`, `burns`, etc.
- Code referenced: `uniswap_v3_swaps`, `uniswap_v3_factory`, etc.
- Result: Runtime errors for non-existent tables

**Root Cause**: Template/generated code didn't match migration schema.

**Improvement**: Better validation between schema files and code references.

---

### 4. ClickHouse MCP Configuration for Cloud

**Current State**: MCP server configured for local ClickHouse (localhost:8123).

**Gap**: No guidance for configuring MCP for ClickHouse Cloud:
```bash
# Needed for Cloud:
CLICKHOUSE_HOST=a1so4qh9pg.eu-west-1.aws.clickhouse.cloud
CLICKHOUSE_PORT=8443  # Not 8123
CLICKHOUSE_SECURE=true  # Not false
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<actual-cloud-password>
CLICKHOUSE_DATABASE=pipes
```

**Improvement**: Add MCP Cloud configuration guide.

---

### 5. Analytics & Visualization Workflow

**Current State**: Testing documentation focuses on data validation queries.

**Gap**: No guidance on creating dashboards, analytics queries, or monitoring.

**Created During Deployment**:
- 12 categories of analytics queries
- Dashboard setup guide with multiple visualization options
- Examples for ClickHouse Cloud Charts, Grafana, Metabase, etc.

**Improvement**: Add analytics/dashboard section to standard workflow.

---

## Proposed Configuration Improvements

### Improvement 1: Add ClickHouse Cloud Deployment Guide

**Location**: `.claude/docs/CLICKHOUSE_CLOUD_DEPLOYMENT.md` (Already created)

**Content**:
- Step-by-step Cloud deployment
- Configuration differences vs local
- Common issues and solutions
- Cost considerations

**Action**: Reference this document in main workflow docs.

---

### Improvement 2: Update `/new-indexer` Command

**File**: `.claude/commands/new-indexer.md`

**Changes**:

```markdown
### Step 4: Post-generation setup (AUTOMATED)

... existing content ...

#### ClickHouse Cloud Deployment

If deploying to ClickHouse Cloud instead of local Docker:

1. **Configure .env for Cloud**:
   ```env
   CLICKHOUSE_URL=https://[service-id].[region].aws.clickhouse.cloud:8443
   CLICKHOUSE_DATABASE=pipes
   CLICKHOUSE_USER=default
   CLICKHOUSE_PASSWORD=[your-cloud-password]
   ```

2. **Create database manually** (CLI doesn't create databases):

   **Option A: ClickHouse Cloud SQL Console**
   ```sql
   CREATE DATABASE IF NOT EXISTS pipes;
   ```

   **Option B: Using curl**
   ```bash
   curl -X POST "[your-clickhouse-cloud-url]:8443/" \
     --user "default:[password]" \
     -d "CREATE DATABASE IF NOT EXISTS pipes"
   ```

3. **Verify connection** before running indexer:
   ```bash
   curl -X POST "[your-clickhouse-cloud-url]:8443/" \
     --user "default:[password]" \
     -d "SELECT 1"
   ```

4. **Run migrations and start indexer**:
   ```bash
   bun run dev
   ```

For complete Cloud deployment guide, see:
`.claude/docs/CLICKHOUSE_CLOUD_DEPLOYMENT.md`
```

---

### Improvement 3: Add Analytics Workflow Section

**File**: `.claude/docs/INDEXER_WORKFLOW.md`

**Add new Step 8: Create Analytics & Dashboards**

```markdown
## Step 8: Create Analytics & Dashboards (OPTIONAL)

Once your indexer is syncing data, you can create analytics queries and dashboards.

### 8.1 Create Analytics Queries

Create a `queries/` directory with common analytics patterns:

```sql
-- queries/overview.sql
SELECT
    COUNT(*) as total_events,
    COUNT(DISTINCT pool_address) as unique_pools,
    MIN(block_timestamp) as first_event,
    MAX(block_timestamp) as last_event
FROM pipes.swaps;

-- queries/daily-metrics.sql
SELECT
    toDate(block_timestamp) as date,
    COUNT(*) as event_count,
    SUM(amount_usd) as total_volume
FROM pipes.swaps
GROUP BY date
ORDER BY date DESC
LIMIT 30;

-- queries/top-entities.sql
SELECT
    pool_address,
    COUNT(*) as events,
    SUM(amount_usd) as volume
FROM pipes.swaps
GROUP BY pool_address
ORDER BY volume DESC
LIMIT 20;
```

### 8.2 Create Dashboard Setup Guide

Document how users can visualize the data:

**For ClickHouse Cloud Users**:
- SQL Console with built-in Charts
- Export queries for external BI tools

**For Self-Hosted Users**:
- Grafana dashboards
- Metabase connections
- Superset configurations

**Example**: See `base-uniswap-swaps/DASHBOARD_SETUP.md` for a complete guide.

### 8.3 Common Dashboard Types

**Protocol Overview Dashboard**:
- KPIs: Total volume, event count, unique entities
- Time series: Daily/hourly activity
- Rankings: Top pools, tokens, users

**Entity-Specific Dashboard**:
- Select entity (pool, token, user)
- Historical activity for that entity
- Related entities
- Detailed event log

**Monitoring Dashboard**:
- Real-time sync status
- Data quality metrics
- Error rates
- Performance indicators
```

---

### Improvement 4: Add Cloud MCP Configuration Guide

**File**: `.claude/docs/CLICKHOUSE_MCP_USAGE.md`

**Add new section**:

```markdown
## ClickHouse Cloud Configuration

To use the MCP server with ClickHouse Cloud instead of local instance:

### Installation (Same as Local)
```bash
pipx install mcp-clickhouse
```

### Configuration for Cloud

**CRITICAL**: Use HTTPS URL and port 8443 for Cloud:

```bash
claude mcp add -t stdio \
  -e CLICKHOUSE_HOST=[service-id].[region].aws.clickhouse.cloud \
  -e CLICKHOUSE_PORT=8443 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=[your-cloud-password] \
  -e CLICKHOUSE_SECURE=true \
  -e CLICKHOUSE_DATABASE=pipes \
  -- clickhouse-cloud /path/to/.local/bin/mcp-clickhouse
```

**Note**: Give the MCP server a different name (e.g., `clickhouse-cloud`) to distinguish it from local instance.

### Verify Cloud Connection

```bash
claude mcp list
# Should show: clickhouse-cloud: ... - ✓ Connected
```

### Usage (Same as Local)

```typescript
// List databases
list_databases()

// Query data
run_select_query({
  query: "SELECT COUNT(*) FROM pipes.swaps"
})
```

### Switching Between Local and Cloud

If you work with both local and cloud instances:

```bash
# List all MCP servers
claude mcp list

# Remove one to activate the other
claude mcp remove clickhouse        # Remove local
claude mcp remove clickhouse-cloud  # Remove cloud

# Add back the one you need
# (use installation commands above)
```
```

---

### Improvement 5: Add Table Name Validation to Indexer Code Writer

**File**: `.claude/agents/indexer-code-writer.md`

**Add to "Pre-Generation Validation" section**:

```markdown
#### 4. Table Name Consistency Validation

Before writing indexer code, verify table names match between schema and code:

```bash
# Extract table names from migration files
grep "CREATE TABLE" migrations/*.sql | awk '{print $3}' > /tmp/schema_tables.txt

# Check if code references match (search common locations)
grep -r "INSERT INTO\|FROM\|DELETE FROM" src/ | \
  grep -oE "FROM [a-z_]+" | awk '{print $2}' | sort -u > /tmp/code_tables.txt

# Compare
diff /tmp/schema_tables.txt /tmp/code_tables.txt
# If differences found, STOP and fix naming
```

**Common naming mismatches**:
- Schema: `swaps` | Code references: `uniswap_v3_swaps`
- Schema: `pools` | Code references: `uniswap_v3_pools`
- Schema: `created_at_block` | Code references: `created_at_block_number`

**Prevention**:
- Use table names exactly as defined in migrations
- Avoid protocol-specific prefixes unless in schema
- Validate before running indexer
```

---

### Improvement 6: Create Analytics Templates

**New File**: `.claude/templates/analytics/dashboard-queries-template.sql`

```sql
-- ============================================================================
-- PROTOCOL ANALYTICS DASHBOARD QUERIES
-- ============================================================================
-- Project: {{PROJECT_NAME}}
-- Protocol: {{PROTOCOL_NAME}}
-- Chain: {{CHAIN_NAME}}
-- Generated: {{DATE}}

-- ============================================================================
-- 1. PROTOCOL OVERVIEW
-- ============================================================================

-- Total Stats
SELECT
    COUNT(*) as total_events,
    COUNT(DISTINCT {{ENTITY_FIELD}}) as unique_entities,
    MIN(block_timestamp) as first_event,
    MAX(block_timestamp) as last_event,
    MAX(block_number) as latest_block
FROM {{DATABASE}}.{{TABLE_NAME}};

-- ============================================================================
-- 2. TIME SERIES METRICS
-- ============================================================================

-- Daily Activity (Last 30 Days)
SELECT
    toDate(block_timestamp) as date,
    COUNT(*) as event_count,
    COUNT(DISTINCT {{ENTITY_FIELD}}) as unique_entities,
    SUM({{VALUE_FIELD}}) as total_value
FROM {{DATABASE}}.{{TABLE_NAME}}
WHERE block_timestamp >= now() - INTERVAL 30 DAY
GROUP BY date
ORDER BY date DESC;

-- Hourly Activity (Last 24 Hours)
SELECT
    toStartOfHour(block_timestamp) as hour,
    COUNT(*) as event_count,
    AVG({{VALUE_FIELD}}) as avg_value
FROM {{DATABASE}}.{{TABLE_NAME}}
WHERE block_timestamp >= now() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour DESC;

-- ============================================================================
-- 3. TOP ENTITIES
-- ============================================================================

-- Top 20 by Activity (24h)
SELECT
    {{ENTITY_FIELD}},
    COUNT(*) as events_24h,
    SUM({{VALUE_FIELD}}) as total_value_24h
FROM {{DATABASE}}.{{TABLE_NAME}}
WHERE block_timestamp >= now() - INTERVAL 24 HOUR
GROUP BY {{ENTITY_FIELD}}
ORDER BY total_value_24h DESC
LIMIT 20;

-- Top 20 by Activity (All Time)
SELECT
    {{ENTITY_FIELD}},
    COUNT(*) as total_events,
    SUM({{VALUE_FIELD}}) as total_value
FROM {{DATABASE}}.{{TABLE_NAME}}
GROUP BY {{ENTITY_FIELD}}
ORDER BY total_value DESC
LIMIT 20;

-- ============================================================================
-- 4. RECENT ACTIVITY
-- ============================================================================

-- Latest 100 Events
SELECT
    block_timestamp,
    block_number,
    {{ENTITY_FIELD}},
    {{VALUE_FIELD}},
    tx_hash
FROM {{DATABASE}}.{{TABLE_NAME}}
ORDER BY block_timestamp DESC
LIMIT 100;

-- Large Events (>{{THRESHOLD}})
SELECT
    block_timestamp,
    {{ENTITY_FIELD}},
    {{VALUE_FIELD}},
    tx_hash
FROM {{DATABASE}}.{{TABLE_NAME}}
WHERE {{VALUE_FIELD}} > {{THRESHOLD}}
ORDER BY {{VALUE_FIELD}} DESC
LIMIT 50;

-- ============================================================================
-- 5. DATA QUALITY CHECKS
-- ============================================================================

-- Check for NULL values
SELECT
    countIf({{ENTITY_FIELD}} IS NULL) as null_entities,
    countIf({{VALUE_FIELD}} IS NULL) as null_values,
    countIf(tx_hash IS NULL) as null_hashes
FROM {{DATABASE}}.{{TABLE_NAME}};

-- Check block range
SELECT
    MIN(block_number) as first_block,
    MAX(block_number) as last_block,
    MAX(block_number) - MIN(block_number) as block_range
FROM {{DATABASE}}.{{TABLE_NAME}};

-- Check for duplicate events (potential bug)
SELECT
    tx_hash,
    log_index,
    COUNT(*) as duplicates
FROM {{DATABASE}}.{{TABLE_NAME}}
GROUP BY tx_hash, log_index
HAVING duplicates > 1;
```

---

### Improvement 7: Add Troubleshooting for Cloud-Specific Issues

**File**: `.claude/docs/references/TROUBLESHOOTING.md`

**Add new section**:

```markdown
## ClickHouse Cloud Issues

### Authentication Failed with Cloud Instance

**Error**: `Code: 516. DB::Exception: Authentication failed`

**Solutions**:
1. Verify you're using the actual Cloud password, not "default" or "password"
2. Check the .env file has correct credentials
3. Test connection manually:
   ```bash
   curl -X POST "https://[your-service].clickhouse.cloud:8443/" \
     --user "default:[your-password]" \
     -d "SELECT 1"
   ```

### Database Does Not Exist on Cloud

**Error**: `Code: 81. DB::Exception: Database pipes does not exist`

**Solution**: Create the database manually (migrations don't create databases):

**Option 1**: ClickHouse Cloud SQL Console
```sql
CREATE DATABASE IF NOT EXISTS pipes;
```

**Option 2**: Using curl
```bash
curl -X POST "https://[your-service].clickhouse.cloud:8443/" \
  --user "default:[password]" \
  -d "CREATE DATABASE IF NOT EXISTS pipes"
```

### Connection Timeout to Cloud

**Error**: `Error: connect ETIMEDOUT`

**Solutions**:
1. Check firewall/VPN settings
2. Verify ClickHouse Cloud service is running (check console)
3. Ensure URL is correct with HTTPS and port 8443
4. Check IP allowlist in Cloud console (if configured)

### SSL/TLS Certificate Errors

**Error**: `certificate verify failed`

**Solutions**:
1. ClickHouse Cloud requires SSL - ensure your client supports HTTPS
2. Verify CLICKHOUSE_URL uses `https://` not `http://`
3. Update client library if outdated

### Table Already Exists on Shared Cloud Service

**Error**: `Code: 57. DB::Exception: Table pipes.swaps already exists`

**Context**: When deploying multiple indexers to same Cloud database.

**Solutions**:
1. Use different table names for each indexer
2. Drop existing tables if starting fresh:
   ```sql
   DROP TABLE IF EXISTS pipes.swaps;
   DROP TABLE IF EXISTS pipes.mints;
   -- etc.
   ```
3. Use separate databases for each indexer:
   ```sql
   CREATE DATABASE IF NOT EXISTS uniswap_base;
   CREATE DATABASE IF NOT EXISTS morpho_eth;
   ```
```

---

## Implementation Priority

### High Priority (Immediate)

1. **CLICKHOUSE_CLOUD_DEPLOYMENT.md** - Already created
2. **Update /new-indexer command** - Add Cloud deployment section
3. **Update CLICKHOUSE_MCP_USAGE.md** - Add Cloud configuration

### Medium Priority (Next Week)

4. **Add analytics workflow section** - Update INDEXER_WORKFLOW.md
5. **Add table name validation** - Update indexer-code-writer agent
6. **Create analytics query templates** - New template file

### Low Priority (Future)

7. **Add Cloud troubleshooting** - Update TROUBLESHOOTING.md
8. **Create dashboard examples** - Reference implementations

---

## Testing Plan

### Test 1: Deploy New Indexer to ClickHouse Cloud

1. Create test indexer using `/new-indexer`
2. Follow updated Cloud deployment instructions
3. Verify:
   - Database creation works
   - Connection successful
   - Tables created correctly
   - Data syncs properly

### Test 2: Validate MCP Cloud Configuration

1. Configure MCP for Cloud instance
2. Test all MCP tools (list_databases, list_tables, run_select_query)
3. Verify queries work correctly
4. Test switching between local/cloud

### Test 3: Generate Analytics Queries

1. Use template to generate queries for test protocol
2. Run queries in ClickHouse Cloud SQL Console
3. Create sample charts
4. Verify query performance

---

## Documentation Updates Checklist

- [x] Create CLICKHOUSE_CLOUD_DEPLOYMENT.md (completed)
- [ ] Update /new-indexer command with Cloud section
- [ ] Update CLICKHOUSE_MCP_USAGE.md with Cloud config
- [ ] Add Step 8 (Analytics) to INDEXER_WORKFLOW.md
- [ ] Add table name validation to indexer-code-writer agent
- [ ] Create dashboard-queries-template.sql
- [ ] Update TROUBLESHOOTING.md with Cloud issues
- [ ] Create example dashboard in base-uniswap-swaps (done)

---

## Success Metrics

### Documentation Quality
- [ ] New user can deploy to Cloud without errors
- [ ] Common issues are documented and solvable
- [ ] Analytics setup is clear and reproducible

### Workflow Efficiency
- [ ] Cloud deployment time < 10 minutes
- [ ] Zero manual intervention after initial config
- [ ] Analytics queries generated automatically

### Error Reduction
- [ ] Zero "database doesn't exist" errors
- [ ] Zero table name mismatch errors
- [ ] Zero authentication errors with proper setup

---

## Related Files

**Created in this session**:
- `/path/to/base-uniswap-swaps/CLICKHOUSE_CLOUD_DEPLOYMENT.md`
- `/path/to/base-uniswap-swaps/queries/dashboard-queries.sql`
- `/path/to/base-uniswap-swaps/DASHBOARD_SETUP.md`

**Files to update**:
- `.claude/commands/new-indexer.md`
- `.claude/docs/CLICKHOUSE_MCP_USAGE.md`
- `.claude/docs/INDEXER_WORKFLOW.md`
- `.claude/agents/indexer-code-writer.md`
- `.claude/docs/references/TROUBLESHOOTING.md`

**New files to create**:
- `.claude/templates/analytics/dashboard-queries-template.sql`
- `.claude/templates/analytics/DASHBOARD_SETUP_TEMPLATE.md`

---

## Appendix: Key Configuration Examples

### Example 1: .env for ClickHouse Cloud

```env
CLICKHOUSE_URL=https://a1so4qh9pg.eu-west-1.aws.clickhouse.cloud:8443
CLICKHOUSE_DATABASE=pipes
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=~Rfs8HoRZYAR.
```

### Example 2: MCP Cloud Configuration

```bash
claude mcp add -t stdio \
  -e CLICKHOUSE_HOST=a1so4qh9pg.eu-west-1.aws.clickhouse.cloud \
  -e CLICKHOUSE_PORT=8443 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=~Rfs8HoRZYAR. \
  -e CLICKHOUSE_SECURE=true \
  -e CLICKHOUSE_DATABASE=pipes \
  -- clickhouse-cloud /path/to/.local/bin/mcp-clickhouse
```

### Example 3: Database Creation (curl)

```bash
curl -X POST "https://a1so4qh9pg.eu-west-1.aws.clickhouse.cloud:8443/" \
  --user "default:~Rfs8HoRZYAR." \
  -d "CREATE DATABASE IF NOT EXISTS pipes"
```

---

**Document Version**: 1.0
**Date**: 2025-02-03
**Author**: Based on base-uniswap-swaps deployment experience
**Status**: Ready for review and implementation
