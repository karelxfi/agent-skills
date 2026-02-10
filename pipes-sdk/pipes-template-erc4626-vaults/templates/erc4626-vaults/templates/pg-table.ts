import { bigint, integer, numeric, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

export const vaultEventsTable = pgTable(
  'vault_events',
  {
    blockNumber: integer().notNull(),
    txHash: varchar({ length: 66 }).notNull(),
    logIndex: integer().notNull(),
    timestamp: bigint({ mode: 'number' }).notNull(),
    eventType: varchar({ length: 32 }).notNull(),
    vaultAddress: varchar({ length: 42 }).notNull(),
    sender: varchar({ length: 42 }).notNull(),
    onBehalf: varchar({ length: 42 }).notNull(),
    receiver: varchar({ length: 42 }).notNull(),
    assets: numeric({ mode: 'bigint' }).notNull(),
    shares: numeric({ mode: 'bigint' }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockNumber, table.txHash, table.logIndex],
    }),
  ],
)
