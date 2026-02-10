import Mustache from 'mustache'
import { LendingProtocolPipeTemplateParams } from '../template.config.js'

const template = `import { evmDecoder } from '@subsquid/pipes/evm'
import { events } from './contracts/pool.js'

const lendingProtocol = evmDecoder({
  profiler: { id: '{{protocolName}}' },
  range: { from: '16,291,127' }, // Example: Aave V3 Pool deployment block
  contracts: ['{{poolAddress}}'],
  events: {
    supplies: events.Supply,
    withdraws: events.Withdraw,
    borrows: events.Borrow,
    repays: events.Repay,
    liquidations: events.LiquidationCall,
  },
}).pipe(({ supplies, withdraws, borrows, repays, liquidations }) => {
  const supplyEvents = supplies.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'supply',
    reserve: e.event.reserve,
    user: e.event.user,
    onBehalfOf: e.event.onBehalfOf,
    amount: e.event.amount,
    referralCode: e.event.referralCode,
  }))

  const withdrawEvents = withdraws.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'withdraw',
    reserve: e.event.reserve,
    user: e.event.user,
    to: e.event.to,
    amount: e.event.amount,
  }))

  const borrowEvents = borrows.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'borrow',
    reserve: e.event.reserve,
    user: e.event.user,
    onBehalfOf: e.event.onBehalfOf,
    amount: e.event.amount,
    interestRateMode: e.event.interestRateMode,
    borrowRate: e.event.borrowRate,
    referralCode: e.event.referralCode,
  }))

  const repayEvents = repays.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'repay',
    reserve: e.event.reserve,
    user: e.event.user,
    repayer: e.event.repayer,
    amount: e.event.amount,
    useATokens: e.event.useATokens,
  }))

  const liquidationEvents = liquidations.map((e) => ({
    blockNumber: e.block.number,
    txHash: e.rawEvent.transactionHash,
    logIndex: e.rawEvent.logIndex,
    timestamp: e.timestamp.getTime(),
    eventType: 'liquidation',
    collateralAsset: e.event.collateralAsset,
    debtAsset: e.event.debtAsset,
    user: e.event.user,
    debtToCover: e.event.debtToCover,
    liquidatedCollateralAmount: e.event.liquidatedCollateralAmount,
    liquidator: e.event.liquidator,
    receiveAToken: e.event.receiveAToken,
  }))

  return [...supplyEvents, ...withdrawEvents, ...borrowEvents, ...repayEvents, ...liquidationEvents]
})
`

export function renderTransformer(params: LendingProtocolPipeTemplateParams) {
  return Mustache.render(template, params)
}
