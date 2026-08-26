import type { ErrorCode, TicketPriority, TicketStatus } from '@/shared/constants';

export type { TicketPriority, TicketStatus };

/** DB에 저장되는 티켓 원본 */
export type Ticket = {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  position: number;
  /** 계획 시작일 (YYYY-MM-DD) */
  plannedStartDate: string | null;
  /** 계획 종료일 (YYYY-MM-DD) */
  dueDate: string | null;
  /** 실제 시작일 (ISO 8601) */
  startedAt: string | null;
  /** 실제 종료일 (ISO 8601) */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 조회 시 파생 필드가 붙은 티켓 */
export type TicketView = Ticket & {
  /** dueDate < 오늘 AND status !== DONE */
  isOverdue: boolean;
};

/** 칼럼별로 그룹화된 보드 데이터 */
export type BoardData = Record<TicketStatus, TicketView[]>;

export type ApiError = {
  error: {
    code: ErrorCode;
    message: string;
    details?: { field: string; message: string }[];
  };
};
