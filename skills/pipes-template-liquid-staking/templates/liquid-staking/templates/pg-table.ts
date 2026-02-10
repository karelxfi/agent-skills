import { bigint, integer, numeric, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

export const stakingEventsTable = pgTable(
  'staking_events',
  {
    blockNumber: integer().notNull(),
    txHash: varchar({ length: 66 }).notNull(),
    logIndex: integer().notNull(),
    timestamp: bigint({ mode: 'number' }).notNull(),
    eventType: varchar({ length: 32 }).notNull(),
    contractAddress: varchar({ length: 42 }).notNull(),
    user: varchar({ length: 42 }).notNull(),
    amount: numeric({ mode: 'bigint' }).notNull(),
    shares: numeric({ mode: 'bigint' }).notNull(),
    referral: varchar({ length: 42 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockNumber, table.txHash, table.logIndex],
    }),
  ],
)
