# EVM Logs - Additional Examples

## Example 5: NFT Transfers to Specific Address

**Use case:** Track NFT transfers to a specific wallet address.

```json
{
  "type": "evm",
  "fromBlock": 17000000,
  "toBlock": 17001000,
  "logs": [{
    "address": ["0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
    "topic2": ["0x000000000000000000000000742d35cc6634c0532925a3b844bc454e4438f44e"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true,
      "transactionHash": true
    },
    "block": {
      "number": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Bored Ape Yacht Club
**Event:** Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
**Notes:**
- ERC721 Transfer events have 3 indexed parameters: `from`, `to`, `tokenId`
- `topic1` = from address, `topic2` = to address, `topic3` = token ID
- Compare with ERC20: only 2 indexed parameters (`from`, `to`), amount is in `data`

---

## Example 6: Query Multiple ERC-20 Tokens Simultaneously

**Use case:** Track transfers across multiple stablecoins (USDC, USDT, DAI) in one query.

```json
{
  "type": "evm",
  "fromBlock": 18000000,
  "toBlock": 18010000,
  "logs": [{
    "address": [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    ],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
  }],
  "fields": {
    "block": {
      "number": true,
      "timestamp": true
    },
    "log": {
      "address": true,
      "topics": true,
      "data": true,
      "transactionHash": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contracts:** USDC, USDT, DAI
**Notes:** Multiple addresses in array = OR logic; efficient way to track multiple tokens without separate queries.

---

## Example 7: Monitor NFT Minting Events

**Use case:** Capture NFT creation events (transfers from zero address).

```json
{
  "type": "evm",
  "fromBlock": 18000000,
  "toBlock": 18010000,
  "logs": [{
    "address": ["0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
    "topic1": ["0x0000000000000000000000000000000000000000000000000000000000000000"]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "transactionHash": true
    },
    "block": {
      "number": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** Bored Ape Yacht Club
**Notes:**
- Minting is represented as a transfer from the zero address
- `topic1` = zero address (0x000...000 padded to 32 bytes)
- `topic2` = recipient address (minter)

---

## Example 8: Track ERC-1155 Multi-Token Transfers

**Use case:** Monitor ERC-1155 TransferSingle and TransferBatch events.

```json
{
  "type": "evm",
  "fromBlock": 18000000,
  "toBlock": 18010000,
  "logs": [{
    "address": ["0x495f947276749Ce646f68AC8c248420045cb7b5e"],
    "topic0": [
      "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
      "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb"
    ]
  }],
  "fields": {
    "log": {
      "address": true,
      "topics": true,
      "data": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contract:** OpenSea Shared Storefront (ERC-1155)
**Event Signatures:**
- TransferSingle: `0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62`
- TransferBatch: `0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb`

---

## Example 9: Monitor Multiple NFT Collections

**Use case:** Track transfers across popular NFT collections (BAYC, MAYC, CryptoPunks).

```json
{
  "type": "evm",
  "fromBlock": 18000000,
  "toBlock": 18010000,
  "logs": [{
    "address": [
      "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
      "0x60E4d786628Fea6478F785A6d7e704777c86a7c6",
      "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB"
    ],
    "topic0": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
  }],
  "fields": {
    "block": {
      "number": true,
      "timestamp": true
    },
    "log": {
      "address": true,
      "topics": true,
      "transactionHash": true
    }
  }
}
```

**Dataset:** `ethereum-mainnet`
**Contracts:** BAYC, MAYC, CryptoPunks
