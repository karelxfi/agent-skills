# Pipes CLI Feedback Report

Tested `@iankressin/pipes-cli@0.1.0-beta.22` on macOS (Darwin 25.3.0), Node.js v25.8.1, bun 1.3.10.

Built and ran 3 indexers end-to-end:
- **erc20Transfers** template: USDC on Ethereum (6.5M rows indexed)
- **uniswapV3Swaps** template: Uniswap V3 factory on Ethereum (259K swaps, 650 pools)
- **custom** template: WETH Deposit/Withdrawal events (3.4M rows total)

---

## P0: CLI Crashes on Init — `ora` ESM/CJS Incompatibility

**Every** `npx @iankressin/pipes-cli@latest init --config '...'` call fails with:

```
[PIPES SDK] Error: (0 , import_ora.default) is not a function
```

**Root cause**: The CLI is bundled as CJS (`dist/index.cjs`) but imports `ora` which is ESM-only since v6. The `__toESM(require("ora"), 1)` wrapper cannot convert the ESM default export.

```js
// dist/index.cjs line 2462
var import_ora = __toESM(require("ora"), 1);  // FAILS
```

**Workaround I used**: Manually patched the bundled file to replace the ora import with a no-op spinner:

```js
var import_ora = { default: function(opts) {
  const text = typeof opts === "string" ? opts : (opts && opts.text) || "";
  return {
    start: function(t) { console.log(t || text); return this; },
    succeed: function(t) { console.log(t || text); return this; },
    fail: function(t) { console.log(t || text); return this; },
    stop: function() { return this; },
    text: text
  };
}};
```

**Fix options**:
1. Pin `ora` to v5.x (last CJS-compatible version)
2. Switch to a CJS-compatible spinner (`nanospinner`, `cli-spinners` + manual logic)
3. Bundle the CLI as ESM instead of CJS
4. Use dynamic `import("ora")` with proper async initialization

**Note**: `--schema` and `--version` work fine because they don't hit the `ora` code path. Only `init` is broken.

---

## P0: `uniswapV3Swaps` Template Doesn't Inject Factory Address

**Config provided**:
```json
{
  "templates": [{
    "templateId": "uniswapV3Swaps",
    "params": {
      "factoryAddress": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      "range": {"from": "21000000"}
    }
  }]
}
```

**Generated code** (`src/index.ts` line 23):
```ts
contracts: factory({
    address: [''],  // <-- EMPTY STRING, factory address missing
    ...
})
```

**Expected**:
```ts
contracts: factory({
    address: ['0x1F98431c8aD98523631AE4a59f267346ea31F984'],
    ...
})
```

The `factoryAddress` param is accepted by the schema, validated, but silently dropped during code generation. The indexer runs but discovers zero pools and produces zero data.

**Workaround**: Manually edit `src/index.ts` after generation to inject the address.

---

## P1: Generated `.env` Always Has Wrong Password

Every generated project has:
```
CLICKHOUSE_PASSWORD=password
```

The most common ClickHouse setup (including the CLI's own `docker-compose.yml` instructions in the docs, standalone Docker runs, and the skill documentation) uses `default` as the password. First-time users will always get:

```
ClickHouseError: Authentication failed: password is incorrect
```

**Additionally**: The generated `docker-compose.yml` also hardcodes `password`:
```yaml
environment:
  CLICKHOUSE_PASSWORD: password
```

This is internally consistent (docker-compose + .env both use `password`), but inconsistent with the standalone Docker setup that most users follow first:
```bash
docker run -d -e CLICKHOUSE_PASSWORD=default clickhouse/clickhouse-server
```

**Suggestion**: Either:
1. Change the default to `default` everywhere (matching standalone Docker convention)
2. Or make the password configurable via `--config` so it can be set at generation time

---

## P2: `--schema` Output Lacks Template ID Discriminators

The schema uses `anyOf` with 3 variants but none include the `templateId` as a const:

```json
{
  "anyOf": [
    { "properties": { "templateId": { "type": "string" }, "params": { "properties": { "contracts": ... } } } },
    { "properties": { "templateId": { "type": "string" }, "params": { "properties": { "contractAddresses": ... } } } },
    { "properties": { "templateId": { "type": "string" }, "params": { "properties": { "factoryAddress": ... } } } }
  ]
}
```

An AI agent (or human) has to guess which `templateId` value maps to which params shape. Should be:

```json
{
  "anyOf": [
    { "properties": { "templateId": { "const": "custom" }, "params": { "properties": { "contracts": ... } } } },
    { "properties": { "templateId": { "const": "erc20Transfers" }, "params": { "properties": { "contractAddresses": ... } } } },
    { "properties": { "templateId": { "const": "uniswapV3Swaps" }, "params": { "properties": { "factoryAddress": ... } } } }
  ]
}
```

This would make the schema self-documenting and allow JSON Schema validators to properly discriminate.

---

## P2: Noisy Sync Table Error on First Start

Every fresh indexer start logs a full error stack trace:

```
[ERROR][@clickhouse/client][Connection] Query: HTTP request error.
Caused by: ClickHouseError: Unknown table expression identifier 'pipes.sync'
```

The SDK then recovers and creates the table, but the error output is alarming. Users (and AI agents) interpret this as a failure.

**Suggestion**: Check for table existence before SELECT, or catch the "table not found" error silently on first run.

---

## P3: `custom` Template Contract File Naming

The custom template names the contract file by address:

```
src/contracts/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2.ts
```

This works but is ugly and hard to reference. The import in `index.ts` is:

```ts
import { events as wethEvents } from './contracts/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2.js'
```

**Better**: Use the `contractName` from the config (`"contractName": "WETH"`) to name the file:

```
src/contracts/weth.ts
```

```ts
import { events as wethEvents } from './contracts/weth.js'
```

The `contractName` is already a required field in the schema — it's just not used for file naming.

---

## What Works Well

To be clear, a lot is excellent:

1. **`--schema` flag** — great idea, shows all available templates and params. Just needs discriminators.
2. **Custom template ABI fetching** — I gave it a contract address and 2 event names. It fetched the full verified ABI from the chain, generated TypeScript types with topic0 hashes and proper codecs for ALL events, then only subscribed to the 2 I requested. Impressive.
3. **Generated code quality** — Zod env validation, proper BigInt serialization, CollapsingMergeTree with reorg handling, enrichEvents helper, toSnakeKeys utility. Production-grade scaffolding.
4. **Generated AGENTS.md** — Included in every project with pipeline patterns, doc links, and examples. Great for AI-assisted development.
5. **Factory template structure** — Pre-generated factory.ts and pool.ts with full ABI types. SQLite-backed pool discovery. Just needed the address fix.
6. **docker-compose.yml** — Health checks on ClickHouse, proper service dependencies, profile-based pipeline inclusion. Well-designed.

---

## Summary

| Issue | Severity | Workaround Available | Fix Complexity |
|-------|----------|---------------------|----------------|
| `ora` ESM/CJS crash | P0 - Blocks all users | Manual patch to bundled file | Low (pin ora@5 or swap library) |
| Factory address not injected | P0 - Silent data loss | Manual edit after generation | Medium (code generation bug) |
| Wrong .env password | P1 - First-run failure | `sed` the .env file | Low (change default string) |
| No schema discriminators | P2 - Agent confusion | Read docs to guess mapping | Low (add const to schema) |
| Noisy sync table error | P2 - False alarm | Ignore it | Low (add existence check) |
| Address-based file naming | P3 - Cosmetic | Works as-is | Low (use contractName) |
