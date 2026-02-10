---
name: pipes-check-setup
description: Verify development environment setup for Subsquid indexers. Checks Node.js, Docker, databases, and SDK installation.
allowed-tools: [Bash, Read]
metadata:
  author: subsquid
  version: "1.0.0"
  category: core
---

# Pipes: Check Setup

Verify your development environment is correctly configured for building Subsquid indexers.

## When to Use This Skill

Activate when:
- Setting up a new development environment
- User encounters environment-related errors
- Before starting a new indexer project
- After installing new tools or dependencies
- User asks "is my setup correct?" or "do I have everything installed?"

## Prerequisites Check

Run through these checks systematically and report what's working or missing.

### 1. Node.js Version
```bash
node --version
```
**Required:** >= 18.0.0

### 2. npm/npx/bun Version
```bash
npm --version
npx --version
# or
bun --version
```
**Required:** npm >= 8.0.0 (includes npx) or bun >= 1.0.0

### 3. Docker Availability
```bash
docker --version
docker ps
```
**Required:** Docker Desktop or Docker Engine running

### 4. Database Containers

**Check ClickHouse:**
```bash
docker ps | grep clickhouse
# If not running, start it:
# docker run -d --name clickhouse -p 8123:8123 clickhouse/clickhouse-server
```

**Check PostgreSQL:**
```bash
docker ps | grep postgres
# If not running, start it:
# docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
```

### 5. Pipes CLI Availability
```bash
npx @iankressin/pipes-cli@latest --version
```
**Required:** Should download and run successfully

**Note:** No local installation needed - CLI is used via npx

### 6. TypeScript Setup
```bash
npx tsc --version
```
**Required:** >= 5.0.0

### 7. Test Portal API Access
```bash
curl -X POST https://v2.archive.subsquid.io/query/ethereum-mainnet \
  -H "Content-Type: application/json" \
  -d '{"fromBlock":18000000,"toBlock":18000001,"logs":[],"fields":{"block":{"number":true}}}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Expected:** HTTP Status 200 with JSON response

## Setup Recommendations

After running checks, provide specific recommendations:

### If Node.js is missing or old:
- Install from: https://nodejs.org/
- Recommend using nvm: https://github.com/nvm-sh/nvm

### If Docker is not running:
- Install Docker Desktop: https://www.docker.com/products/docker-desktop
- Or install Docker Engine on Linux

### If databases are not running:
Provide the exact commands to start them:
```bash
# ClickHouse
docker run -d --name clickhouse -p 8123:8123 clickhouse/clickhouse-server

# PostgreSQL
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
```

### If testing CLI access:
```bash
# Test that npx can download and run the CLI
npx @iankressin/pipes-cli@latest --help

# Or use bun
bunx @iankressin/pipes-cli@latest --help
```

## Project-Specific Checks

If the user is in an existing indexer project:

### 1. Check package.json dependencies
```bash
cat package.json | grep -A 10 '"dependencies"'
```

### 2. Check for src/main.ts or src/index.ts
```bash
ls -l src/main.ts src/index.ts 2>/dev/null
```

### 3. Check for generated ABIs
```bash
ls -l src/contracts/
```

### 4. Try building the project
```bash
npm run build || npx tsc
```

### 5. Check for .env file
```bash
ls -la .env
```

## Report Format

Provide a clear summary:

```
Node.js: v20.11.0 (OK)
Docker: Running (OK)
ClickHouse: Container running on port 8123 (OK)
PostgreSQL: Not running (Optional)
Portal API: Accessible (OK)
TypeScript: v5.3.3 (OK)

Recommendations:
1. Consider starting PostgreSQL if you need relational queries
```

## Related Skills

- [pipes-new-indexer](../pipes-new-indexer/SKILL.md) - Create new indexer (after setup verified)
- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - If errors occur during setup
- [pipes-workflow](../pipes-workflow/SKILL.md) - Full workflow documentation
