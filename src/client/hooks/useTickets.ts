'use client';

import { useCallback, useState } from 'react';
import * as ticketApi from '@/client/api/ticketApi';
import { COLUMN_ORDER, TICKET_STATUS, type TicketStatus } from '@/shared/constants';
import { calculatePosition } from '@/shared/position';
import type { BoardData, Ticket, TicketView } from '@/shared/types';
import { todayString } from '@/shared/validations/ticket';
import type { CreateTicketInput, UpdateTicketPayload } from '@/shared/validations/ticket';

/** FR-008: 클라이언트 사이드 오버듀 판정 */
const withOverdue = (ticket: Ticket): TicketView => ({
  ...ticket,
  isOverdue:
    ticket.dueDate !== null &&
    ticket.dueDate < todayString() &&
    ticket.status !== TICKET_STATUS.DONE,
});

const cloneBoard = (board: BoardData): BoardData =>
  Object.fromEntries(COLUMN_ORDER.map((status) => [status, [...board[status]]])) as BoardData;

const findTicket = (board: BoardData, id: number): TicketView | undefined =>
  COLUMN_ORDER.flatMap((status) => board[status]).find((ticket) => ticket.id === id);

export const useTickets = (initialBoard: BoardData) => {
  const [board, setBoard] = useState<BoardData>(initialBoard);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await ticketApi.fetchBoard();
    setBoard(next);
  }, []);

  const createTicket = useCallback(async (input: CreateTicketInput) => {
    const created = await ticketApi.createTicket(input);
    setBoard((prev) => ({ ...prev, BACKLOG: [withOverdue(created), ...prev.BACKLOG] }));
    return created;
  }, []);

  const updateTicket = useCallback(async (id: number, input: UpdateTicketPayload) => {
    const updated = await ticketApi.updateTicket(id, input);
    setBoard((prev) => {
      const next = cloneBoard(prev);
      next[updated.status] = next[updated.status].map((ticket) =>
        ticket.id === id ? withOverdue(updated) : ticket,
      );
      return next;
    });
    return updated;
  }, []);

  const deleteTicket = useCallback(async (id: number) => {
    await ticketApi.deleteTicket(id);
    setBoard((prev) => {
      const next = cloneBoard(prev);
      for (const status of COLUMN_ORDER) {
        next[status] = next[status].filter((ticket) => ticket.id !== id);
      }
      return next;
    });
  }, []);

  /**
   * FR-007: 드래그앤드롭 이동. 낙관적 업데이트 후 실패 시 롤백한다. (NFR-004)
   */
  const moveTicket = useCallback(
    async (ticketId: number, toStatus: TicketStatus, targetIndex: number) => {
      const snapshot = board;
      const moving = findTicket(board, ticketId);
      if (!moving) return;

      const next = cloneBoard(board);
      for (const status of COLUMN_ORDER) {
        next[status] = next[status].filter((ticket) => ticket.id !== ticketId);
      }

      const destination = next[toStatus];
      const index = Math.max(0, Math.min(targetIndex, destination.length));
      const position = calculatePosition(destination, index);
      const movedTicket = withOverdue({
        ...moving,
        status: toStatus,
        position,
        startedAt:
          toStatus === TICKET_STATUS.BACKLOG
            ? null
            : toStatus === TICKET_STATUS.IN_PROGRESS && moving.status !== TICKET_STATUS.IN_PROGRESS
              ? new Date().toISOString()
              : moving.startedAt,
        completedAt:
          toStatus === TICKET_STATUS.DONE
            ? (moving.completedAt ?? new Date().toISOString())
            : null,
      });
      destination.splice(index, 0, movedTicket);

      setBoard(next);
      setError(null);

      try {
        // Done에 "처음 진입"할 때만 완료 API를 쓴다.
        // 이미 DONE인 티켓에 완료 API를 쓰면 completedAt이 재기록되어
        // 실제 완료 시각이 사라지고 24시간 노출 창이 리셋된다. (FR-005)
        if (toStatus === TICKET_STATUS.DONE && moving.status !== TICKET_STATUS.DONE) {
          await ticketApi.completeTicket(ticketId);
        } else {
          await ticketApi.reorderTicket({ ticketId, status: toStatus, position });
        }
      } catch (cause) {
        setBoard(snapshot);
        setError(cause instanceof Error ? cause.message : '이동에 실패했습니다');
        return;
      }

      // 이동은 이미 성공했다. 재동기화 실패로 롤백하면 화면과 서버가 어긋난다. (NFR-004)
      try {
        await refresh();
      } catch {
        setError('최신 상태를 불러오지 못했습니다. 새로고침해주세요.');
      }
    },
    [board, refresh],
  );

  return { board, error, setError, refresh, createTicket, updateTicket, deleteTicket, moveTicket };
};
