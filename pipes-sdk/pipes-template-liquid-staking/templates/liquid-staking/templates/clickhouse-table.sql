CREATE TABLE IF NOT EXISTS staking_events (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    event_type String,
    contract_address String,
    user String,
    amount UInt256,
    shares UInt256,
    referral String,
    sign Int8 DEFAULT 1
  )
  ENGINE = CollapsingMergeTree(sign)
  ORDER BY (block_number, tx_hash, log_index)
