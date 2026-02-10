# Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

A collection of 21 skills for AI coding agents working with blockchain indexers. Skills extend agent capabilities for building, deploying, and optimizing indexers with the [Pipes SDK](https://github.com/subsquid-labs/pipes-sdk).

Skills follow the [Agent Skills](https://agentskills.io/) format.

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

## Installation

```bash
npx skills add subsquid-labs/agent-skills
```

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
- **Agent Skills Format**: [agentskills.io](https://agentskills.io/)
- **ClickHouse MCP**: [https://github.com/ClickHouse/mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse)
- **ClickHouse Cloud MCP**: [clickhouse.com/docs/use-cases/AI/MCP/remote_mcp](https://clickhouse.com/docs/use-cases/AI/MCP/remote_mcp)
- **Railway MCP**: [https://github.com/railway/mcp-server](https://github.com/railway/mcp-server)

## License

MIT
