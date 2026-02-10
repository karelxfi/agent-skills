# Contributing

Contributions to improve existing skills or add new skills are welcome.

## Adding a New Skill

### 1. Create the skill directory

```bash
mkdir -p skills/pipes-{skill-name}
```

Use `kebab-case` with the `pipes-` prefix for the directory name.

### 2. Create SKILL.md

Follow this template:

```markdown
---
name: pipes-{skill-name}
description: {One sentence describing what the skill does}
compatibility: {Optional: environment requirements}
allowed-tools: [{Optional: space-delimited list}]
metadata:
  author: subsquid
  version: "1.0.0"
  category: {core|deployment|research|template|documentation}
---

# Pipes: {Skill Title}

{Brief description}

## When to Use This Skill

{Describe activation scenarios}

## {Additional sections as needed}

## Related Skills

- [pipes-related](../pipes-related/SKILL.md) - Description
```

### 3. Choose the correct category

- **core**: Main operational skills (creation, debugging, validation, setup)
- **deployment**: Platform deployment skills (ClickHouse Cloud, Railway, local)
- **research**: Discovery and analysis skills (ABIs, contracts, protocols, schemas)
- **template**: Code templates for common patterns
- **documentation**: Workflow guides and best practices

### 4. Add optional directories

- `scripts/` - Executable helper scripts
- `references/` - Supporting documentation
- `templates/` - Code templates (for template skills)

### 5. Update README.md

Add your skill to the Available Skills table with the correct category.

### 6. Validate

```bash
# Check YAML frontmatter
head -20 skills/pipes-{skill-name}/SKILL.md

# Validate with skills-ref (if available)
skills-ref validate ./skills/pipes-{skill-name}
```

## Guidelines

### Keep Skills Focused

Each skill should do one thing well. If a skill is becoming too large, consider splitting it into multiple skills.

### Progressive Disclosure

Keep SKILL.md under 500 lines. Put detailed reference material in separate files in the `references/` directory.

### Use Clear Descriptions

The description field is loaded at startup for all skills. Make it specific and include trigger phrases that help agents know when to use the skill.

### Follow Naming Conventions

- Directories: `kebab-case` with `pipes-` prefix
- Files: `SKILL.md` (uppercase)
- Scripts: `kebab-case.sh`

### Test Your Skill

Before submitting, test that:
- YAML frontmatter is valid
- All file references work
- Scripts are executable and have proper shebangs
- The skill activates correctly when relevant tasks are detected

## Resources

- [Agent Skills Format](https://agentskills.io/)
- [AGENTS.md](AGENTS.md) - Detailed guidance for AI agents
- [Pipes SDK](https://github.com/subsquid-labs/pipes-sdk)
- [SQD Documentation](https://beta.docs.sqd.dev)

## Questions?

For questions about contributing, open an issue or reach out to the SQD team via Telegram (https://t.me/hydradevs).
