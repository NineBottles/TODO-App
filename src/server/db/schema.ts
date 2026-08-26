import { date, index, integer, pgEnum, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';

export const ticketStatusEnum = pgEnum('ticket_status', [
  TICKET_STATUS.BACKLOG,
  TICKET_STATUS.TODO,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.DONE,
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  TICKET_PRIORITY.LOW,
  TICKET_PRIORITY.MEDIUM,
  TICKET_PRIORITY.HIGH,
]);

export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    status: ticketStatusEnum('status').notNull().default(TICKET_STATUS.BACKLOG),
    priority: ticketPriorityEnum('priority').notNull().default(TICKET_PRIORITY.MEDIUM),
    position: integer('position').notNull().default(0),
    plannedStartDate: date('planned_start_date'),
    dueDate: date('due_date'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tickets_status_position_idx').on(table.status, table.position)],
);

export type TicketRow = typeof tickets.$inferSelect;
export type TicketInsert = typeof tickets.$inferInsert;
