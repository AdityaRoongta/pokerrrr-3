// Legacy D1 room schema retained for the original hosting integration.
// Multiplayer state is stored by server/table-service.mjs in the Durable Object.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('poker_rooms', {
  code: text('code').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});
