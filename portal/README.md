# Portal Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

5 skills for AI coding agents working with [SQD Portal](https://portal.sqd.dev) - query blockchain data across 225+ chains without infrastructure.

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

## Skill Structure

Each skill contains:

- `SKILL.md` - Instructions for the agent
- YAML frontmatter with metadata
- Real-world query examples
- Performance guidance

## Resources

- **Portal API (EVM):** [beta.docs.sqd.dev/api/catalog/stream](https://beta.docs.sqd.dev/api/catalog/stream)
- **Portal API (Solana):** [beta.docs.sqd.dev/api/catalog/solana/stream](https://beta.docs.sqd.dev/api/catalog/solana/stream)
- **Schema Reference:** [github.com/subsquid/sqd-portal/blob/master/resources/schemas.json](https://github.com/subsquid/sqd-portal/blob/master/resources/schemas.json)

## License

MIT
