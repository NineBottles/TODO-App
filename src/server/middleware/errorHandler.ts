import { NextResponse } from 'next/server';
import { logError } from '@/server/middleware/logger';
import { ZodError } from 'zod';
import { NotFoundError } from '@/server/services/ticketService';
import { ERROR_CODE, type ErrorCode } from '@/shared/constants';
import type { ApiError } from '@/shared/types';

export const errorResponse = (
  code: ErrorCode,
  message: string,
  status: number,
  details?: ApiError['error']['details'],
): NextResponse<ApiError> =>
  NextResponse.json<ApiError>({ error: { code, message, ...(details ? { details } : {}) } }, { status });

/** Zod 검증 실패 → 400 (FR-001, FR-004, FR-007) */
export const validationErrorResponse = (error: ZodError): NextResponse<ApiError> =>
  errorResponse(
    ERROR_CODE.VALIDATION_ERROR,
    error.issues[0]?.message ?? '요청 값이 올바르지 않습니다',
    400,
    error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  );

/**
 * Route Handler 공통 에러 변환.
 * 검증 실패와 미존재는 예상된 흐름이므로 로깅하지 않고,
 * 정체불명의 예외만 원본을 로그로 남긴다(응답에는 내부 정보를 노출하지 않음).
 */
export const handleError = (error: unknown, scope = 'api'): NextResponse<ApiError> => {
  if (error instanceof ZodError) return validationErrorResponse(error);
  if (error instanceof NotFoundError) {
    return errorResponse(ERROR_CODE.TICKET_NOT_FOUND, error.message, 404);
  }

  logError(scope, error);
  return errorResponse(ERROR_CODE.INTERNAL_ERROR, '서버 오류가 발생했습니다', 500);
};
