---
name: pipes-validation
description: Validates indexed blockchain data quality and completeness by running checks and comparing against block explorers.
allowed-tools: [Read, Grep, WebFetch, Bash]
metadata:
  author: subsquid
  version: "1.0.0"
  category: core
---

# Pipes: Data Validator

Specialized agent for validating indexed blockchain data quality and completeness.

## When to Use This Skill

Activate when:
- Indexer has finished syncing
- User suspects data quality issues
- User wants to verify indexed data
- User mentions "validate", "check data", "is this correct", "verify", or "data looks wrong"

## Your Role

Ensure that indexed blockchain data is correct, complete, and ready for production use by running validation checks and comparing samples against block explorers.

## Primary Responsibilities

1. **Schema Validation**: Verify table structure matches expected design
2. **Data Quality Checks**: Validate formats, ranges, and constraints
3. **Completeness Checks**: Ensure no gaps in block ranges or missing data
4. **Consistency Checks**: Verify logical relationships in data
5. **Sample Verification**: Compare random samples against block explorer
6. **Generate Reports**: Provide clear pass/fail assessment with actionable recommendations

## Validation Levels

### Level 1: Schema Validation (CRITICAL)

Verify the table structure is correct:

```sql
-- Check table exists
SELECT count() FROM system.tables
WHERE database = '<database>' AND name = '<table_name>'

-- Check column types
DESCRIBE <database>.<table_name>

-- Expected vs Actual comparison
```

**Checks**:
- Table exists
- All expected columns present
- Column data types match schema design
- Indexes are created
- Table engine is correct

### Level 2: Data Quality (HIGH PRIORITY)

Validate individual data values:

```sql
-- Address format validation
SELECT
  countIf(length(pool_address) != 42) as invalid_length,
  countIf(pool_address NOT LIKE '0x%') as missing_prefix,
  countIf(NOT match(pool_address, '^0x[0-9a-fA-F]{40}$')) as invalid_format
FROM <table_name>

-- Transaction hash format
SELECT
  countIf(length(transaction_hash) != 66) as invalid_length,
  countIf(transaction_hash NOT LIKE '0x%') as missing_prefix
FROM <table_name>

-- BigInt values are valid (if stored as String)
SELECT
  countIf(amount = '') as empty_amounts,
  countIf(NOT match(amount, '^-?[0-9]+$')) as invalid_numbers
FROM <table_name>

-- NULL checks
SELECT
  countIf(from_address IS NULL) as null_from,
  countIf(to_address IS NULL) as null_to,
  countIf(value IS NULL) as null_value
FROM <table_name>
```

**Checks**:
- Addresses are 42 characters (0x + 40 hex)
- Transaction hashes are 66 characters (0x + 64 hex)
- BigInt values are valid numbers
- No unexpected NULL values
- Enum/status values are in valid set
- Block numbers are in expected range

### Level 3: Completeness (MEDIUM PRIORITY)

Ensure no missing data:

```sql
-- Block range coverage
SELECT
  MIN(block_number) as min_block,
  MAX(block_number) as max_block,
  COUNT(DISTINCT block_number) as unique_blocks
FROM <table_name>

-- Check for block gaps
SELECT
  block_number,
  block_number - lag(block_number) OVER (ORDER BY block_number) as gap
FROM (
  SELECT DISTINCT block_number
  FROM <table_name>
  ORDER BY block_number
)
WHERE gap > 1

-- Event count per block (detect anomalies)
SELECT
  block_number,
  COUNT(*) as event_count
FROM <table_name>
GROUP BY block_number
HAVING event_count > 1000  -- Unusually high
ORDER BY event_count DESC
LIMIT 10
```

**Checks**:
- Block range matches expected (from → to)
- No gaps in block sequence (unless blocks had no events)
- Event counts are reasonable
- No duplicate events (same tx_hash + log_index)

### Level 4: Consistency (MEDIUM PRIORITY)

Verify logical relationships:

```sql
-- Block timestamps are monotonic
SELECT
  block_number,
  block_timestamp,
  lag(block_timestamp) OVER (ORDER BY block_number) as prev_timestamp
FROM (
  SELECT DISTINCT block_number, block_timestamp
  FROM <table_name>
  ORDER BY block_number
)
WHERE block_timestamp < prev_timestamp

-- Log indexes are sequential per transaction
SELECT
  transaction_hash,
  groupArray(log_index) as log_indexes
FROM <table_name>
GROUP BY transaction_hash
HAVING length(log_indexes) != max(log_indexes) - min(log_indexes) + 1
```

**Checks**:
- Block timestamps increase with block numbers
- Log indexes are sequential within transactions

### Level 5: Sample Verification (HIGH CONFIDENCE)

Compare random samples against block explorer:

```sql
-- Get 10 random samples
SELECT
  block_number,
  transaction_hash,
  log_index,
  *
FROM <table_name>
ORDER BY rand()
LIMIT 10
```

For each sample:
1. Fetch transaction from Etherscan/Basescan API
2. Find matching log entry
3. Compare decoded values
4. Report matches/mismatches

**Checks**:
- Transaction exists on block explorer
- Log index matches
- Decoded event values match
- Block number matches
- Timestamp matches

## Workflow

### Step 1: Receive Input

Input can be:

1. **Automatic trigger** after indexer completes:
   ```typescript
   {
     table: "uniswap_v3_swaps",
     database: "default",
     expected_blocks: { from: 20000000, to: 20001000 },
     expected_schema: <from schema-designer>
   }
   ```

2. **Manual invocation** by user:
   ```
   "Validate the swaps table"
   "Check if my transfers data is correct"
   "Something looks wrong with block 20000500"
   ```

### Step 2: Run Validation Levels

Execute checks in order:

1. **Schema Validation** (always run)
   - If fails → Report and STOP
   - Critical errors must be fixed before data can be trusted

2. **Data Quality** (always run)
   - If fails → Report issues but continue
   - Shows what needs to be re-synced

3. **Completeness** (if block range provided)
   - If fails → Report gaps
   - Helps identify missing data

4. **Consistency** (if applicable)
   - If fails → Report logical errors
   - Helps catch indexer bugs

5. **Sample Verification** (optional, for high confidence)
   - Pick 3-10 random samples
   - Verify against block explorer
   - If fails → Report mismatches

### Step 3: Generate Report

Create comprehensive validation report with:

- Overall status: PASS / FAIL / WARNING
- Results for each validation level
- Specific issues found
- Actionable recommendations
- Summary statistics

### Step 4: Provide Recommendations

Based on findings:

- **PASS**: Ready for production
- **WARNING**: Minor issues, but usable
- **FAIL**: Critical issues, must re-sync

## Output Format

```markdown
##  Data Validation Report: <table_name>

**Date**: <timestamp>
**Database**: <database>
**Table**: <table_name>
**Blocks**: <from> to <to> (<total> blocks)
**Total Events**: <count>

---

### Schema Validation (5/5 passed)

- Table exists in database '<database>'
- All expected columns present (12/12)
- Data types match schema design
- Indexes created correctly (3 bloom filters)
- Table engine: ReplacingMergeTree (expected)

---

### [✅/⚠️/❌] Data Quality (<passed>/<total> checks)

**Address Validation**:
- All addresses are 42 characters (12,456 checked)
- All addresses start with '0x'
- All addresses are valid hex format

**Transaction Hash Validation**:
- All hashes are 66 characters
- All hashes start with '0x'

**BigInt Value Validation**:
- No empty amount values
- All amounts are valid numbers

---

### [✅/⚠️/❌] Completeness (<passed>/<total> checks)

**Block Coverage**:
- Expected range: 20,000,000 to 20,001,000 (1,000 blocks)
- Actual range: 20,000,000 to 20,000,999 (1,000 blocks)
- [⚠️] Only 856 blocks have events (144 blocks had no activity)

---

### [✅/⚠️/❌] Sample Verification (<passed>/<total> samples)

Verified <N> random transactions against <Etherscan/Basescan>:

1. **Block 20,000,123**, Tx `0x789...abc`, Log 42:
   - Transaction found on block explorer
   - Log index matches (42)
   - Event values match

---

### [PASS / WARNING / FAIL] Overall Assessment

**Status**: <PASS/WARNING/FAIL>

**Summary**:
- Schema: Perfect match
- Data Quality: All checks passed
- Completeness: 144 blocks had no events (normal)
- Sample Verification: 10/10 samples match block explorer

**Recommendations**:
1. [✅] Ready for production use
   OR
   [⚠️] Review warnings above, but data is usable
   OR
   [❌] Fix critical issues and re-sync

---

**Validation completed**: <timestamp>
**Report generated by**: data-validator agent
```

## Common Scenarios

### Scenario 1: Proactive Validation After Indexer Completes

```
Indexer finishes syncing 12,456 swaps
↓
data-validator (automatic):
  - Receives: table name, block range, expected schema
  - Runs all 5 validation levels
  - All checks pass
  - Reports to user:

Data Validation PASSED

Your uniswap_v3_swaps table is ready for production use.

12,456 events indexed across 1,000 blocks
No issues found in schema, data quality, or completeness
3 sample transactions verified against Etherscan
```

### Scenario 2: User Suspects Bad Data

```
User: "The amounts look wrong in my swaps table"
↓
data-validator (manual):
  - Runs data quality checks
  - Finds: 15 rows with NULL amount0
  - Runs sample verification
  - Finds: Etherscan shows values, we have NULL
  - Reports:

VALIDATION FAILED

**Issue**: 15 swaps have NULL amount0 values

**Root Cause Analysis**:
Compared 3 affected transactions to Etherscan:
- Block 20,000,100, Tx 0x123...: Etherscan shows amount0=1000000, we have NULL

**Likely Cause**: Missing .toString() on BigInt value in indexer code

**Fix**:
1. Update indexer transformation:
   ```typescript
   // Wrong:
   amount0: s.event.amount0,

   // Correct:
   amount0: s.event.amount0.toString(),
   ```

2. Re-sync affected blocks: 20,000,100 to 20,000,200
```

## Block Explorer APIs

### Ethereum Mainnet (Etherscan):

```bash
# Get transaction receipt
curl "https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=0x..."

# Parse logs to find matching event
```

### Base (Basescan):

```bash
curl "https://api.basescan.org/api?module=proxy&action=eth_getTransactionReceipt&txhash=0x..."
```

### Arbitrum:

```bash
curl "https://api.arbiscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=0x..."
```

**Note**: Most block explorers have rate limits. Validate only 3-10 samples, not all data.

## Error Detection Patterns

### Pattern 1: Missing .toString() on BigInt

**Symptom**: NULL values in amount/value fields

**Detection**:
```sql
SELECT countIf(amount IS NULL) FROM table
```

**Root Cause**: Missing .toString() in indexer code

**Fix**: Add .toString() to BigInt fields

### Pattern 2: Wrong Import Path

**Symptom**: All data is empty or malformed

**Detection**: Zero events indexed OR all NULL values

**Root Cause**: Wrong import path for ClickHouse target

**Fix**: Use `@subsquid/pipes/targets/clickhouse`

## Related Skills

- [pipes-troubleshooting](../pipes-troubleshooting/SKILL.md) - Fix errors
- [pipes-schema-design](../pipes-schema-design/SKILL.md) - Design schemas
- [pipes-orchestrator](../pipes-orchestrator/SKILL.md) - Routes to this skill
- [pipes-performance](../pipes-performance/SKILL.md) - Optimize sync

## Best Practices

1. **Always run schema validation first** - if schema is wrong, data is wrong
2. **Check for NULL values** in required fields
3. **Validate address and hash formats** (common source of errors)
4. **Sample verify 3-10 random transactions** for high confidence
5. **Report actionable recommendations** - not just "failed"
6. **Include SQL queries in reports** so users can investigate themselves
7. **Be conservative with PASS** - only PASS if truly production-ready
