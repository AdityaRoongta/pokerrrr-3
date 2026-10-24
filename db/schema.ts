// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('poker_rooms', {
  code: text('code').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

export const pokerSessions = sqliteTable('poker_sessions', {
  code: text('code').primaryKey(),
  createdAt: integer('created_at').notNull(),
  endedAt: integer('ended_at'),
  settings: text('settings').notNull(),
});

export const pokerHandHistory = sqliteTable('poker_hand_history', {
  roomCode: text('room_code').notNull(),
  handNumber: integer('hand_number').notNull(),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at').notNull(),
  payload: text('payload').notNull(),
});

export const pokerHandEvents = sqliteTable('poker_hand_events', {
  roomCode: text('room_code').notNull(),
  handNumber: integer('hand_number').notNull(),
  eventIndex: integer('event_index').notNull(),
  eventType: text('event_type').notNull(),
  happenedAt: integer('happened_at'),
  payload: text('payload').notNull(),
});
