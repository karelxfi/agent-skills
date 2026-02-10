import { bigint, integer, numeric, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

export const nftTransfersTable = pgTable(
  'nft_transfers',
  {
    blockNumber: integer().notNull(),
    txHash: varchar({ length: 66 }).notNull(),
    logIndex: integer().notNull(),
    timestamp: bigint({ mode: 'number' }).notNull(),
    contractAddress: varchar({ length: 42 }).notNull(),
    eventType: varchar({ length: 32 }).notNull(),
    fromAddress: varchar({ length: 42 }).notNull(),
    toAddress: varchar({ length: 42 }).notNull(),
    tokenId: numeric({ mode: 'bigint' }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockNumber, table.txHash, table.logIndex],
    }),
  ],
)
