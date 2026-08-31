import { ticketRepository, type TicketWriteValues } from '@/server/db/ticketRepository';
import {
  COLUMN_ORDER,
  DONE_VISIBLE_MS,
  ERROR_CODE,
  POSITION_GAP,
  TICKET_STATUS,
} from '@/shared/constants';
import { createEmptyBoard } from '@/shared/board';
import { needsRebalance, rebalance } from '@/shared/position';
import { STAGE_ORDER_MESSAGE, canTransition } from '@/shared/transition';
import type { BoardData, Ticket, TicketView } from '@/shared/types';
import { todayString } from '@/shared/validations/ticket';
import type {
  CreateTicketPayload,
  ReorderTicketPayload,
  UpdateTicketPayload,
} from '@/shared/validations/ticket';

export class NotFoundError extends Error {
  readonly code = ERROR_CODE.TICKET_NOT_FOUND;

  constructor(message = '티켓을 찾을 수 없습니다') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * 단계를 건너뛴 칼럼 이동. (FR-007)
 * 400으로 변환되며, 이 예외가 던져지면 티켓은 어떤 필드도 변경되지 않는다.
 */
export class InvalidTransitionError extends Error {
  readonly code = ERROR_CODE.INVALID_TRANSITION;

  constructor(message = STAGE_ORDER_MESSAGE) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

/** dueDate < 오늘 AND status !== DONE (FR-008) */
const isOverdue = (ticket: Ticket, today: string): boolean =>
  ticket.dueDate !== null && ticket.dueDate < today && ticket.status !== TICKET_STATUS.DONE;

/**
 * Done 칼럼에서 숨길 티켓인지 판단한다. (FR-005)
 * completedAt이 null이면 숨기지 않는다 — 숨기면 보드 어디에도 없어 되돌릴 수 없다.
 */
const isExpiredDone = (ticket: Ticket, now: number): boolean =>
  ticket.completedAt !== null && now - new Date(ticket.completedAt).getTime() >= DONE_VISIBLE_MS;

/** 칼럼 맨 위에 배치할 position: 최솟값 - 1024, 비어 있으면 0 (FR-001) */
const topPosition = (minPosition: number | null): number =>
  minPosition === null ? 0 : minPosition - POSITION_GAP;

export const ticketService = {
  /** FR-002: 칼럼별로 그룹화된 보드 데이터 */
  async getBoard(): Promise<BoardData> {
    const all = await ticketRepository.findAll();
    const today = todayString();
    const now = Date.now();

    const board = createEmptyBoard();

    for (const ticket of all) {
      if (ticket.status === TICKET_STATUS.DONE && isExpiredDone(ticket, now)) continue;
      const view: TicketView = { ...ticket, isOverdue: isOverdue(ticket, today) };
      board[ticket.status].push(view);
    }

    for (const status of COLUMN_ORDER) {
      board[status].sort((a, b) => a.position - b.position);
    }

    return board;
  },

  /** FR-003 */
  async getById(id: number): Promise<Ticket> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError();
    return ticket;
  },

  /** FR-001: 항상 BACKLOG 맨 위에 생성 */
  async create(payload: CreateTicketPayload): Promise<Ticket> {
    const minPosition = await ticketRepository.minPosition(TICKET_STATUS.BACKLOG);
    const now = new Date().toISOString();

    return ticketRepository.insert({
      title: payload.title,
      description: payload.description ?? null,
      priority: payload.priority,
      plannedStartDate: payload.plannedStartDate ?? null,
      dueDate: payload.dueDate ?? null,
      status: TICKET_STATUS.BACKLOG,
      position: topPosition(minPosition),
      updatedAt: now,
    });
  },

  /** FR-004: 전송된 필드만 부분 수정 */
  async update(id: number, payload: UpdateTicketPayload): Promise<Ticket> {
    const existing = await ticketRepository.findById(id);
    if (!existing) throw new NotFoundError();

    const values: TicketWriteValues = { updatedAt: new Date().toISOString() };
    if (payload.title !== undefined) values.title = payload.title;
    if (payload.description !== undefined) values.description = payload.description;
    if (payload.priority !== undefined) values.priority = payload.priority;
    if (payload.plannedStartDate !== undefined) values.plannedStartDate = payload.plannedStartDate;
    if (payload.dueDate !== undefined) values.dueDate = payload.dueDate;

    const updated = await ticketRepository.update(id, values);
    if (!updated) throw new NotFoundError();
    return updated;
  },

  /** FR-006: 하드 삭제 */
  async remove(id: number): Promise<void> {
    const deleted = await ticketRepository.remove(id);
    if (!deleted) throw new NotFoundError();
  },

  /**
   * FR-005: DONE으로 이동 + completedAt 기록.
   * 이미 DONE이면 completedAt을 유지한다(멱등). 덮어쓰면 실제 완료 시각이 사라지고
   * 24시간 노출 창이 리셋된다.
   */
  async complete(id: number): Promise<Ticket> {
    const existing = await ticketRepository.findById(id);
    if (!existing) throw new NotFoundError();

    // 단축 경로로 단계를 건너뛸 수 있으면 reorder의 제약이 무력화된다. (FR-007)
    if (!canTransition(existing.status, TICKET_STATUS.DONE)) throw new InvalidTransitionError();

    const minPosition = await ticketRepository.minPosition(TICKET_STATUS.DONE);
    const now = new Date().toISOString();
    const alreadyDone = existing.status === TICKET_STATUS.DONE;

    const updated = await ticketRepository.update(id, {
      status: TICKET_STATUS.DONE,
      ...(alreadyDone ? {} : { completedAt: now }),
      position: topPosition(minPosition),
      updatedAt: now,
    });
    if (!updated) throw new NotFoundError();
    return updated;
  },

  /** FR-007: 상태/순서 변경 */
  async reorder(payload: ReorderTicketPayload): Promise<Ticket[]> {
    const { ticketId, status, position } = payload;
    const existing = await ticketRepository.findById(ticketId);
    if (!existing) throw new NotFoundError();

    // 어떤 쓰기보다 먼저 검사한다. 거부 시 상태도 position도 바뀌면 안 된다. (FR-007)
    if (!canTransition(existing.status, status)) throw new InvalidTransitionError();

    const now = new Date().toISOString();
    const values: TicketWriteValues = { status, position, updatedAt: now };

    // IN_PROGRESS 진입 시 실제 시작일 기록, BACKLOG 복귀 시 초기화
    if (status === TICKET_STATUS.IN_PROGRESS && existing.status !== TICKET_STATUS.IN_PROGRESS) {
      values.startedAt = now;
    }
    if (status === TICKET_STATUS.BACKLOG) {
      values.startedAt = null;
    }
    // DONE 진입 시 완료일 기록, 이미 DONE이면 유지(Done 내 재정렬), DONE 이탈 시 초기화
    if (status === TICKET_STATUS.DONE && existing.status !== TICKET_STATUS.DONE) {
      values.completedAt = now;
    }
    if (status !== TICKET_STATUS.DONE && existing.status === TICKET_STATUS.DONE) {
      values.completedAt = null;
    }

    // 이동 후 칼럼 모습을 미리 계산해 재정렬 필요 여부를 정한다.
    // 티켓 갱신과 재정렬을 한 트랜잭션에 함께 보내기 위함이다.
    const others = (await ticketRepository.findByStatus(status)).filter(
      (ticket) => ticket.id !== ticketId,
    );
    const preview: Ticket[] = [...others, { ...existing, ...values, status, position }].sort(
      (a, b) => a.position - b.position,
    );
    const positions = needsRebalance(preview)
      ? rebalance(preview).map(({ id, position: next }) => ({ id, position: next }))
      : null;

    const updated = await ticketRepository.applyReorder(ticketId, values, positions);
    if (!updated) throw new NotFoundError();

    return positions
      ? preview.map((ticket, index) => ({ ...ticket, position: positions[index].position }))
      : preview;
  },
};
