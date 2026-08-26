/**
 * ticketService 단위 테스트 (FR-001 ~ FR-008)
 *
 * @jest-environment node
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { Ticket } from '@/shared/types';

jest.mock('@/server/db/ticketRepository', () => ({
  ticketRepository: {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStatus: jest.fn(),
    minPosition: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    applyReorder: jest.fn(),
  },
}));

import { ticketRepository } from '@/server/db/ticketRepository';
import { NotFoundError, ticketService } from '@/server/services/ticketService';

const repo = ticketRepository as jest.Mocked<typeof ticketRepository>;

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  title: '티켓',
  description: null,
  status: TICKET_STATUS.BACKLOG,
  priority: TICKET_PRIORITY.MEDIUM,
  position: 0,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const baseCreateInput = {
  title: '새 티켓',
  description: null,
  priority: TICKET_PRIORITY.MEDIUM,
  plannedStartDate: null,
  dueDate: null,
};

describe('ticketService.create (FR-001)', () => {
  beforeEach(() => {
    repo.insert.mockImplementation(async (values) => makeTicket(values as Partial<Ticket>));
  });

  it('status는 항상 BACKLOG로 생성된다', async () => {
    repo.minPosition.mockResolvedValue(null);

    await ticketService.create({ ...baseCreateInput, priority: TICKET_PRIORITY.HIGH });

    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: TICKET_STATUS.BACKLOG, title: '새 티켓' }),
    );
  });

  it('빈 칼럼이면 position은 0이다', async () => {
    repo.minPosition.mockResolvedValue(null);

    await ticketService.create(baseCreateInput);

    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
  });

  it('기존 티켓이 있으면 position은 최솟값 - 1024 (맨 위)', async () => {
    repo.minPosition.mockResolvedValue(0);

    await ticketService.create(baseCreateInput);

    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ position: -1024 }));
  });

  it('최솟값 계산에 칼럼 전체를 읽지 않는다 (min 집계 사용)', async () => {
    repo.minPosition.mockResolvedValue(0);

    await ticketService.create(baseCreateInput);

    expect(repo.minPosition).toHaveBeenCalledWith(TICKET_STATUS.BACKLOG);
    expect(repo.findByStatus).not.toHaveBeenCalled();
  });
});

describe('ticketService.getBoard (FR-002, FR-008)', () => {
  it('4개 칼럼으로 그룹화하고 position 오름차순으로 정렬한다', async () => {
    repo.findAll.mockResolvedValue([
      makeTicket({ id: 1, status: TICKET_STATUS.BACKLOG, position: 100 }),
      makeTicket({ id: 2, status: TICKET_STATUS.BACKLOG, position: -100 }),
      makeTicket({ id: 3, status: TICKET_STATUS.TODO, position: 0 }),
    ]);

    const board = await ticketService.getBoard();

    expect(Object.keys(board).sort()).toEqual(['BACKLOG', 'DONE', 'IN_PROGRESS', 'TODO']);
    expect(board.BACKLOG.map((t) => t.id)).toEqual([2, 1]);
    expect(board.TODO).toHaveLength(1);
    expect(board.IN_PROGRESS).toEqual([]);
  });

  it('dueDate가 지났고 DONE이 아니면 isOverdue = true', async () => {
    repo.findAll.mockResolvedValue([
      makeTicket({ id: 1, dueDate: '2020-01-01', status: TICKET_STATUS.TODO }),
      makeTicket({
        id: 2,
        dueDate: '2020-01-01',
        status: TICKET_STATUS.DONE,
        completedAt: new Date().toISOString(),
      }),
      makeTicket({ id: 3, dueDate: null, status: TICKET_STATUS.TODO }),
    ]);

    const board = await ticketService.getBoard();

    expect(board.TODO.find((t) => t.id === 1)?.isOverdue).toBe(true);
    expect(board.DONE.find((t) => t.id === 2)?.isOverdue).toBe(false);
    expect(board.TODO.find((t) => t.id === 3)?.isOverdue).toBe(false);
  });

  it('completedAt이 null인 DONE 티켓은 숨기지 않는다', async () => {
    repo.findAll.mockResolvedValue([
      makeTicket({ id: 1, status: TICKET_STATUS.DONE, completedAt: null }),
    ]);

    const board = await ticketService.getBoard();

    expect(board.DONE.map((t) => t.id)).toEqual([1]);
  });

  it('DONE 칼럼은 completedAt 기준 24시간 이내 티켓만 포함한다', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    repo.findAll.mockResolvedValue([
      makeTicket({ id: 1, status: TICKET_STATUS.DONE, completedAt: recent }),
      makeTicket({ id: 2, status: TICKET_STATUS.DONE, completedAt: stale }),
    ]);

    const board = await ticketService.getBoard();

    expect(board.DONE.map((t) => t.id)).toEqual([1]);
  });
});

describe('ticketService.getById (FR-003)', () => {
  it('존재하지 않으면 NotFoundError를 던진다', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(ticketService.getById(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ticketService.update (FR-004)', () => {
  it('전송된 필드만 업데이트하고 updatedAt을 갱신한다', async () => {
    repo.findById.mockResolvedValue(makeTicket());
    repo.update.mockResolvedValue(makeTicket({ title: '수정됨' }));

    await ticketService.update(1, { title: '수정됨' });

    const values = repo.update.mock.calls[0][1];
    expect(values).toEqual(expect.objectContaining({ title: '수정됨' }));
    expect(values).not.toHaveProperty('priority');
    expect(values).toHaveProperty('updatedAt');
  });

  it('존재하지 않으면 NotFoundError', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(ticketService.update(1, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ticketService.remove (FR-006)', () => {
  it('존재하지 않으면 NotFoundError', async () => {
    repo.remove.mockResolvedValue(false);
    await expect(ticketService.remove(1)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ticketService.complete (FR-005)', () => {
  it('status를 DONE으로, completedAt을 현재 시각으로 설정한다', async () => {
    repo.findById.mockResolvedValue(makeTicket({ status: TICKET_STATUS.IN_PROGRESS }));
    repo.minPosition.mockResolvedValue(null);
    repo.update.mockResolvedValue(makeTicket({ status: TICKET_STATUS.DONE }));

    await ticketService.complete(1);

    const values = repo.update.mock.calls[0][1];
    expect(values).toEqual(expect.objectContaining({ status: TICKET_STATUS.DONE }));
    expect(typeof values.completedAt).toBe('string');
  });

  it('존재하지 않으면 NotFoundError', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(ticketService.complete(1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('이미 DONE이면 completedAt을 덮어쓰지 않는다 (멱등)', async () => {
    const original = '2026-01-01T00:00:00.000Z';
    repo.findById.mockResolvedValue(
      makeTicket({ status: TICKET_STATUS.DONE, completedAt: original }),
    );
    repo.minPosition.mockResolvedValue(0);
    repo.update.mockResolvedValue(makeTicket({ status: TICKET_STATUS.DONE }));

    await ticketService.complete(1);

    expect(repo.update.mock.calls[0][1].completedAt).toBeUndefined();
  });
});

describe('ticketService.reorder (FR-007)', () => {
  it('IN_PROGRESS로 이동하면 startedAt이 기록된다', async () => {
    repo.findById.mockResolvedValue(makeTicket({ status: TICKET_STATUS.TODO }));
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket({ status: TICKET_STATUS.IN_PROGRESS }));

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.IN_PROGRESS, position: 0 });

    expect(typeof repo.applyReorder.mock.calls[0][1].startedAt).toBe('string');
  });

  it('TODO로 이동해도 startedAt은 기록되지 않는다', async () => {
    repo.findById.mockResolvedValue(makeTicket({ status: TICKET_STATUS.BACKLOG }));
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket({ status: TICKET_STATUS.TODO }));

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.TODO, position: 0 });

    expect(repo.applyReorder.mock.calls[0][1].startedAt).toBeUndefined();
  });

  it('BACKLOG로 되돌리면 startedAt이 null로 초기화된다', async () => {
    repo.findById.mockResolvedValue(
      makeTicket({ status: TICKET_STATUS.IN_PROGRESS, startedAt: '2026-01-01T00:00:00.000Z' }),
    );
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket());

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.BACKLOG, position: 0 });

    expect(repo.applyReorder.mock.calls[0][1].startedAt).toBeNull();
  });

  it('IN_PROGRESS에서 TODO로 되돌려도 startedAt은 유지된다', async () => {
    repo.findById.mockResolvedValue(
      makeTicket({ status: TICKET_STATUS.IN_PROGRESS, startedAt: '2026-01-01T00:00:00.000Z' }),
    );
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket());

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.TODO, position: 0 });

    expect(repo.applyReorder.mock.calls[0][1].startedAt).toBeUndefined();
  });

  it('DONE에서 다른 칼럼으로 되돌리면 completedAt이 null로 초기화된다', async () => {
    repo.findById.mockResolvedValue(
      makeTicket({ status: TICKET_STATUS.DONE, completedAt: '2026-01-01T00:00:00.000Z' }),
    );
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket());

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.IN_PROGRESS, position: 0 });

    expect(repo.applyReorder.mock.calls[0][1].completedAt).toBeNull();
  });

  it('간격이 1 미만이면 칼럼 전체를 1024 간격으로 재정렬한다', async () => {
    repo.findById.mockResolvedValue(makeTicket({ id: 1, status: TICKET_STATUS.TODO }));
    repo.findByStatus.mockResolvedValue([
      makeTicket({ id: 2, status: TICKET_STATUS.TODO, position: 0 }),
      makeTicket({ id: 3, status: TICKET_STATUS.TODO, position: 1 }),
    ]);
    repo.applyReorder.mockResolvedValue(makeTicket());

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.TODO, position: 0 });

    expect(repo.applyReorder.mock.calls[0][2]).toEqual([
      { id: 2, position: 0 },
      { id: 1, position: 1024 },
      { id: 3, position: 2048 },
    ]);
  });

  it('존재하지 않는 티켓이면 NotFoundError', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      ticketService.reorder({ ticketId: 999, status: TICKET_STATUS.TODO, position: 0 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('DONE으로 처음 이동하면 completedAt이 기록된다', async () => {
    repo.findById.mockResolvedValue(makeTicket({ status: TICKET_STATUS.IN_PROGRESS }));
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket({ status: TICKET_STATUS.DONE }));

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.DONE, position: 0 });

    expect(typeof repo.applyReorder.mock.calls[0][1].completedAt).toBe('string');
  });

  it('Done 칼럼 안에서 순서만 바꾸면 completedAt을 건드리지 않는다', async () => {
    repo.findById.mockResolvedValue(
      makeTicket({ status: TICKET_STATUS.DONE, completedAt: '2026-01-01T00:00:00.000Z' }),
    );
    repo.findByStatus.mockResolvedValue([]);
    repo.applyReorder.mockResolvedValue(makeTicket({ status: TICKET_STATUS.DONE }));

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.DONE, position: 0 });

    expect(repo.applyReorder.mock.calls[0][1].completedAt).toBeUndefined();
  });

  it('티켓 갱신과 재정렬을 한 번의 트랜잭션 호출로 처리한다', async () => {
    repo.findById.mockResolvedValue(makeTicket({ id: 1, status: TICKET_STATUS.TODO }));
    repo.findByStatus.mockResolvedValue([
      makeTicket({ id: 2, status: TICKET_STATUS.TODO, position: 0 }),
      makeTicket({ id: 3, status: TICKET_STATUS.TODO, position: 1 }),
    ]);
    repo.applyReorder.mockResolvedValue(makeTicket());

    await ticketService.reorder({ ticketId: 1, status: TICKET_STATUS.TODO, position: 0 });

    expect(repo.applyReorder).toHaveBeenCalledTimes(1);
    expect(repo.applyReorder.mock.calls[0][2]).toEqual([
      { id: 2, position: 0 },
      { id: 1, position: 1024 },
      { id: 3, position: 2048 },
    ]);
  });
});
