import { POSITION_GAP } from '@/shared/constants';

type Positioned = { id: number; position: number };

/**
 * 칼럼 내 targetIndex 위치에 삽입할 때의 position 값을 계산한다. (FR-007)
 * - 맨 앞: 첫 카드 position - 1024
 * - 맨 뒤: 마지막 카드 position + 1024
 * - 사이: floor((prev + next) / 2)
 * - 빈 칼럼: 0
 *
 * position은 정수 컬럼이고 reorder 스키마도 int만 허용하므로 반드시 정수를 반환해야 한다.
 * 인접한 카드 사이(간격 1)에 삽입하면 내림 결과가 앞 카드와 같아질 수 있는데,
 * 이때는 서버의 재정렬(needsRebalance → rebalance)이 간격을 복구한다.
 */
export const calculatePosition = (
  columnTickets: readonly Positioned[],
  targetIndex: number,
): number => {
  if (columnTickets.length === 0) return 0;

  const index = Math.max(0, Math.min(targetIndex, columnTickets.length));
  if (index === 0) return columnTickets[0].position - POSITION_GAP;
  if (index === columnTickets.length) {
    return columnTickets[columnTickets.length - 1].position + POSITION_GAP;
  }
  return Math.floor((columnTickets[index - 1].position + columnTickets[index].position) / 2);
};

/** 인접 간격이 1 미만이면 재정렬이 필요하다. (FR-007) */
export const needsRebalance = (columnTickets: readonly Positioned[]): boolean =>
  columnTickets.some(
    (ticket, index) => index > 0 && ticket.position - columnTickets[index - 1].position < 1,
  );

/** 칼럼 전체를 1024 간격으로 재정렬한다. */
export const rebalance = (columnTickets: readonly Positioned[]): Positioned[] =>
  columnTickets.map((ticket, index) => ({ ...ticket, position: index * POSITION_GAP }));
