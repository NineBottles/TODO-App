/**
 * Route Handler 테스트 (FR-001 ~ FR-007)
 *
 * @jest-environment node
 */
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { Ticket } from '@/shared/types';

jest.mock('@/server/services/ticketService', () => {
  class NotFoundError extends Error {
    readonly code = 'TICKET_NOT_FOUND';
    constructor(message = '티켓을 찾을 수 없습니다') {
      super(message);
      this.name = 'NotFoundError';
    }
  }
  class InvalidTransitionError extends Error {
    readonly code = 'INVALID_TRANSITION';
    constructor(message = '단계별로 일감을 관리해 주세요') {
      super(message);
      this.name = 'InvalidTransitionError';
    }
  }
  return {
    NotFoundError,
    InvalidTransitionError,
    ticketService: {
      getBoard: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      complete: jest.fn(),
      reorder: jest.fn(),
    },
  };
});

import {
  InvalidTransitionError,
  NotFoundError,
  ticketService,
} from '@/server/services/ticketService';
import { GET as getBoard, POST as postTicket } from '../../app/api/tickets/route';
import {
  DELETE as deleteTicket,
  GET as getTicket,
  PATCH as patchTicket,
} from '../../app/api/tickets/[id]/route';
import { PATCH as completeTicket } from '../../app/api/tickets/[id]/complete/route';
import { PATCH as reorderTicket } from '../../app/api/tickets/reorder/route';

const service = ticketService as jest.Mocked<typeof ticketService>;

const ticket: Ticket = {
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
};

const jsonRequest = (body: unknown) =>
  new Request('http://localhost/api/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/tickets (FR-002)', () => {
  it('200과 보드 데이터를 반환한다', async () => {
    service.getBoard.mockResolvedValue({ BACKLOG: [], TODO: [], IN_PROGRESS: [], DONE: [] });

    const response = await getBoard();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    });
  });
});

describe('POST /api/tickets (FR-001)', () => {
  it('201과 생성된 티켓을 반환한다', async () => {
    service.create.mockResolvedValue(ticket);

    const response = await postTicket(jsonRequest({ title: '새 티켓' }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(ticket);
  });

  it('검증 실패 시 400과 에러 메시지를 반환한다', async () => {
    const response = await postTicket(jsonRequest({ title: '' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('제목을 입력해주세요');
  });

  it('TC-API-001b: JSON으로 파싱할 수 없는 본문이면 400', async () => {
    // jsonRequest는 JSON.stringify를 쓰므로 깨진 본문을 만들 수 없다. 직접 생성한다.
    const response = await postTicket(
      new Request('http://localhost/api/tickets', {
        method: 'POST',
        body: '{bad',
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'JSON 형식의 요청 본문이 필요합니다' },
    });
    expect(service.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/tickets/:id (FR-003)', () => {
  it('200과 티켓을 반환한다', async () => {
    service.getById.mockResolvedValue(ticket);

    const response = await getTicket(new Request('http://localhost'), params('1'));

    expect(response.status).toBe(200);
    expect(service.getById).toHaveBeenCalledWith(1);
  });

  it('존재하지 않으면 404를 반환한다', async () => {
    service.getById.mockRejectedValue(new NotFoundError());

    const response = await getTicket(new Request('http://localhost'), params('999'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toEqual({ code: 'TICKET_NOT_FOUND', message: '티켓을 찾을 수 없습니다' });
  });

  it('TC-API-003b: id가 숫자가 아니면 400 (서비스까지 가지 않는다)', async () => {
    const response = await getTicket(new Request('http://localhost'), params('abc'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(service.getById).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/tickets/:id (FR-004)', () => {
  it('200과 수정된 티켓을 반환한다', async () => {
    service.update.mockResolvedValue({ ...ticket, title: '수정됨' });

    const response = await patchTicket(jsonRequest({ title: '수정됨' }), params('1'));

    expect(response.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(1, { title: '수정됨' });
  });

  it('제목이 200자를 넘으면 400', async () => {
    const response = await patchTicket(jsonRequest({ title: 'a'.repeat(201) }), params('1'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: '제목은 200자 이내로 입력해주세요' },
    });
  });
});

describe('DELETE /api/tickets/:id (FR-006)', () => {
  it('204를 반환한다', async () => {
    service.remove.mockResolvedValue(undefined);

    const response = await deleteTicket(new Request('http://localhost'), params('1'));

    expect(response.status).toBe(204);
  });

  it('존재하지 않으면 404', async () => {
    service.remove.mockRejectedValue(new NotFoundError());

    const response = await deleteTicket(new Request('http://localhost'), params('1'));

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/tickets/:id/complete (FR-005)', () => {
  it('200과 완료 처리된 티켓을 반환한다', async () => {
    service.complete.mockResolvedValue({ ...ticket, status: TICKET_STATUS.DONE });

    const response = await completeTicket(new Request('http://localhost'), params('1'));

    expect(response.status).toBe(200);
    expect(service.complete).toHaveBeenCalledWith(1);
  });

  it('TC-API-005b: 단계를 건너뛴 완료는 400 INVALID_TRANSITION', async () => {
    service.complete.mockRejectedValue(new InvalidTransitionError());

    const response = await completeTicket(new Request('http://localhost'), params('1'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_TRANSITION', message: '단계별로 일감을 관리해 주세요' },
    });
  });

  it('TC-API-005a: 존재하지 않으면 404', async () => {
    service.complete.mockRejectedValue(new NotFoundError());

    const response = await completeTicket(new Request('http://localhost'), params('999'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TICKET_NOT_FOUND', message: '티켓을 찾을 수 없습니다' },
    });
  });
});

describe('PATCH /api/tickets/reorder (FR-007)', () => {
  it('200과 갱신된 티켓 목록을 반환한다', async () => {
    service.reorder.mockResolvedValue([ticket]);

    const response = await reorderTicket(
      jsonRequest({ ticketId: 1, status: TICKET_STATUS.TODO, position: 1024 }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([ticket]);
  });

  it('status가 DONE이어도 허용한다 (Done 칼럼 내 재정렬)', async () => {
    service.reorder.mockResolvedValue([ticket]);

    const response = await reorderTicket(
      jsonRequest({ ticketId: 1, status: TICKET_STATUS.DONE, position: 0 }),
    );

    expect(response.status).toBe(200);
    expect(service.reorder).toHaveBeenCalledWith(
      expect.objectContaining({ status: TICKET_STATUS.DONE }),
    );
  });

  it('정의되지 않은 status는 400', async () => {
    const response = await reorderTicket(
      jsonRequest({ ticketId: 1, status: 'ARCHIVED', position: 0 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: '상태는 BACKLOG, TODO, IN_PROGRESS, DONE 중 선택해주세요' },
    });
  });

  it('존재하지 않는 티켓이면 404', async () => {
    service.reorder.mockRejectedValue(new NotFoundError());

    const response = await reorderTicket(
      jsonRequest({ ticketId: 999, status: TICKET_STATUS.TODO, position: 0 }),
    );

    expect(response.status).toBe(404);
  });

  it('TC-API-007e: 단계를 건너뛴 이동은 400 INVALID_TRANSITION', async () => {
    service.reorder.mockRejectedValue(new InvalidTransitionError());

    const response = await reorderTicket(
      jsonRequest({ ticketId: 1, status: TICKET_STATUS.DONE, position: 0 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_TRANSITION', message: '단계별로 일감을 관리해 주세요' },
    });
  });

  it('TC-API-007c: position이 소수면 400 (position은 정수 컬럼)', async () => {
    const response = await reorderTicket(
      jsonRequest({ ticketId: 1, status: TICKET_STATUS.TODO, position: 0.5 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(service.reorder).not.toHaveBeenCalled();
  });
});
