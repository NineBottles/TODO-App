import type { TicketStatus } from '@/shared/constants';

type ResolveDropTargetArgs = {
  /** 드래그 중인 티켓 id */
  activeId: number;
  /** 드롭 대상 — 티켓 id 또는 칼럼 status */
  overId: number | string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  /** 칼럼별 티켓 id 목록 (화면에 보이는 순서) */
  columnIds: (status: TicketStatus) => number[];
};

/**
 * 드롭 위치를 "드래그 중인 카드를 제외한 배열" 기준의 삽입 인덱스로 변환한다. (FR-007, US-005)
 *
 * 티켓 위에 드롭한 경우 대상 칼럼 **원본 배열**에서의 인덱스를 그대로 쓴다.
 * 같은 칼럼에서 아래로 옮길 때는 제외 후 배열에서 대상 카드가 한 칸 당겨지므로 "그 카드 뒤"에,
 * 위로 옮길 때는 "그 카드 앞"에 놓여 양방향 모두 sortable 관례와 일치한다.
 *
 * 같은 칼럼에서 위치가 바뀌지 않으면 null을 반환한다(API 호출 불필요).
 */
export const resolveDropTarget = ({
  activeId,
  overId,
  fromStatus,
  toStatus,
  columnIds,
}: ResolveDropTargetArgs): number | null => {
  const destinationIds = columnIds(toStatus);
  const isSameColumn = fromStatus === toStatus;

  const overIndex = destinationIds.indexOf(Number(overId));

  // 칼럼 여백에 드롭 → 맨 뒤. 같은 칼럼이면 자기 자신이 빠지므로 길이가 1 줄어든다.
  const targetIndex =
    overIndex === -1 ? destinationIds.length - (isSameColumn ? 1 : 0) : overIndex;

  if (isSameColumn && targetIndex === destinationIds.indexOf(activeId)) return null;

  return targetIndex;
};
