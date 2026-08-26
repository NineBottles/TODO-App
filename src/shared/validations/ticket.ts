import { z } from 'zod';
import { APP_TIMEZONE, TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';

const PRIORITY_MESSAGE = '우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요';
const DUE_DATE_MESSAGE = '종료예정일은 오늘 이후 날짜를 선택해주세요';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 오늘 날짜를 YYYY-MM-DD로 반환한다. (FR-008)
 * 실행 환경 타임존이 아니라 APP_TIMEZONE 기준으로 계산해 서버/클라이언트 결과를 일치시킨다.
 * en-CA 로케일은 YYYY-MM-DD 형식을 반환한다.
 */
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const todayString = (now: Date = new Date()): string => DATE_FORMATTER.format(now);

/** 달력상 실재하는 날짜인지 확인한다 (2020-13-99 같은 값을 거른다) */
const isRealDate = (value: string): boolean => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const dateString = z
  .string()
  .regex(DATE_PATTERN, { message: '날짜 형식은 YYYY-MM-DD 이어야 합니다' })
  .refine(isRealDate, { message: '날짜 형식은 YYYY-MM-DD 이어야 합니다' });

const futureDateString = dateString.refine((value) => value >= todayString(), {
  message: DUE_DATE_MESSAGE,
});

export const prioritySchema = z.enum(
  [TICKET_PRIORITY.LOW, TICKET_PRIORITY.MEDIUM, TICKET_PRIORITY.HIGH],
  { errorMap: () => ({ message: PRIORITY_MESSAGE }) },
);

export const titleSchema = z
  .string({ required_error: '제목을 입력해주세요' })
  .trim()
  .min(1, { message: '제목을 입력해주세요' })
  .max(200, { message: '제목은 200자 이내로 입력해주세요' });

export const descriptionSchema = z
  .string()
  .max(1000, { message: '설명은 1000자 이내로 입력해주세요' });

/** POST /api/tickets — 생성 시에만 dueDate에 "오늘 이후" 제약을 건다 (FR-001) */
export const createTicketSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.nullish(),
  priority: prioritySchema.default(TICKET_PRIORITY.MEDIUM),
  plannedStartDate: dateString.nullish(),
  dueDate: futureDateString.nullish(),
});

export type CreateTicketInput = z.input<typeof createTicketSchema>;
export type CreateTicketPayload = z.output<typeof createTicketSchema>;

/**
 * 폼 검증용 — dueDate는 형식만 검증한다.
 * 기한이 지난(오버듀) 티켓의 다른 필드를 수정할 수 있어야 하므로,
 * 사용자가 날짜를 새로 고르지 않은 경우에는 이 스키마를 쓴다. (FR-004)
 */
export const ticketFormSchema = createTicketSchema.extend({
  dueDate: dateString.nullish(),
});

/**
 * PATCH /api/tickets/:id — 전송된 필드만 수정.
 * dueDate에 "오늘 이후" 제약을 걸지 않는다. 걸면 오버듀 티켓을 영원히 수정할 수 없다. (FR-004)
 */
export const updateTicketSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.nullable(),
    priority: prioritySchema,
    plannedStartDate: dateString.nullable(),
    dueDate: dateString.nullable(),
  })
  .partial();

export type UpdateTicketPayload = z.infer<typeof updateTicketSchema>;

/**
 * PATCH /api/tickets/reorder — DONE 포함 4개 칼럼 모두 허용한다. (FR-007)
 * Done 칼럼 안에서 순서만 바꾸는 조작을 표현할 수단이 필요하기 때문이다.
 */
export const reorderTicketSchema = z.object({
  ticketId: z.number().int().positive(),
  status: z.enum(
    [TICKET_STATUS.BACKLOG, TICKET_STATUS.TODO, TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.DONE],
    { errorMap: () => ({ message: '상태는 BACKLOG, TODO, IN_PROGRESS, DONE 중 선택해주세요' }) },
  ),
  position: z.number().int(),
});

export type ReorderTicketPayload = z.infer<typeof reorderTicketSchema>;

export const ticketIdSchema = z.coerce.number().int().positive();
