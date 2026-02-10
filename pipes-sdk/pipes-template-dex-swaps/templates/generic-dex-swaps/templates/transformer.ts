import Mustache from 'mustache'
import { GenericDexSwapsPipeTemplateParams } from '../template.config.js'

const template = `import { evmDecoder } from '@subsquid/pipes/evm'
import { events } from './contracts/pair.js'

const genericDexSwaps = evmDecoder({
  profiler: { id: '{{protocolName}}-swaps' },
  range: { from: '10,000,835' }, // Uniswap V2 Factory deployment block
  contracts: [
    {{#contractAddresses}}
    '{{.}}',
    {{/contractAddresses}}
  ],
  events: {
    swaps: events.Swap,
  },
}).pipe(({ swaps }) =>
  swaps.map((swap) => ({
    blockNumber: swap.block.number,
    txHash: swap.rawEvent.transactionHash,
    logIndex: swap.rawEvent.logIndex,
    timestamp: swap.timestamp.getTime(),
    poolAddress: swap.contract,
    eventType: 'swap',
    sender: swap.event.sender,
    recipient: swap.event.to,
    amount0In: swap.event.amount0In,
    amount1In: swap.event.amount1In,
    amount0Out: swap.event.amount0Out,
    amount1Out: swap.event.amount1Out,
  })),
)
`

export function renderTransformer(params: GenericDexSwapsPipeTemplateParams) {
  return Mustache.render(template, params)
}
