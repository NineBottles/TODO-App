import { NextResponse } from 'next/server';
import { handleError } from '@/server/middleware/errorHandler';
import { parseBody } from '@/server/middleware/validate';
import { ticketService } from '@/server/services/ticketService';
import { reorderTicketSchema } from '@/shared/validations/ticket';

/** PATCH /api/tickets/reorder — 상태/순서 변경 (FR-007) */
export const PATCH = async (request: Request) => {
  try {
    const payload = await parseBody(request, reorderTicketSchema);
    const tickets = await ticketService.reorder(payload);
    return NextResponse.json(tickets, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
};
