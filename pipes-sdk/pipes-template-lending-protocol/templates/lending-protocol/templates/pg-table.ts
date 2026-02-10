import { bigint, boolean, integer, numeric, pgTable, primaryKey, smallint, varchar } from 'drizzle-orm/pg-core'

export const lendingEventsTable = pgTable(
  'lending_events',
  {
    blockNumber: integer().notNull(),
    txHash: varchar({ length: 66 }).notNull(),
    logIndex: integer().notNull(),
    timestamp: bigint({ mode: 'number' }).notNull(),
    eventType: varchar({ length: 32 }).notNull(),
    reserve: varchar({ length: 42 }),
    user: varchar({ length: 42 }).notNull(),
    onBehalfOf: varchar({ length: 42 }),
    to: varchar({ length: 42 }),
    repayer: varchar({ length: 42 }),
    amount: numeric({ mode: 'bigint' }),
    referralCode: smallint(),
    interestRateMode: smallint(),
    borrowRate: numeric({ mode: 'bigint' }),
    useATokens: boolean(),
    collateralAsset: varchar({ length: 42 }),
    debtAsset: varchar({ length: 42 }),
    debtToCover: numeric({ mode: 'bigint' }),
    liquidatedCollateralAmount: numeric({ mode: 'bigint' }),
    liquidator: varchar({ length: 42 }),
    receiveAToken: boolean(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockNumber, table.txHash, table.logIndex],
    }),
  ],
)
