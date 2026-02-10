import Mustache from 'mustache'
import { LiquidStakingPipeTemplateParams } from '../template.config.js'

const template = `import { commonAbis, evmDecoder } from '@subsquid/pipes/evm'
import { event, indexed } from '@subsquid/evm-abi'
import * as p from '@subsquid/evm-codec'

// Lido Submitted event - emitted when ETH is staked
const Submitted = event(
  '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3c2c1e96a9a2a6f3b4e9e8e0c7f3',
  'Submitted(address,uint256,address)',
  { sender: indexed(p.address), amount: p.uint256, referral: p.address },
)

const liquidStaking = evmDecoder({
  profiler: { id: '{{protocolName}}-staking' },
  range: { from: '11,473,216' }, // Lido stETH deployment block
  contracts: [
    {{#contractAddresses}}
    '{{.}}',
    {{/contractAddresses}}
  ],
  events: {
    submitted: Submitted,
    transfers: commonAbis.erc20.events.Transfer,
  },
}).pipe(({ submitted, transfers }) => {
  const submittedEvents = submitted.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'submitted',
    contractAddress: e.contract,
    user: e.event.sender,
    amount: e.event.amount,
    shares: 0n,
    referral: e.event.referral,
  }))

  const transferEvents = transfers.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'transfer',
    contractAddress: e.contract,
    user: e.event.from,
    amount: e.event.value,
    shares: 0n,
    referral: e.event.to,
  }))

  return [...submittedEvents, ...transferEvents]
})
`

export function renderTransformer(params: LiquidStakingPipeTemplateParams) {
  return Mustache.render(template, params)
}
