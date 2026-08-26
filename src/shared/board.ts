import type { BoardData } from '@/shared/types';

/** 4개 칼럼이 모두 빈 배열인 보드. 서버(초기 로드 실패)와 클라이언트 양쪽에서 쓴다. */
export const createEmptyBoard = (): BoardData => ({
  BACKLOG: [],
  TODO: [],
  IN_PROGRESS: [],
  DONE: [],
});
