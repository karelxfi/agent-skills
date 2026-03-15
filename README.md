# SQD Agent Skills

![Experimental](https://img.shields.io/badge/experimental-blue)

A collection of skills for AI coding agents working with SQD products. Skills extend agent capabilities for building, deploying, and optimizing blockchain indexers and data pipelines.

Skills follow the [Agent Skills](https://agentskills.io/) format.

## Products

### Pipes SDK (4 skills)

Lightweight TypeScript framework for building blockchain indexers.

**Install:**
```bash
npx skills add subsquid-labs/agent-skills/pipes-sdk --all
```

**Use cases:**
- Create EVM and Solana indexers
- Deploy to ClickHouse Cloud or Railway
- Optimize indexer performance
- Research protocols and design schemas

[**See Pipes skills →**](./pipes-sdk/README.md)

---

### Squid SDK (Coming Soon)

Production-grade blockchain indexing framework.

```bash
npx skills add subsquid-labs/agent-skills/squid-sdk --all
```

---

### Portal (6 skills)

Query and analyze blockchain data across 210+ chains without infrastructure.

**Install:**
```bash
npx skills add subsquid-labs/agent-skills/portal --all
```

[**See Portal skills →**](./portal/README.md)

---

## Install Everything

Install all skills across all products:

```bash
npx skills add subsquid-labs/agent-skills --all
```

## Resources

- **SQD**: [sqd.dev](https://sqd.dev)
- **Pipes SDK**: [github.com/subsquid-labs/pipes-sdk](https://github.com/subsquid-labs/pipes-sdk)
- **Squid SDK**: [https://github.com/subsquid/squid-sdk](https://github.com/subsquid/squid-sdk)
- **SQD Documentation**: [beta.docs.sqd.dev](https://beta.docs.sqd.dev)
- **Agent Skills Format**: [agentskills.io](https://agentskills.io/)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new skills.

## License

MIT
