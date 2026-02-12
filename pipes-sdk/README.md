# Pipes SDK Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

12 skills for AI coding agents working with the [Pipes SDK](https://github.com/subsquid-labs/pipes-sdk) - a lightweight TypeScript framework for building blockchain indexers.

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
| **pipes-new-indexer** | Create blockchain indexer projects using the Pipes CLI with templates for EVM and Solana chains |
| **pipes-orchestrator** | Routes indexer requests to specialized agents and coordinates multi-agent workflows |
| **pipes-troubleshooting** | Diagnose and fix runtime errors in blockchain indexers |
| **pipes-performance** | Analyze and optimize indexer sync performance |
| **pipes-abi** | Fetch, analyze, and manage contract ABIs for EVM chains |

### Deployment Skills

| Skill | Use Case |
|-------|----------|
| **pipes-deploy-clickhouse-cloud** | Deploy indexers to ClickHouse Cloud with production configuration |
| **pipes-deploy-clickhouse-local** | Deploy indexers to local ClickHouse (Docker) for development |
| **pipes-deployment** | Complete deployment guides for all platforms (ClickHouse Cloud, local, Railway) |

### Schema Design

| Skill | Use Case |
|-------|----------|
| **pipes-schema-design** | Design optimal database schemas for blockchain data (ClickHouse and PostgreSQL) |

### Templates for AI agents to use

| Skill | Use Case |
|-------|----------|
| **pipes-template-dex-swaps** | Production template for DEX swap indexing (Uniswap, SushiSwap, PancakeSwap) |
| **pipes-template-nft-transfers** | Production template for tracking NFT transfers (ERC-721) |
| **pipes-template-lending-protocol** | Production template for lending protocols (Aave V3, Compound V3, Morpho) |

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Example prompts:**
- "Create a new indexer for USDC transfers on Ethereum"
- "My indexer is syncing slowly, help me optimize it"
- "Deploy my indexer to ClickHouse Cloud"
- "Get the ABI for the Uniswap V3 router"
- "Design a schema for tracking Aave V3 lending events"

## Quick Start

1. **Create a new indexer:**
   ```
   Create a DEX swap indexer for Uniswap V3 on Base
   ```
   Uses: `pipes-new-indexer`, `pipes-template-dex-swaps`

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
   Uses: `pipes-deploy-clickhouse-cloud`

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
