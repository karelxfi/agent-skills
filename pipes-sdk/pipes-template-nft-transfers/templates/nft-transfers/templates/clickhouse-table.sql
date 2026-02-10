CREATE TABLE IF NOT EXISTS nft_transfers (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    contract_address String,
    event_type String,
    from_address String,
    to_address String,
    token_id UInt256,
    sign Int8 DEFAULT 1
  )
  ENGINE = CollapsingMergeTree(sign)
  ORDER BY (block_number, tx_hash, log_index)
