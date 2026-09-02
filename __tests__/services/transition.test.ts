/**
 * 단계 전이 규칙 (FR-007) — TC-SVC-036 ~ TC-SVC-039
 *
 * @jest-environment node
 */
import { TICKET_STATUS } from '@/shared/constants';
import { STAGE_ORDER_MESSAGE, canTransition } from '@/shared/transition';

const { BACKLOG, TODO, IN_PROGRESS, DONE } = TICKET_STATUS;

describe('canTransition (FR-007)', () => {
  it('TC-SVC-036: 인접한 순방향 이동은 허용한다', () => {
    expect(canTransition(BACKLOG, TODO)).toBe(true);
    expect(canTransition(TODO, IN_PROGRESS)).toBe(true);
    expect(canTransition(IN_PROGRESS, DONE)).toBe(true);
  });

  it('TC-SVC-037: 단계를 건너뛴 순방향 이동은 거부한다', () => {
    expect(canTransition(BACKLOG, IN_PROGRESS)).toBe(false);
    expect(canTransition(BACKLOG, DONE)).toBe(false);
    expect(canTransition(TODO, DONE)).toBe(false);
  });

  it('TC-SVC-038: 역방향은 몇 단계든 허용한다 (되돌리기는 복구 수단)', () => {
    expect(canTransition(DONE, BACKLOG)).toBe(true);
    expect(canTransition(DONE, TODO)).toBe(true);
    expect(canTransition(DONE, IN_PROGRESS)).toBe(true);
    expect(canTransition(IN_PROGRESS, BACKLOG)).toBe(true);
    expect(canTransition(TODO, BACKLOG)).toBe(true);
  });

  it('TC-SVC-039: 같은 칼럼 내 재정렬은 허용한다', () => {
    expect(canTransition(BACKLOG, BACKLOG)).toBe(true);
    expect(canTransition(TODO, TODO)).toBe(true);
    expect(canTransition(IN_PROGRESS, IN_PROGRESS)).toBe(true);
    expect(canTransition(DONE, DONE)).toBe(true);
  });

  it('거부 문구는 서버와 클라이언트가 공유하는 단일 상수다', () => {
    expect(STAGE_ORDER_MESSAGE).toBe('단계별로 일감을 관리해 주세요');
  });
});
