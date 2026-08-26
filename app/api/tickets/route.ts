import { NextResponse } from 'next/server';
import { handleError } from '@/server/middleware/errorHandler';
import { parseBody } from '@/server/middleware/validate';
import { ticketService } from '@/server/services/ticketService';
import { createTicketSchema } from '@/shared/validations/ticket';

export const dynamic = 'force-dynamic';

/** GET /api/tickets — 보드 조회 (FR-002) */
export const GET = async () => {
  try {
    const board = await ticketService.getBoard();
    return NextResponse.json(board, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
};

/** POST /api/tickets — 티켓 생성 (FR-001) */
export const POST = async (request: Request) => {
  try {
    const payload = await parseBody(request, createTicketSchema);
    const ticket = await ticketService.create(payload);
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
};
