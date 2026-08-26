/**
 * 드래그 드롭 대상 인덱스 계산 (TC-COMP-007~007f, US-005)
 *
 * @jest-environment node
 */
import { resolveDropTarget } from '@/client/components/board/resolveDropTarget';
import { TICKET_STATUS } from '@/shared/constants';

/** 칼럼 [A(1), B(2), C(3)] */
const TODO_IDS = [1, 2, 3];
const IN_PROGRESS_IDS = [7, 8];

const columnIds = (status: string): number[] =>
  status === TICKET_STATUS.TODO ? TODO_IDS : IN_PROGRESS_IDS;

/** targetIndex를 실제 배열 조작에 적용해 최종 순서를 만든다 (useTickets.moveTicket과 동일한 절차) */
const applyMove = (ids: number[], movedId: number, targetIndex: number): number[] => {
  const rest = ids.filter((id) => id !== movedId);
  rest.splice(targetIndex, 0, movedId);
  return rest;
};

describe('resolveDropTarget — 같은 칼럼 (US-005)', () => {
  it('TC-COMP-007: A를 C 위에 드롭하면 C 뒤로 간다', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: 3,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.TODO,
      columnIds,
    });

    expect(result).toBe(2);
    expect(applyMove(TODO_IDS, 1, result as number)).toEqual([2, 3, 1]);
  });

  it('TC-COMP-007a: A를 바로 아래 B 위에 드롭하면 한 칸 내려간다', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: 2,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.TODO,
      columnIds,
    });

    expect(result).toBe(1);
    expect(applyMove(TODO_IDS, 1, result as number)).toEqual([2, 1, 3]);
  });

  it('TC-COMP-007b: C를 A 위에 드롭하면 맨 앞으로 간다', () => {
    const result = resolveDropTarget({
      activeId: 3,
      overId: 1,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.TODO,
      columnIds,
    });

    expect(result).toBe(0);
    expect(applyMove(TODO_IDS, 3, result as number)).toEqual([3, 1, 2]);
  });

  it('TC-COMP-007c: 자기 자신 위에 드롭하면 null (API 미호출)', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: 1,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.TODO,
      columnIds,
    });

    expect(result).toBeNull();
  });

  it('TC-COMP-007d: 같은 칼럼 여백에 드롭하면 맨 뒤로 간다', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: TICKET_STATUS.TODO,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.TODO,
      columnIds,
    });

    expect(result).toBe(2);
    expect(applyMove(TODO_IDS, 1, result as number)).toEqual([2, 3, 1]);
  });
});

describe('resolveDropTarget — 다른 칼럼 (US-005)', () => {
  it('TC-COMP-007e: 빈 여백에 드롭하면 맨 뒤에 붙는다', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: TICKET_STATUS.IN_PROGRESS,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.IN_PROGRESS,
      columnIds,
    });

    expect(result).toBe(2);
    expect(applyMove(IN_PROGRESS_IDS, 1, result as number)).toEqual([7, 8, 1]);
  });

  it('TC-COMP-007f: 티켓 위에 드롭하면 그 앞에 삽입된다', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: 8,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.IN_PROGRESS,
      columnIds,
    });

    expect(result).toBe(1);
    expect(applyMove(IN_PROGRESS_IDS, 1, result as number)).toEqual([7, 1, 8]);
  });

  it('다른 칼럼으로 옮기면 위치가 같아도 null이 아니다', () => {
    const result = resolveDropTarget({
      activeId: 1,
      overId: 7,
      fromStatus: TICKET_STATUS.TODO,
      toStatus: TICKET_STATUS.IN_PROGRESS,
      columnIds,
    });

    expect(result).toBe(0);
  });
});
