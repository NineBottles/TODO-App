import { NextResponse } from 'next/server';
import { handleError } from '@/server/middleware/errorHandler';
import { parseBody, parseValue } from '@/server/middleware/validate';
import { ticketService } from '@/server/services/ticketService';
import { ticketIdSchema, updateTicketSchema } from '@/shared/validations/ticket';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/tickets/:id — 상세 조회 (FR-003) */
export const GET = async (_request: Request, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const ticket = await ticketService.getById(parseValue(id, ticketIdSchema));
    return NextResponse.json(ticket, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
};

/** PATCH /api/tickets/:id — 티켓 수정 (FR-004) */
export const PATCH = async (request: Request, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const payload = await parseBody(request, updateTicketSchema);
    const ticket = await ticketService.update(parseValue(id, ticketIdSchema), payload);
    return NextResponse.json(ticket, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
};

/** DELETE /api/tickets/:id — 티켓 삭제 (FR-006) */
export const DELETE = async (_request: Request, context: RouteContext) => {
  try {
    const { id } = await context.params;
    await ticketService.remove(parseValue(id, ticketIdSchema));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
};
