import { asc, eq, min } from 'drizzle-orm';
import { db } from '@/server/db';
import { tickets, type TicketInsert, type TicketRow } from '@/server/db/schema';
import type { TicketStatus } from '@/shared/constants';
import type { Ticket } from '@/shared/types';

/** DB row(Date 객체)를 공유 타입(ISO 문자열)으로 변환한다. */
const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  position: row.position,
  plannedStartDate: row.plannedStartDate,
  dueDate: row.dueDate,
  startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** 서비스 계층이 다루는 값(ISO 문자열)을 Drizzle 입력(Date)으로 변환한다. */
export type TicketWriteValues = Partial<
  Pick<
    Ticket,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'position'
    | 'plannedStartDate'
    | 'dueDate'
    | 'startedAt'
    | 'completedAt'
    | 'updatedAt'
  >
>;

const toInsertValues = (values: TicketWriteValues): TicketInsert => {
  const { startedAt, completedAt, updatedAt, ...rest } = values;
  return {
    ...rest,
    ...(startedAt !== undefined ? { startedAt: startedAt === null ? null : new Date(startedAt) } : {}),
    ...(completedAt !== undefined
      ? { completedAt: completedAt === null ? null : new Date(completedAt) }
      : {}),
    ...(updatedAt !== undefined ? { updatedAt: new Date(updatedAt) } : {}),
  } as TicketInsert;
};

export const ticketRepository = {
  async findAll(): Promise<Ticket[]> {
    const rows = await db.select().from(tickets).orderBy(asc(tickets.position));
    return rows.map(toTicket);
  },

  async findById(id: number): Promise<Ticket | null> {
    const [row] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return row ? toTicket(row) : null;
  },

  async findByStatus(status: TicketStatus): Promise<Ticket[]> {
    const rows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.status, status))
      .orderBy(asc(tickets.position));
    return rows.map(toTicket);
  },

  async insert(values: TicketWriteValues & { title: string }): Promise<Ticket> {
    const [row] = await db.insert(tickets).values(toInsertValues(values)).returning();
    return toTicket(row);
  },

  async update(id: number, values: TicketWriteValues): Promise<Ticket | null> {
    const [row] = await db
      .update(tickets)
      .set(toInsertValues(values))
      .where(eq(tickets.id, id))
      .returning();
    return row ? toTicket(row) : null;
  },

  async remove(id: number): Promise<boolean> {
    const rows = await db.delete(tickets).where(eq(tickets.id, id)).returning({ id: tickets.id });
    return rows.length > 0;
  },

  /** 칼럼의 최소 position. 맨 위 배치 계산용 — 전체 행을 읽지 않는다. (FR-001) */
  async minPosition(status: TicketStatus): Promise<number | null> {
    const [row] = await db
      .select({ value: min(tickets.position) })
      .from(tickets)
      .where(eq(tickets.status, status));
    return row?.value ?? null;
  },

  /**
   * 티켓 이동과 칼럼 재정렬을 하나의 트랜잭션으로 적용한다. (FR-007)
   * 둘을 분리하면 재정렬 실패 시 티켓만 이동하고 position이 깨진 채 남는다.
   */
  async applyReorder(
    id: number,
    values: TicketWriteValues,
    positions: { id: number; position: number }[] | null,
  ): Promise<Ticket | null> {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(tickets)
        .set(toInsertValues(values))
        .where(eq(tickets.id, id))
        .returning();
      if (!row) return null;

      for (const item of positions ?? []) {
        if (item.id === id && item.position === values.position) continue;
        await tx.update(tickets).set({ position: item.position }).where(eq(tickets.id, item.id));
      }

      return toTicket(row);
    });
  },
};
