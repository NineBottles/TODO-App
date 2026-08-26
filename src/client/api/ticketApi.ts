import type { TicketStatus } from '@/shared/constants';
import type { ApiError, BoardData, Ticket } from '@/shared/types';
import type { CreateTicketInput, UpdateTicketPayload } from '@/shared/validations/ticket';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body?.error.code ?? 'INTERNAL_ERROR',
      body?.error.message ?? '요청을 처리하지 못했습니다',
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

/** GET /api/tickets (FR-002) */
export const fetchBoard = () => request<BoardData>('/api/tickets', { cache: 'no-store' });

/** GET /api/tickets/:id (FR-003) */
export const fetchTicket = (id: number) => request<Ticket>(`/api/tickets/${id}`);

/** POST /api/tickets (FR-001) */
export const createTicket = (input: CreateTicketInput) =>
  request<Ticket>('/api/tickets', { method: 'POST', body: JSON.stringify(input) });

/** PATCH /api/tickets/:id (FR-004) */
export const updateTicket = (id: number, input: UpdateTicketPayload) =>
  request<Ticket>(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

/** DELETE /api/tickets/:id (FR-006) */
export const deleteTicket = (id: number) =>
  request<void>(`/api/tickets/${id}`, { method: 'DELETE' });

/** PATCH /api/tickets/:id/complete (FR-005) */
export const completeTicket = (id: number) =>
  request<Ticket>(`/api/tickets/${id}/complete`, { method: 'PATCH' });

/** PATCH /api/tickets/reorder (FR-007) */
export const reorderTicket = (input: {
  ticketId: number;
  /** DONE 포함 4개 칼럼 모두 허용 — Done 칼럼 내 재정렬에 필요하다 (FR-007) */
  status: TicketStatus;
  position: number;
}) => request<Ticket[]>('/api/tickets/reorder', { method: 'PATCH', body: JSON.stringify(input) });
