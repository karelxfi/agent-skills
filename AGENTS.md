# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

## Repository Overview

A collection of skills for AI coding agents working with blockchain indexers. Skills extend agent capabilities for building, deploying, and optimizing indexers with the Pipes SDK.

## Creating a New Skill

### Directory Structure

```
skills/
  {skill-name}/           # kebab-case directory name
    SKILL.md              # Required: skill definition
    scripts/              # Optional: executable scripts
    references/           # Optional: supporting documentation
    templates/            # Optional: code templates
```

### Naming Conventions

- **Skill directory**: `kebab-case` with `pipes-` prefix (e.g., `pipes-new-indexer`, `pipes-deploy-railway`)
- **SKILL.md**: Always uppercase, always this exact filename
- **Scripts**: `kebab-case.sh` (e.g., `setup-database.sh`, `validate-abi.sh`)

### SKILL.md Format

```markdown
---
name: {skill-name}
description: {One sentence describing what the skill does and when to use it}
compatibility: {Optional: environment requirements}
allowed-tools: [{Optional: space-delimited list of pre-approved tools}]
metadata:
  author: subsquid
  version: "1.1.0"
  category: {core|template|documentation}
---

# Pipes: {Skill Title}

{Brief description of what the skill does.}

## When to Use This Skill

{Describe activation scenarios}

## How It Works

{Numbered list explaining the skill's workflow}

## Usage

{Show examples with code blocks}

## Related Skills

- [{skill-name}](../{skill-name}/SKILL.md) - {Description}
```

### Best Practices for Context Efficiency

Skills are loaded on-demand — only the skill name and description are loaded at startup. The full `SKILL.md` loads into context only when the agent decides the skill is relevant. To minimize context usage:

- **Keep SKILL.md under 500 lines** — put detailed reference material in `references/` directory
- **Write specific descriptions** — helps the agent know exactly when to activate the skill
- **Use progressive disclosure** — reference supporting files that get read only when needed
- **Prefer references over inline content** — link to documentation files in `references/`
- **File references work one level deep** — link directly from SKILL.md to supporting files

### Script Requirements

- Use `#!/bin/bash` shebang
- Use `set -e` for fail-fast behavior
- Write status messages to stderr: `echo "Message" >&2`
- Write machine-readable output (JSON) to stdout
- Include a cleanup trap for temp files
- Make scripts executable: `chmod +x scripts/*.sh`

### Template Structure

For template skills (e.g., `pipes-template-dex-swaps`):

```
pipes-template-{name}/
  SKILL.md                          # Template usage guide
  templates/
    {template-name}/
      template.config.ts            # Template configuration
      templates/
        clickhouse-table.sql        # Database schemas
        pg-table.ts
        transformer.ts              # Event transformers
```

### End-User Installation

Document this installation method for users:

```bash
npx skills add subsquid-labs/agent-skills
```

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

### Required MCP Servers

Some skills require MCP (Model Context Protocol) servers:

- **ClickHouse MCP**: For `pipes-validation`, `pipes-deploy` (local Docker)
- **ClickHouse Cloud MCP**: For `pipes-deploy` (ClickHouse Cloud)
- **Railway MCP**: For `pipes-deploy-railway`

These are configured in `.claude/settings.json` at the project level, not within individual skills.

## Skill Categories

### Core Skills
Agent skills for the full indexer development lifecycle: creation, debugging, deployment, validation.

### Template Skills
Production-ready templates for common blockchain patterns: DEX swaps, NFT transfers, liquid staking, lending protocols.

### Documentation Skills
Workflow guides and pattern documentation: `pipes-workflow`, `pipes-deployment`, `pipes-patterns`.

## Integration with Pipes SDK

All skills work with the [Pipes SDK](https://github.com/subsquid-labs/pipes-sdk) and use `npx @iankressin/pipes-cli@latest` for project generation. Skills should:

- Use the published npm package (not local SDK paths)
- Reference `beta.docs.sqd.dev` for documentation
- Follow the research workflow in `pipes-new-indexer/references/RESEARCH_CHECKLIST.md`

## Validation

Use the [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) reference library to validate your skills:

```bash
skills-ref validate ./skills/{skill-name}
```

This checks that your `SKILL.md` frontmatter is valid and follows all naming conventions.
