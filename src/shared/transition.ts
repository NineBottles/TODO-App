import { COLUMN_ORDER, type TicketStatus } from '@/shared/constants';

/** 단계를 건너뛴 이동을 거부할 때 쓰는 문구. 서버 응답과 클라이언트 팝업이 같은 문자열을 쓴다. (FR-007) */
export const STAGE_ORDER_MESSAGE = '단계별로 일감을 관리해 주세요';

const stageIndex = (status: TicketStatus): number => COLUMN_ORDER.indexOf(status);

/**
 * 칼럼 전이가 허용되는지 판단한다. (FR-007)
 *
 * 칼럼은 BACKLOG → TODO → IN_PROGRESS → DONE 순서를 가진다.
 * - 순방향: **인접한 한 단계씩만** 허용한다. TODO에서 IN_PROGRESS를 건너뛴 DONE 이동은 막는다.
 * - 역방향: 제한하지 않는다. 되돌리기는 실수 복구 수단이라 몇 단계든 허용해야 한다.
 * - 같은 칼럼: 허용한다(칼럼 내 재정렬).
 *
 * 클라이언트(드래그앤드롭 차단)와 서버(API 거부)가 같은 판정을 쓰도록 shared에 둔다.
 */
export const canTransition = (from: TicketStatus, to: TicketStatus): boolean =>
  stageIndex(to) - stageIndex(from) <= 1;
