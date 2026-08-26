/**
 * 시드 스크립트 안전장치 (운영 데이터 보호)
 *
 * @jest-environment node
 */
import { assertSeedTargetIsSafe } from '@/server/db/seedGuard';

describe('assertSeedTargetIsSafe', () => {
  it.each([
    'postgresql://tika_user:pw@localhost:5432/tika_dev',
    'postgresql://tika_user:pw@127.0.0.1:5432/tika_test',
  ])('로컬 DB는 허용한다: %s', (url) => {
    expect(() => assertSeedTargetIsSafe(url)).not.toThrow();
  });

  it('원격 DB는 거부한다', () => {
    expect(() =>
      assertSeedTargetIsSafe('postgresql://u:pw@ep-cool-1234.ap-northeast-2.aws.neon.tech/tika'),
    ).toThrow(/원격/);
  });

  it('POSTGRES_URL이 없으면 거부한다', () => {
    expect(() => assertSeedTargetIsSafe(undefined)).toThrow();
  });

  it('명시적으로 허용하면 원격도 통과한다', () => {
    expect(() =>
      assertSeedTargetIsSafe('postgresql://u:pw@remote.example.com/tika', { allowRemote: true }),
    ).not.toThrow();
  });
});
