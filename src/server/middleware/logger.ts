/**
 * 서버 에러 로깅.
 *
 * 응답 본문에는 내부 정보를 담지 않지만(보안), 원본 예외를 버리지도 않는다.
 * 로그가 없으면 배포 후 500의 원인을 추적할 수 없다.
 * 프로젝트 규칙이 금지하는 것은 디버깅용 console.log이며, 의도된 에러 로깅은 여기로 일원화한다.
 */
type LogContext = Record<string, unknown>;

export const logError = (scope: string, error: unknown, context: LogContext = {}): void => {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: String(error) };

  console.error(
    JSON.stringify({ level: 'error', scope, ...context, error: detail, at: new Date().toISOString() }),
  );
};
