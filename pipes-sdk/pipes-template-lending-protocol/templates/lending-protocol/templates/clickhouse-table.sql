CREATE TABLE IF NOT EXISTS lending_events (
    block_number UInt32,
    tx_hash String,
    log_index UInt16,
    timestamp DateTime(3),
    event_type String,
    reserve Nullable(String),
    user String,
    on_behalf_of Nullable(String),
    to Nullable(String),
    repayer Nullable(String),
    amount Nullable(UInt256),
    referral_code Nullable(UInt16),
    interest_rate_mode Nullable(UInt8),
    borrow_rate Nullable(UInt256),
    use_a_tokens Nullable(Bool),
    collateral_asset Nullable(String),
    debt_asset Nullable(String),
    debt_to_cover Nullable(UInt256),
    liquidated_collateral_amount Nullable(UInt256),
    liquidator Nullable(String),
    receive_a_token Nullable(Bool),
    sign Int8 DEFAULT 1
  )
  ENGINE = CollapsingMergeTree(sign)
  ORDER BY (block_number, tx_hash, log_index)
