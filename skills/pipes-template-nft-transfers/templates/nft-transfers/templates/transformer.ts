import Mustache from 'mustache'
import { NftTransfersPipeTemplateParams } from '../template.config.js'

const template = `import { commonAbis, evmDecoder } from '@subsquid/pipes/evm'

const nftTransfers = evmDecoder({
  profiler: { id: '{{collectionName}}-transfers' },
  range: { from: '12,287,507' }, // BAYC deployment block
  contracts: [
    {{#contractAddresses}}
    '{{.}}',
    {{/contractAddresses}}
  ],
  events: {
    transfers: commonAbis.erc721.events.Transfer,
  },
}).pipe(({ transfers }) =>
  transfers.map((transfer) => ({
    blockNumber: transfer.block.number,
    txHash: transfer.rawEvent.transactionHash,
    logIndex: transfer.rawEvent.logIndex,
    timestamp: transfer.timestamp.getTime(),
    contractAddress: transfer.contract,
    eventType: 'transfer',
    fromAddress: transfer.event.from,
    toAddress: transfer.event.to,
    tokenId: transfer.event.tokenId,
  })),
)
`

export function renderTransformer(params: NftTransfersPipeTemplateParams) {
  return Mustache.render(template, params)
}
