import { NextResponse } from 'next/server';
import { handleError } from '@/server/middleware/errorHandler';
import { parseValue } from '@/server/middleware/validate';
import { ticketService } from '@/server/services/ticketService';
import { ticketIdSchema } from '@/shared/validations/ticket';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/tickets/:id/complete — 완료 처리 (FR-005) */
export const PATCH = async (_request: Request, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const ticket = await ticketService.complete(parseValue(id, ticketIdSchema));
    return NextResponse.json(ticket, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
};
