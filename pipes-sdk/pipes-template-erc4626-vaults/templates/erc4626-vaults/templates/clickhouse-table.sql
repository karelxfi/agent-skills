CREATE TABLE IF NOT EXISTS vault_events (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    event_type String,
    vault_address String,
    sender String,
    on_behalf String,
    receiver String,
    assets UInt256,
    shares UInt256,
    sign Int8 DEFAULT 1
  )
  ENGINE = CollapsingMergeTree(sign)
  ORDER BY (block_number, tx_hash, log_index)
