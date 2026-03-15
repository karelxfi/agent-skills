# Portal Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

6 skills for AI coding agents working with [SQD Portal](https://portal.sqd.dev) - query blockchain data across 210+ chains without infrastructure.

## Installation

**Install all Portal skills:**
```bash
npx skills add subsquid-labs/agent-skills/portal --all
```

**Or install selectively:**
```bash
npx skills add subsquid-labs/agent-skills/portal
```

## Available Skills

| Skill | Use Case | Category |
|-------|----------|----------|
| **portal-dataset-discovery** | Find and verify correct dataset names for blockchain queries | Core |
| **portal-query-evm-logs** | Query EVM event logs with topic filtering for token transfers and DeFi events | Core |
| **portal-query-evm-transactions** | Query EVM transactions by sender, recipient, or function selector | Core |
| **portal-query-evm-traces** | Query internal transactions, contract deployments, and delegatecall patterns | Advanced |
| **portal-query-solana-instructions** | Query Solana program instructions with discriminator and account filters | Core |
| **portal-query-hyperliquid-fills** | Query Hyperliquid trade fills with coin, user, and side filters | Core |

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**
```
Query all USDC transfers on Base between blocks 10M-11M
```
```
Find all contracts deployed by 0x123... on Ethereum
```
```
Track Jupiter swap instructions on Solana
```
```
Analyze BTC trading fills on Hyperliquid
```

## Skill Structure

Each skill contains:

- `SKILL.md` - Instructions for the agent
- YAML frontmatter with metadata
- Real-world query examples
- Performance guidance

## Resources

- **Portal API (EVM):** [beta.docs.sqd.dev/en/api/catalog/evm/openapi.yaml](https://beta.docs.sqd.dev/en/api/catalog/evm/openapi.yaml)
- **Portal API (Solana):** [beta.docs.sqd.dev/en/api/catalog/solana/openapi.yaml](https://beta.docs.sqd.dev/en/api/catalog/solana/openapi.yaml)
- **Portal API (Hyperliquid Fills):** [beta.docs.sqd.dev/en/api/catalog/hyperliquid-fills/openapi.yaml](https://beta.docs.sqd.dev/en/api/catalog/hyperliquid-fills/openapi.yaml)
- **AI Development:** [beta.docs.sqd.dev/en/ai/ai-development](https://beta.docs.sqd.dev/en/ai/ai-development)

## License

MIT
