import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/server/db/schema';

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('POSTGRES_URL 환경 변수가 설정되지 않았습니다');
}

/**
 * 로컬 PostgreSQL과 Vercel Postgres(Neon)를 같은 드라이버로 다룬다.
 * 로컬은 TLS를 쓰지 않고, 원격은 TLS를 요구하므로 호스트로 분기한다.
 */
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

// 서버리스/HMR 환경에서 커넥션 풀이 중복 생성되지 않도록 전역에 캐시한다.
const globalForDb = globalThis as unknown as { tikaPool?: Pool };

const pool =
  globalForDb.tikaPool ??
  new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: true },
    max: isLocal ? 10 : 1,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.tikaPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
