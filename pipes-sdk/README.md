# Pipes SDK Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

21 skills for AI coding agents working with the [Pipes SDK](https://github.com/subsquid-labs/pipes-sdk) - a lightweight TypeScript framework for building blockchain indexers.

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

| Skill | Use Case | Category |
|-------|----------|----------|
| **pipes-new-indexer** | Create blockchain indexer projects using the Pipes CLI with templates for EVM and Solana chains | Core |
| **pipes-orchestrator** | Routes indexer requests to specialized agents and coordinates multi-agent workflows | Core |
| **pipes-troubleshooting** | Diagnose and fix runtime errors in blockchain indexers | Core |
| **pipes-performance** | Analyze and optimize indexer sync performance | Core |
| **pipes-validation** | Validate indexed data quality and completeness | Core |
| **pipes-workflow** | Core 7-step workflow for creating indexers | Documentation |
| **pipes-deploy-clickhouse-cloud** | Deploy indexers to ClickHouse Cloud | Deployment |
| **pipes-deploy-clickhouse-local** | Deploy indexers to local ClickHouse (Docker) | Deployment |
| **pipes-deploy-railway** | Deploy indexers to Railway platform | Deployment |
| **pipes-abi** | Fetch, analyze, and manage contract ABIs | Research |
| **pipes-schema-design** | Design optimal database schemas for blockchain data | Research |
| **pipes-research-protocol** | Research DeFi protocols and propose indexer data structures | Research |
| **pipes-find-contracts** | Find verified contract addresses using addybook.xyz registry and web search | Research |
| **pipes-template-dex-swaps** | Template for DEX swap indexing with Uniswap, SushiSwap, and other AMM protocols | Template |
| **pipes-template-nft-transfers** | Template for tracking NFT transfers (ERC-721, ERC-1155) | Template |
| **pipes-template-liquid-staking** | Template for liquid staking protocols (Lido, Rocket Pool, Frax) | Template |
| **pipes-template-erc4626-vaults** | Template for ERC-4626 vault activity | Template |
| **pipes-template-lending-protocol** | Template for lending protocol events (Aave, Compound, Morpho) | Template |
| **pipes-check-setup** | Verify development environment setup | Core |
| **pipes-deployment** | Complete deployment guides for all platforms | Documentation |
| **pipes-patterns** | Blockchain indexing patterns and best practices | Documentation |

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**
```
Create a new indexer for USDC transfers on Ethereum
```
```
My indexer is syncing slowly, help me optimize it
```
```
Deploy my indexer to ClickHouse Cloud
```

## Skill Structure

Each skill contains:

- `SKILL.md` - Instructions for the agent
- `scripts/` - Helper scripts for automation (optional)
- `references/` - Supporting documentation (optional)

## Resources

- **Pipes SDK**: [github.com/subsquid-labs/pipes-sdk](https://github.com/subsquid-labs/pipes-sdk)
- **SQD Documentation**: [beta.docs.sqd.dev](https://beta.docs.sqd.dev)
- **ClickHouse MCP**: [github.com/ClickHouse/mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse)
- **ClickHouse Cloud MCP**: [clickhouse.com/docs/use-cases/AI/MCP/remote_mcp](https://clickhouse.com/docs/use-cases/AI/MCP/remote_mcp)
- **Railway MCP**: [docs.railway.com/ai/mcp-server](https://docs.railway.com/ai/mcp-server)

## License

MIT
