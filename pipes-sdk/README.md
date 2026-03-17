# Pipes SDK Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

4 skills for AI coding agents working with the [Pipes SDK](https://github.com/subsquid-labs/pipes-sdk) - a lightweight TypeScript framework for building blockchain indexers.

## Installation

**Install all Pipes skills:**
```bash
npx skills add subsquid-labs/agent-skills/pipes-sdk --all
```

**Or install selectively:**
```bash
npx skills add subsquid-labs/agent-skills/pipes-sdk
```

## Available Skills

### Core Skills

| Skill | Use Case |
|-------|----------|
| **pipes-new-indexer** | Create blockchain indexer projects using the Pipes CLI with templates for EVM, Solana, and Hyperliquid chains; includes ABI fetching, schema design, and protocol research guides |
| **pipes-troubleshooting** | Diagnose and fix runtime errors in blockchain indexers |
| **pipes-performance** | Analyze and optimize indexer sync performance |

### Deployment Skills

| Skill | Use Case |
|-------|----------|
| **pipes-deploy** | Deploy indexers to local ClickHouse (Docker) for development or ClickHouse Cloud for production |

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Example prompts:**
- "Create a new indexer for USDC transfers on Ethereum"
- "My indexer is syncing slowly, help me optimize it"
- "Deploy my indexer to ClickHouse Cloud"
- "Create an indexer for Uniswap V3 swaps - help me fetch the ABI and design the schema"
- "Track BTC/ETH/SOL perpetual futures trades on Hyperliquid"

## Quick Start

1. **Create a new indexer:**
   ```
   Create a DEX swap indexer for Uniswap V3 on Base
   ```
   Uses: `pipes-new-indexer`

2. **Debug issues:**
   ```
   My indexer shows "No data in database after 60 seconds"
   ```
   Uses: `pipes-troubleshooting`

3. **Optimize performance:**
   ```
   How can I make my indexer sync faster?
   ```
   Uses: `pipes-performance`

4. **Deploy to production:**
   ```
   Deploy my indexer to ClickHouse Cloud
   ```
   Uses: `pipes-deploy`

## Skill Structure

Each skill contains:

- `SKILL.md` - Instructions for the agent
- `templates/` - Extra templates for references (optional)
- `references/` - Supporting documentation (optional)

## Resources

### Pipes SDK
- **Repository**: [github.com/subsquid-labs/pipes-sdk](https://github.com/subsquid-labs/pipes-sdk)
- **CLI Package**: [@iankressin/pipes-cli](https://www.npmjs.com/package/@iankressin/pipes-cli)

### SQD Portal
- **Portal API**: [portal.sqd.dev](https://portal.sqd.dev)
- **Documentation**: [beta.docs.sqd.dev](https://beta.docs.sqd.dev)

### MCP Servers (Optional)
- **ClickHouse MCP**: [github.com/ClickHouse/mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse)
- **ClickHouse Cloud MCP**: [clickhouse.com/docs/use-cases/AI/MCP/remote_mcp](https://clickhouse.com/docs/use-cases/AI/MCP/remote_mcp)
- **Railway MCP**: [docs.railway.com/ai/mcp-server](https://docs.railway.com/ai/mcp-server)

## License

MIT
