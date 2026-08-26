import { db } from '@/server/db';
import { tickets } from '@/server/db/schema';
import { assertSeedTargetIsSafe } from '@/server/db/seedGuard';
import { POSITION_GAP, TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';

const seed = async () => {
  // 아래 delete는 대상 DB의 티켓을 전부 지운다. 운영 DB 사고를 막는 가드.
  assertSeedTargetIsSafe(process.env.POSTGRES_URL, {
    allowRemote: process.env.ALLOW_REMOTE_SEED === '1',
  });

  await db.delete(tickets);
  await db.insert(tickets).values([
    {
      title: 'PRD 검토',
      description: '제품 요구사항 문서를 읽고 범위를 확인한다',
      status: TICKET_STATUS.BACKLOG,
      priority: TICKET_PRIORITY.HIGH,
      position: 0,
    },
    {
      title: '칸반 보드 레이아웃 잡기',
      status: TICKET_STATUS.BACKLOG,
      priority: TICKET_PRIORITY.MEDIUM,
      position: POSITION_GAP,
    },
    {
      title: 'API 스펙 정리',
      status: TICKET_STATUS.TODO,
      priority: TICKET_PRIORITY.MEDIUM,
      position: 0,
      startedAt: new Date(),
    },
    {
      title: '드래그앤드롭 구현',
      status: TICKET_STATUS.IN_PROGRESS,
      priority: TICKET_PRIORITY.HIGH,
      position: 0,
      startedAt: new Date(),
    },
  ]);
  console.info('seed 완료');
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
