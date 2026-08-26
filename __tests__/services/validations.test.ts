/** @jest-environment node */
import { TICKET_PRIORITY } from '@/shared/constants';
import {
  createTicketSchema,
  reorderTicketSchema,
  todayString,
  updateTicketSchema,
} from '@/shared/validations/ticket';
import { calculatePosition, needsRebalance, rebalance } from '@/shared/position';
import type { z } from 'zod';

const firstMessage = (result: z.SafeParseReturnType<unknown, unknown>) =>
  result.success ? undefined : result.error.issues[0]?.message;

describe('createTicketSchema (FR-001)', () => {
  it('제목만 있으면 통과하고 priority 기본값은 MEDIUM', () => {
    const result = createTicketSchema.safeParse({ title: '할 일' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.priority).toBe(TICKET_PRIORITY.MEDIUM);
  });

  it.each([
    [{ title: '' }, '제목을 입력해주세요'],
    [{ title: '   ' }, '제목을 입력해주세요'],
    [{ title: 'a'.repeat(201) }, '제목은 200자 이내로 입력해주세요'],
    [{ title: 'a', description: 'b'.repeat(1001) }, '설명은 1000자 이내로 입력해주세요'],
    [{ title: 'a', priority: 'URGENT' }, '우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요'],
    [{ title: 'a', dueDate: '2020-01-01' }, '종료예정일은 오늘 이후 날짜를 선택해주세요'],
  ])('검증 실패: %p', (input, message) => {
    const result = createTicketSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe(message);
  });
});

describe('updateTicketSchema (FR-004)', () => {
  it('부분 수정이 가능하다', () => {
    expect(updateTicketSchema.safeParse({ title: '수정' }).success).toBe(true);
    expect(updateTicketSchema.safeParse({}).success).toBe(true);
  });

  it('description/dueDate에 null을 허용한다', () => {
    expect(updateTicketSchema.safeParse({ description: null, dueDate: null }).success).toBe(true);
  });

  it('TC-SVC-028a: 과거 dueDate를 허용한다 (오버듀 티켓도 수정 가능해야 함)', () => {
    expect(updateTicketSchema.safeParse({ dueDate: '2020-01-01' }).success).toBe(true);
    expect(
      updateTicketSchema.safeParse({ title: '제목만 수정', dueDate: '2020-01-01' }).success,
    ).toBe(true);
  });

  it('TC-SVC-028b: 날짜 형식 검증은 유지한다', () => {
    const result = updateTicketSchema.safeParse({ dueDate: '2020-13-99' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('날짜 형식은 YYYY-MM-DD 이어야 합니다');
  });
});

describe('reorderTicketSchema (FR-007)', () => {
  it('DONE도 허용한다 (Done 칼럼 내 재정렬용)', () => {
    expect(
      reorderTicketSchema.safeParse({ ticketId: 1, status: 'DONE', position: 0 }).success,
    ).toBe(true);
  });

  it('정의되지 않은 상태는 거부한다', () => {
    const result = reorderTicketSchema.safeParse({ ticketId: 1, status: 'ARCHIVED', position: 0 });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('상태는 BACKLOG, TODO, IN_PROGRESS, DONE 중 선택해주세요');
  });
});

describe('todayString — 고정 타임존 (FR-008)', () => {
  it('실행 환경 타임존과 무관하게 APP_TIMEZONE 기준 날짜를 반환한다', () => {
    // 2026-03-02T00:30:00Z = KST 2026-03-02 09:30 → 같은 날
    expect(todayString(new Date('2026-03-02T00:30:00.000Z'))).toBe('2026-03-02');
    // 2026-03-01T16:00:00Z = KST 2026-03-02 01:00 → UTC로는 아직 3/1
    expect(todayString(new Date('2026-03-01T16:00:00.000Z'))).toBe('2026-03-02');
    // 2026-03-01T14:59:00Z = KST 2026-03-01 23:59
    expect(todayString(new Date('2026-03-01T14:59:00.000Z'))).toBe('2026-03-01');
  });

  it('YYYY-MM-DD 형식을 지킨다', () => {
    expect(todayString(new Date('2026-01-05T00:00:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('position 유틸 (FR-007)', () => {
  const column = [
    { id: 1, position: 0 },
    { id: 2, position: 1024 },
  ];

  it('빈 칼럼이면 0', () => {
    expect(calculatePosition([], 0)).toBe(0);
  });

  it('맨 앞 삽입은 첫 카드 - 1024', () => {
    expect(calculatePosition(column, 0)).toBe(-1024);
  });

  it('맨 뒤 삽입은 마지막 카드 + 1024', () => {
    expect(calculatePosition(column, 2)).toBe(2048);
  });

  it('사이 삽입은 (prev + next) / 2', () => {
    expect(calculatePosition(column, 1)).toBe(512);
  });

  it('TC-SVC-033a: 인접한 카드 사이에 삽입해도 정수를 반환한다', () => {
    const adjacent = [
      { id: 1, position: 0 },
      { id: 2, position: 1 },
    ];
    const result = calculatePosition(adjacent, 1);

    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(0);
  });

  it('TC-SVC-033b: 중간값이 소수가 되면 내림 처리한다', () => {
    const gap3 = [
      { id: 1, position: 0 },
      { id: 2, position: 3 },
    ];
    expect(calculatePosition(gap3, 1)).toBe(1);
  });

  it('반복 삽입에도 항상 정수를 유지한다 (reorder 스키마가 int만 허용)', () => {
    let column2 = [
      { id: 1, position: 0 },
      { id: 2, position: 1024 },
    ];
    for (let i = 0; i < 15; i += 1) {
      const position = calculatePosition(column2, 1);
      expect(Number.isInteger(position)).toBe(true);
      column2 = [column2[0], { id: 100 + i, position }, column2[1]].sort(
        (a, b) => a.position - b.position,
      );
      column2 = [column2[0], column2[1]];
    }
  });

  it('간격이 1 미만이면 재정렬이 필요하다', () => {
    expect(needsRebalance(column)).toBe(false);
    expect(needsRebalance([{ id: 1, position: 0 }, { id: 2, position: 0.5 }])).toBe(true);
  });

  it('재정렬은 1024 간격으로 다시 매긴다', () => {
    expect(rebalance([{ id: 3, position: -5 }, { id: 4, position: 0.2 }])).toEqual([
      { id: 3, position: 0 },
      { id: 4, position: 1024 },
    ]);
  });
});
