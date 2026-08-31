import { act, renderHook, waitFor } from '@testing-library/react';
import { useTickets } from '@/client/hooks/useTickets';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { BoardData, TicketView } from '@/shared/types';

jest.mock('@/client/api/ticketApi', () => ({
  fetchBoard: jest.fn(),
  createTicket: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
  completeTicket: jest.fn(),
  reorderTicket: jest.fn(),
}));

import * as ticketApi from '@/client/api/ticketApi';

const api = ticketApi as jest.Mocked<typeof ticketApi>;

const makeTicket = (id: number, status: TicketView['status'], position: number): TicketView => ({
  id,
  title: `티켓 ${id}`,
  description: null,
  status,
  priority: TICKET_PRIORITY.MEDIUM,
  position,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  isOverdue: false,
});

const initialBoard = (): BoardData => ({
  BACKLOG: [makeTicket(1, TICKET_STATUS.BACKLOG, 0)],
  TODO: [makeTicket(2, TICKET_STATUS.TODO, 0)],
  IN_PROGRESS: [],
  DONE: [],
});

/** IN_PROGRESS에 티켓 3번이 있는 보드. DONE 진입은 IN_PROGRESS에서만 가능하다 (FR-007) */
const boardWithInProgress = (): BoardData => ({
  ...initialBoard(),
  IN_PROGRESS: [makeTicket(3, TICKET_STATUS.IN_PROGRESS, 0)],
});

describe('useTickets (FR-007, NFR-004)', () => {
  it('BACKLOG → TODO 이동 시 낙관적으로 보드를 갱신하고 reorder API를 호출한다', async () => {
    api.reorderTicket.mockResolvedValue([]);
    api.fetchBoard.mockResolvedValue(initialBoard());

    const { result } = renderHook(() => useTickets(initialBoard()));

    await act(async () => {
      await result.current.moveTicket(1, TICKET_STATUS.TODO, 1);
    });

    expect(api.reorderTicket).toHaveBeenCalledWith({
      ticketId: 1,
      status: TICKET_STATUS.TODO,
      position: 1024,
    });
  });

  it('TC-INT-002: IN_PROGRESS → DONE 이동은 complete API를 호출한다 (FR-005)', async () => {
    const board = boardWithInProgress();
    api.completeTicket.mockResolvedValue(makeTicket(3, TICKET_STATUS.DONE, 0));
    api.fetchBoard.mockResolvedValue(board);

    const { result } = renderHook(() => useTickets(board));

    await act(async () => {
      await result.current.moveTicket(3, TICKET_STATUS.DONE, 0);
    });

    expect(api.completeTicket).toHaveBeenCalledWith(3);
    expect(api.reorderTicket).not.toHaveBeenCalled();
  });

  it('이동 API는 성공했는데 refresh만 실패하면 롤백하지 않는다', async () => {
    api.reorderTicket.mockResolvedValue([]);
    api.fetchBoard.mockRejectedValue(new Error('네트워크 오류'));

    const { result } = renderHook(() => useTickets(initialBoard()));

    await act(async () => {
      await result.current.moveTicket(1, TICKET_STATUS.TODO, 1);
    });

    // 서버에는 반영됐으므로 화면도 이동한 상태를 유지해야 한다
    expect(result.current.board.BACKLOG.map((t) => t.id)).toEqual([]);
    expect(result.current.board.TODO.map((t) => t.id)).toEqual([2, 1]);
  });

  it('이미 DONE인 티켓을 Done 안에서 옮기면 complete가 아니라 reorder를 쓴다', async () => {
    const board = initialBoard();
    board.DONE = [
      { ...makeTicket(5, TICKET_STATUS.DONE, 0), completedAt: '2026-01-01T00:00:00.000Z' },
      { ...makeTicket(6, TICKET_STATUS.DONE, 1024), completedAt: '2026-01-01T00:00:00.000Z' },
    ];
    api.reorderTicket.mockResolvedValue([]);
    api.fetchBoard.mockResolvedValue(board);

    const { result } = renderHook(() => useTickets(board));

    await act(async () => {
      await result.current.moveTicket(5, TICKET_STATUS.DONE, 1);
    });

    expect(api.completeTicket).not.toHaveBeenCalled();
    expect(api.reorderTicket).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 5, status: TICKET_STATUS.DONE }),
    );
  });

  it('TC-INT-006: DONE이 아니던 티켓을 Done으로 옮길 때만 complete를 쓴다', async () => {
    const board = boardWithInProgress();
    api.completeTicket.mockResolvedValue(makeTicket(3, TICKET_STATUS.DONE, 0));
    api.fetchBoard.mockResolvedValue(board);

    const { result } = renderHook(() => useTickets(board));

    await act(async () => {
      await result.current.moveTicket(3, TICKET_STATUS.DONE, 0);
    });

    expect(api.completeTicket).toHaveBeenCalledWith(3);
  });

  it('API 실패 시 이전 상태로 롤백하고 에러를 노출한다', async () => {
    api.reorderTicket.mockRejectedValue(new Error('이동에 실패했습니다'));

    const { result } = renderHook(() => useTickets(initialBoard()));

    await act(async () => {
      await result.current.moveTicket(1, TICKET_STATUS.TODO, 0);
    });

    await waitFor(() => expect(result.current.error).toBe('이동에 실패했습니다'));
    expect(result.current.board.BACKLOG.map((t) => t.id)).toEqual([1]);
    expect(result.current.board.TODO.map((t) => t.id)).toEqual([2]);
  });

  it('생성된 티켓은 BACKLOG 맨 위에 추가된다 (FR-001)', async () => {
    api.createTicket.mockResolvedValue(makeTicket(9, TICKET_STATUS.BACKLOG, -1024));

    const { result } = renderHook(() => useTickets(initialBoard()));

    await act(async () => {
      await result.current.createTicket({ title: '새 티켓' });
    });

    expect(result.current.board.BACKLOG.map((t) => t.id)).toEqual([9, 1]);
  });

  it('삭제한 티켓은 보드에서 사라진다 (FR-006)', async () => {
    api.deleteTicket.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTickets(initialBoard()));

    await act(async () => {
      await result.current.deleteTicket(2);
    });

    expect(result.current.board.TODO).toEqual([]);
  });

  it('수정한 티켓이 보드에 반영된다 (FR-004)', async () => {
    api.updateTicket.mockResolvedValue({
      ...makeTicket(2, TICKET_STATUS.TODO, 0),
      title: '수정됨',
    });

    const { result } = renderHook(() => useTickets(initialBoard()));

    await act(async () => {
      await result.current.updateTicket(2, { title: '수정됨' });
    });

    expect(result.current.board.TODO[0].title).toBe('수정됨');
  });
});

describe('useTickets 단계 전이 차단 (FR-007)', () => {
  it('TC-INT-007: TODO 티켓을 DONE으로 옮기면 차단하고 보드를 그대로 둔다', async () => {
    const { result } = renderHook(() => useTickets(initialBoard()));

    let outcome;
    await act(async () => {
      outcome = await result.current.moveTicket(2, TICKET_STATUS.DONE, 0);
    });

    expect(outcome).toEqual({ blocked: true, message: '단계별로 일감을 관리해 주세요' });
    expect(api.completeTicket).not.toHaveBeenCalled();
    expect(api.reorderTicket).not.toHaveBeenCalled();
    // 낙관적 업데이트조차 하지 않는다 — 그 자리에서 변동 없음
    expect(result.current.board.TODO.map((t) => t.id)).toEqual([2]);
    expect(result.current.board.DONE).toEqual([]);
  });

  it('TC-INT-008: BACKLOG 티켓을 IN_PROGRESS로 옮겨도 차단한다', async () => {
    const { result } = renderHook(() => useTickets(initialBoard()));

    let outcome;
    await act(async () => {
      outcome = await result.current.moveTicket(1, TICKET_STATUS.IN_PROGRESS, 0);
    });

    expect(outcome).toEqual({ blocked: true, message: '단계별로 일감을 관리해 주세요' });
    expect(api.reorderTicket).not.toHaveBeenCalled();
    expect(result.current.board.BACKLOG.map((t) => t.id)).toEqual([1]);
    expect(result.current.board.IN_PROGRESS).toEqual([]);
  });

  it('TC-INT-009: 역방향(DONE → BACKLOG)은 차단하지 않는다', async () => {
    const board = initialBoard();
    board.DONE = [{ ...makeTicket(7, TICKET_STATUS.DONE, 0), completedAt: '2026-01-01T00:00:00.000Z' }];
    api.reorderTicket.mockResolvedValue([]);
    api.fetchBoard.mockResolvedValue(board);

    const { result } = renderHook(() => useTickets(board));

    await act(async () => {
      await result.current.moveTicket(7, TICKET_STATUS.BACKLOG, 0);
    });

    expect(api.reorderTicket).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 7, status: TICKET_STATUS.BACKLOG }),
    );
  });
});
