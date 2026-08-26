/**
 * 시드는 대상 DB의 티켓을 전부 삭제한다.
 * 운영 DB를 가리킨 채 실행되는 사고를 막기 위해 로컬 접속만 허용한다.
 */
const LOCAL_HOST_PATTERN = /@(localhost|127\.0\.0\.1)(:\d+)?\//;

export const assertSeedTargetIsSafe = (
  connectionString: string | undefined,
  options: { allowRemote?: boolean } = {},
): void => {
  if (!connectionString) {
    throw new Error('POSTGRES_URL이 설정되지 않아 시드를 실행할 수 없습니다');
  }

  if (options.allowRemote) return;

  if (!LOCAL_HOST_PATTERN.test(connectionString)) {
    throw new Error(
      '원격 데이터베이스로 보입니다. 시드는 대상 DB의 티켓을 모두 삭제하므로 중단합니다. ' +
        '의도한 것이라면 ALLOW_REMOTE_SEED=1 을 설정하세요.',
    );
  }
};
