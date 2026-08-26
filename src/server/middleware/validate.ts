import type { ZodTypeAny, output } from 'zod';
import { ZodError, ZodIssueCode } from 'zod';

/** 요청 본문을 파싱하고 Zod 스키마로 검증한다. 실패 시 ZodError를 던진다. */
export const parseBody = async <S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<output<S>> => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ZodError([
      { code: ZodIssueCode.custom, path: [], message: 'JSON 형식의 요청 본문이 필요합니다' },
    ]);
  }
  return schema.parse(raw);
};

/** path parameter 등 임의 값을 스키마로 검증한다. */
export const parseValue = <S extends ZodTypeAny>(value: unknown, schema: S): output<S> =>
  schema.parse(value);
