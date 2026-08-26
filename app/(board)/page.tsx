import { Board } from '@/client/components/board/Board';
import { logError } from '@/server/middleware/logger';
import { ticketService } from '@/server/services/ticketService';
import { createEmptyBoard } from '@/shared/board';

export const dynamic = 'force-dynamic';

/** 서버 컴포넌트에서 초기 보드 데이터를 로드한다. (TRD 8.1) */
const BoardPage = async () => {
  let initialBoard = createEmptyBoard();
  let loadError: string | null = null;

  try {
    initialBoard = await ticketService.getBoard();
  } catch (error) {
    // 원인을 뭉개지 않고 로그로 남긴다. 화면에는 일반 문구만 노출한다.
    logError('board-page', error);
    loadError = '보드 데이터를 불러오지 못했습니다. 서버 로그를 확인해주세요.';
  }

  return (
    <>
      {loadError && (
        <p role="alert" className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </p>
      )}
      <Board initialBoard={initialBoard} />
    </>
  );
};

export default BoardPage;
