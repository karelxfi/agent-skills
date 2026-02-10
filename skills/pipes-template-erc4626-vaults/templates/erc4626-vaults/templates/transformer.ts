import Mustache from 'mustache'
import { Erc4626VaultsPipeTemplateParams } from '../template.config.js'

const template = `import { evmDecoder } from '@subsquid/pipes/evm'
import { events } from './contracts/vault.js'

const erc4626Vaults = evmDecoder({
  profiler: { id: '{{protocolName}}' },
  range: { from: '24,349,693' }, // Example: Morpho Vault deployment block
  contracts: [
    {{#contractAddresses}}
    '{{.}}',
    {{/contractAddresses}}
  ],
  events: {
    deposits: events.Deposit,
    withdrawals: events.Withdraw,
  },
}).pipe(({ deposits, withdrawals }) => {
  const depositEvents = deposits.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'deposit',
    vaultAddress: e.contract,
    sender: e.event.sender,
    onBehalf: e.event.onBehalf,
    receiver: e.event.onBehalf,
    assets: e.event.assets,
    shares: e.event.shares,
  }))

  const withdrawalEvents = withdrawals.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'withdraw',
    vaultAddress: e.contract,
    sender: e.event.sender,
    onBehalf: e.event.onBehalf,
    receiver: e.event.receiver,
    assets: e.event.assets,
    shares: e.event.shares,
  }))

  return [...depositEvents, ...withdrawalEvents]
})
`

export function renderTransformer(params: Erc4626VaultsPipeTemplateParams) {
  return Mustache.render(template, params)
}
