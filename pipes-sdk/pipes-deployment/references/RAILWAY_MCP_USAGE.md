# Railway MCP Usage Guide

**Date**: 2025-02-03
**Status**: Production Ready

---

## Overview

The Railway MCP server provides tools to interact with Railway services directly from Claude Code. This allows you to manage deployments, check logs, monitor status, and configure services without leaving the development environment.

## Installation

Railway MCP server is already installed in your Claude Code configuration:

```bash
# Installed via:
claude mcp add railway-mcp-server -- npx -y @railway/mcp-server
```

**To activate**: Restart Claude Code after installation.

## Authentication

Railway MCP requires authentication. Set one of these environment variables:

### Option 1: Project Token (Recommended)

```bash
export RAILWAY_TOKEN=your-project-token-here
```

**Best for**: Single project access, CI/CD pipelines

**Get from**: Railway Project Settings → Tokens

### Option 2: API Token

```bash
export RAILWAY_API_TOKEN=your-api-token-here
```

**Best for**: Multiple projects, team access

**Get from**: https://railway.app/account/tokens

### Verify Authentication

```bash
railway whoami
```

## Available MCP Tools

After restarting Claude Code, Railway MCP provides these tools:

### 1. Project Management

**List Projects**:
```
mcp__railway__list_projects()
```

**Get Project Details**:
```
mcp__railway__get_project(project_id)
```

**Create Project**:
```
mcp__railway__create_project(name, description)
```

### 2. Service Management

**List Services**:
```
mcp__railway__list_services(project_id)
```

**Get Service Details**:
```
mcp__railway__get_service(service_id)
```

**Deploy Service**:
```
mcp__railway__deploy_service(service_id)
```

**Restart Service**:
```
mcp__railway__restart_service(service_id)
```

### 3. Environment Variables

**List Variables**:
```
mcp__railway__list_variables(service_id)
```

**Set Variable**:
```
mcp__railway__set_variable(service_id, key, value)
```

**Delete Variable**:
```
mcp__railway__delete_variable(service_id, key)
```

### 4. Logs & Monitoring

**Get Logs**:
```
mcp__railway__get_logs(service_id, limit=100)
```

**Stream Logs** (real-time):
```
mcp__railway__stream_logs(service_id)
```

**Get Metrics**:
```
mcp__railway__get_metrics(service_id)
```

### 5. Deployments

**List Deployments**:
```
mcp__railway__list_deployments(service_id)
```

**Get Deployment Status**:
```
mcp__railway__get_deployment(deployment_id)
```

**Rollback Deployment**:
```
mcp__railway__rollback(deployment_id)
```

## Common Usage Patterns

### Pattern 1: Check Deployment Status

```python
# Get project
projects = mcp__railway__list_projects()
project_id = projects[0]['id']

# Get services
services = mcp__railway__list_services(project_id)
service_id = services[0]['id']

# Check status
status = mcp__railway__get_service(service_id)
print(f"Status: {status['status']}")

# Get recent logs
logs = mcp__railway__get_logs(service_id, limit=50)
print(logs)
```

### Pattern 2: Update Environment Variables

```python
# Set ClickHouse connection string
mcp__railway__set_variable(
    service_id,
    "CLICKHOUSE_URL",
    "https://xxx.clickhouse.cloud:8443"
)

# Set password
mcp__railway__set_variable(
    service_id,
    "CLICKHOUSE_PASSWORD",
    "your-password"
)

# Restart service to apply changes
mcp__railway__restart_service(service_id)
```

### Pattern 3: Monitor Indexer Progress

```python
# Get latest logs
logs = mcp__railway__get_logs(service_id, limit=100)

# Filter for sync progress
sync_logs = [log for log in logs if "Synced to block" in log]
print(sync_logs[-5:])  # Last 5 sync events

# Get metrics
metrics = mcp__railway__get_metrics(service_id)
print(f"CPU: {metrics['cpu']}%")
print(f"Memory: {metrics['memory']} MB")
```

### Pattern 4: Troubleshoot Deployment

```python
# Get deployment history
deployments = mcp__railway__list_deployments(service_id)

# Get latest deployment
latest = deployments[0]
print(f"Status: {latest['status']}")
print(f"Created: {latest['created_at']}")

# If failed, get logs
if latest['status'] == 'FAILED':
    logs = mcp__railway__get_logs(service_id, limit=200)
    errors = [log for log in logs if 'error' in log.lower()]
    print("Errors found:")
    for error in errors:
        print(error)
```

## Integration with Deployment Workflow

### During Deployment

Use Railway MCP alongside deployment agent:

```bash
# 1. Deploy via agent
/deploy-railway my-indexer

# 2. Monitor via MCP
# (After Claude Code restart)
mcp__railway__get_service(service_id)
mcp__railway__stream_logs(service_id)
```

### Post-Deployment Monitoring

```python
# Create monitoring script
def monitor_indexer(service_id):
    """Monitor Railway service health"""

    # Get service status
    service = mcp__railway__get_service(service_id)
    print(f"Service: {service['name']}")
    print(f"Status: {service['status']}")

    # Get metrics
    metrics = mcp__railway__get_metrics(service_id)
    print(f"CPU: {metrics['cpu']}%")
    print(f"Memory: {metrics['memory']} MB")

    # Check recent logs for errors
    logs = mcp__railway__get_logs(service_id, limit=100)
    errors = [log for log in logs if 'error' in log.lower()]

    if errors:
        print(f"\n{len(errors)} errors found:")
        for error in errors[-5:]:  # Show last 5
            print(error)
    else:
        print("\nNo errors in recent logs")

    return {
        'status': service['status'],
        'cpu': metrics['cpu'],
        'memory': metrics['memory'],
        'errors': len(errors)
    }

# Use it
monitor_indexer('your-service-id')
```

## Combining Railway MCP + ClickHouse MCP

Monitor both Railway service and ClickHouse data:

```python
def full_indexer_status(railway_service_id, ch_database, ch_table):
    """Get complete indexer status"""

    # Railway service health
    service = mcp__railway__get_service(railway_service_id)
    logs = mcp__railway__get_logs(railway_service_id, limit=50)

    # ClickHouse data status
    query = f"""
    SELECT
        COUNT(*) as events,
        MAX(block_number) as latest_block,
        now() - MAX(block_timestamp) as time_behind
    FROM {ch_database}.{ch_table}
    """
    ch_data = mcp__clickhouse__run_select_query(query)

    return {
        'railway': {
            'status': service['status'],
            'logs': logs[-5:]  # Last 5 logs
        },
        'clickhouse': {
            'events': ch_data['events'],
            'latest_block': ch_data['latest_block'],
            'time_behind': ch_data['time_behind']
        }
    }

# Use it
status = full_indexer_status(
    railway_service_id='xxx',
    ch_database='pipes',
    ch_table='swaps'
)
```

## Best Practices

### 1. Use Project Tokens for Specific Projects

```bash
# For production project
export RAILWAY_TOKEN=prod-project-token
mcp__railway__get_service(prod_service_id)

# For staging project
export RAILWAY_TOKEN=staging-project-token
mcp__railway__get_service(staging_service_id)
```

### 2. Monitor Regularly

Create a monitoring task:

```python
# Check every hour
import time

def monitor_loop(service_id, interval=3600):
    while True:
        status = monitor_indexer(service_id)

        if status['errors'] > 10:
            print("Too many errors - investigate!")

        if status['cpu'] > 90:
            print("High CPU usage - may need to scale!")

        time.sleep(interval)
```

### 3. Set Variables Carefully

```python
# DON'T: Set sensitive data in plain text
mcp__railway__set_variable(service_id, "PASSWORD", "mypassword")  #

# DO: Use Railway's built-in secrets
# Set via Railway dashboard (encrypted at rest)
```

### 4. Review Logs Before Rollback

```python
# Always check what went wrong before rolling back
logs = mcp__railway__get_logs(service_id, limit=500)
errors = [log for log in logs if 'error' in log.lower()]

# Analyze errors
print(f"Found {len(errors)} errors")
for error in errors[:10]:
    print(error)

# Only rollback if needed
if serious_error_detected:
    deployments = mcp__railway__list_deployments(service_id)
    previous = deployments[1]  # Previous deployment
    mcp__railway__rollback(previous['id'])
```

## Troubleshooting

### MCP Tools Not Available

**Issue**: Railway MCP functions not found

**Solution**:
1. Verify installation:
   ```bash
   cat ~/.claude.json | grep railway
   ```

2. Restart Claude Code completely

3. Check authentication:
   ```bash
   echo $RAILWAY_TOKEN
   # OR
   echo $RAILWAY_API_TOKEN
   ```

### Authentication Errors

**Issue**: "Unauthorized" errors

**Solution**:
```bash
# Verify token is valid
railway whoami

# If not, re-login
railway login

# Or set new token
export RAILWAY_TOKEN=new-token
```

### Can't Find Service ID

**Issue**: Don't know service ID

**Solution**:
```python
# List all projects
projects = mcp__railway__list_projects()
for project in projects:
    print(f"{project['name']}: {project['id']}")

# Get services for a project
services = mcp__railway__list_services(project_id)
for service in services:
    print(f"{service['name']}: {service['id']}")
```

### Logs Not Showing Recent Data

**Issue**: Logs seem delayed

**Solution**:
```python
# Use streaming logs for real-time
mcp__railway__stream_logs(service_id)

# OR increase limit
logs = mcp__railway__get_logs(service_id, limit=1000)
```

## Railway MCP + Deployment Agents

How Railway MCP complements deployment agents:

| Task | Use Agent | Use MCP |
|------|-----------|---------|
| **Initial Deployment** | `/deploy-railway` | |
| **Check Status** | | `get_service()` |
| **View Logs** | | `get_logs()` |
| **Update Variables** | | `set_variable()` |
| **Restart Service** | | `restart_service()` |
| **Rollback** | | `rollback()` |
| **Full Redeploy** | `/deploy-railway` | |

**Pattern**: Use agent for deployment, MCP for management.

## Example: Complete Monitoring Dashboard

Create a monitoring dashboard using Railway + ClickHouse MCP:

```python
def create_dashboard(railway_service_id, ch_database):
    """Complete monitoring dashboard"""

    print("=" * 60)
    print("INDEXER MONITORING DASHBOARD")
    print("=" * 60)

    # Railway Service Health
    print("\n Railway Service")
    print("-" * 60)
    service = mcp__railway__get_service(railway_service_id)
    metrics = mcp__railway__get_metrics(railway_service_id)

    print(f"Status: {service['status']}")
    print(f"CPU: {metrics['cpu']}%")
    print(f"Memory: {metrics['memory']} MB")
    print(f"Restarts: {service['restart_count']}")

    # ClickHouse Data Health
    print("\n💾 ClickHouse Data")
    print("-" * 60)

    # Get row counts
    tables_query = f"SHOW TABLES FROM {ch_database}"
    tables = mcp__clickhouse__run_select_query(tables_query)

    for table in tables:
        count_query = f"SELECT COUNT(*) as count FROM {ch_database}.{table}"
        result = mcp__clickhouse__run_select_query(count_query)
        print(f"{table}: {result['count']:,} rows")

    # Sync Status
    print("\n🔄 Sync Status")
    print("-" * 60)

    sync_query = f"""
    SELECT
        MAX(block_number) as latest_block,
        MAX(block_timestamp) as latest_timestamp,
        now() - MAX(block_timestamp) as time_behind
    FROM {ch_database}.swaps
    """
    sync_data = mcp__clickhouse__run_select_query(sync_query)

    print(f"Latest Block: {sync_data['latest_block']:,}")
    print(f"Latest Timestamp: {sync_data['latest_timestamp']}")
    print(f"Time Behind: {sync_data['time_behind']}")

    # Recent Errors
    print("\nRecent Errors")
    print("-" * 60)

    logs = mcp__railway__get_logs(railway_service_id, limit=500)
    errors = [log for log in logs if 'error' in log.lower()]

    if errors:
        print(f"Found {len(errors)} errors in last 500 logs")
        print("\nMost recent:")
        for error in errors[-3:]:
            print(f"  - {error}")
    else:
        print("No errors found")

    print("\n" + "=" * 60)

# Run it
create_dashboard(
    railway_service_id='your-service-id',
    ch_database='pipes'
)
```

## Related Documentation

- `.claude/agents/railway-deployer.md` - Deployment agent
- `.claude/commands/deploy-railway.md` - Deployment command
- `.claude/docs/CLICKHOUSE_MCP_USAGE.md` - ClickHouse MCP
- Railway MCP Server: https://github.com/railway/mcp-server

## Quick Reference

```python
# Get service status
mcp__railway__get_service(service_id)

# View logs
mcp__railway__get_logs(service_id, limit=100)

# Stream logs (real-time)
mcp__railway__stream_logs(service_id)

# Set environment variable
mcp__railway__set_variable(service_id, "KEY", "value")

# Restart service
mcp__railway__restart_service(service_id)

# Get metrics
mcp__railway__get_metrics(service_id)

# Rollback deployment
deployments = mcp__railway__list_deployments(service_id)
mcp__railway__rollback(deployments[1]['id'])
```

---

**Document Version**: 1.0
**Last Updated**: 2025-02-03
**Status**: Production Ready
