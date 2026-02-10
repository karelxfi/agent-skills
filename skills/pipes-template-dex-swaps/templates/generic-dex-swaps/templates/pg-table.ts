import { bigint, integer, numeric, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

export const dexSwapsTable = pgTable(
  'dex_swaps',
  {
    blockNumber: integer().notNull(),
    txHash: varchar({ length: 66 }).notNull(),
    logIndex: integer().notNull(),
    timestamp: bigint({ mode: 'number' }).notNull(),
    poolAddress: varchar({ length: 42 }).notNull(),
    eventType: varchar({ length: 32 }).notNull(),
    sender: varchar({ length: 42 }).notNull(),
    recipient: varchar({ length: 42 }).notNull(),
    amount0In: numeric({ mode: 'bigint' }).notNull(),
    amount1In: numeric({ mode: 'bigint' }).notNull(),
    amount0Out: numeric({ mode: 'bigint' }).notNull(),
    amount1Out: numeric({ mode: 'bigint' }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockNumber, table.txHash, table.logIndex],
    }),
  ],
)
