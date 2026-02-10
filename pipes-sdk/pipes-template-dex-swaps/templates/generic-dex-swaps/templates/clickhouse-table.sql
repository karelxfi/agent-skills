CREATE TABLE IF NOT EXISTS dex_swaps (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    pool_address String,
    event_type String,
    sender String,
    recipient String,
    amount0_in UInt256,
    amount1_in UInt256,
    amount0_out UInt256,
    amount1_out UInt256,
    sign Int8 DEFAULT 1
  )
  ENGINE = CollapsingMergeTree(sign)
  ORDER BY (block_number, tx_hash, log_index)
