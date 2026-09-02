export const TICKET_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/** 보드 칼럼 순서 (고정) */
export const COLUMN_ORDER = [
  TICKET_STATUS.BACKLOG,
  TICKET_STATUS.TODO,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.DONE,
] as const;

export const COLUMN_LABEL: Record<TicketStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'TODO',
  IN_PROGRESS: 'In-Progress',
  DONE: 'Done',
};

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type TicketPriority = (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY];

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
};

/**
 * 오버듀 판정과 날짜 비교에 쓰는 고정 타임존. (FR-008)
 * 실행 환경의 로컬 타임존(Vercel은 UTC)을 쓰면 KST 사용자와 하루가 어긋나고,
 * SSR 결과와 클라이언트 재계산 값이 불일치한다.
 */
export const APP_TIMEZONE = 'Asia/Seoul';

/** position 재계산 기본 간격 */
export const POSITION_GAP = 1024;

/** Done 칼럼 노출 기간 (24시간, ms) */
export const DONE_VISIBLE_MS = 24 * 60 * 60 * 1000;

export const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  /** 단계를 건너뛴 칼럼 이동 (FR-007) */
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
