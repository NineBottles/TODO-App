# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요
Tika는 티켓 기반 칸반 보드 TODO 앱이다.
Next.js App Router 기반으로, 프론트엔드와 백엔드를 디렉토리 수준에서 분리한다.
src/shared/에서 타입과 검증 스키마를 공유한다.

## 프로젝트 구조
- app/api/       : 백엔드 진입점 (Route Handlers, 요청 파싱 + 응답만)
- src/server/    : 백엔드 로직 (services, db, middleware)
- src/client/    : 프론트엔드 로직 (components, hooks, api 호출)
- src/shared/    : 공유 타입, Zod 스키마, 상수
- docs/          : 프로젝트 명세 문서

## 기술 스택
- Framework: Next.js 15 (App Router)
- Language: TypeScript (strict mode)
- Frontend: React 19
- Styling: Tailwind CSS 4 (CSS-first, `tailwind.config.ts` 없음)
- Drag & Drop: @dnd-kit/core + @dnd-kit/sortable
- ORM: Drizzle ORM
- DB 드라이버: node-postgres (`pg`) — 로컬 PostgreSQL과 Vercel Postgres를 같은 코드로 연결
- DB: 로컬 PostgreSQL 18 / 배포 시 Vercel Postgres (Neon)
- Validation: Zod
- Testing: Jest + React Testing Library
- Deployment: Vercel

## 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드 (린트 + 타입체크 포함)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # 전체 테스트
npm run test:watch   # 감시 모드
```

테스트 일부만 실행:

```bash
npx jest __tests__/services                      # 디렉토리
npx jest __tests__/services/ticketService.test.ts # 파일 하나
npx jest -t "오버듀"                              # 테스트 이름으로 필터
```

DB:

```bash
npm run db:generate  # 스키마 변경 → 마이그레이션 SQL 생성
npm run db:migrate   # 마이그레이션 적용
npm run db:seed      # 시드 (대상 DB의 tickets를 전부 삭제 후 재삽입)
```

## 로컬 개발 환경

`.env.local`에 `POSTGRES_URL`이 필요하다. 없으면 `src/server/db/index.ts`가 import 시점에 throw한다.

```
POSTGRES_URL=postgresql://tika_user:tika_password@localhost:5432/tika_dev
```

로컬 PostgreSQL 18에 `tika_user`(소유자)와 `tika_dev`·`tika_test` 두 DB가 준비되어 있다.
`tika_test`는 아직 비어 있으며, 현재 테스트는 전부 mock 기반이라 DB에 접속하지 않는다.

## 핵심 설계 (여러 파일을 읽어야 파악되는 것)

### 계층 흐름
```
app/api/**/route.ts        요청 파싱 → 서비스 호출 → 응답 (비즈니스 로직 없음)
  └ ticketService          비즈니스 규칙 전부. 순수 로직 + 레포지토리 호출
      └ ticketRepository   Drizzle 쿼리 전담. row(Date) ↔ Ticket(ISO 문자열) 변환
```
서비스 테스트는 `ticketRepository`를, API 테스트는 `ticketService`를, 클라이언트 테스트는 `ticketApi`를 mock한다. 이 경계가 곧 테스트 경계다.

### position 정렬 (FR-007)
칼럼 내 순서는 정수 `position`으로 관리하며 **계산 주체가 나뉘어 있다.**
- **클라이언트**가 `calculatePosition()`(`src/shared/position.ts`)으로 삽입 위치를 계산해 전송한다. 사이 삽입은 `floor((prev+next)/2)` — **반드시 정수**여야 한다(컬럼도 스키마도 int).
- **서버**가 이동 후 간격이 1 미만이면 칼럼 전체를 1024 간격으로 재정렬한다.
- 티켓 갱신과 재정렬은 `ticketRepository.applyReorder()`에서 **한 트랜잭션**으로 처리한다. 분리하면 재정렬 실패 시 position이 깨진 채 남는다.

### 드래그앤드롭
- 드롭 대상 인덱스 계산은 순수 함수 `resolveDropTarget()`으로 분리되어 있다. jsdom에서 DnD 좌표를 재현할 수 없어 이 함수가 단위 테스트 지점이다. 인덱스 기준은 **드래그 중인 카드를 제외한 배열**이다.
- `useTickets.moveTicket()`이 낙관적 업데이트 → API → 실패 시 롤백을 담당한다. **재동기화(`refresh`) 실패는 롤백 사유가 아니다** — 이동은 이미 성공했으므로 롤백하면 화면과 DB가 어긋난다.

### 실제 일정 자동 기록
사용자가 직접 편집할 수 없고 상태 전이로만 기록된다.

| 전이 | startedAt | completedAt |
|---|---|---|
| → IN_PROGRESS (신규 진입) | 현재 시각 | — |
| → BACKLOG | null | — |
| → DONE (신규 진입) | — | 현재 시각 |
| → DONE (이미 DONE) | — | **유지** (Done 내 재정렬) |
| DONE → 다른 칼럼 | 위 규칙 | null |

`PATCH /:id/complete`는 Done 진입 단축 경로이며 **멱등**이다. Done 칼럼 안에서 순서만 바꿀 때 이 API를 쓰면 완료 시각이 소실되고 24시간 노출 창이 리셋된다 — 그 경우 `reorder`를 써야 한다.

### Zod 스키마 3종 (`src/shared/validations/ticket.ts`)
- `createTicketSchema` — 생성용. `dueDate`에 "오늘 이후" 강제
- `ticketFormSchema` — 폼용. `dueDate` 형식만 검증
- `updateTicketSchema` — 수정용(partial). `dueDate` 미래 제약 **없음**

수정에 미래 제약을 걸면 **오버듀 티켓을 영원히 수정할 수 없다.** 폼은 사용자가 날짜를 새로 고른 경우에만 엄격 스키마를 쓴다.

### 날짜 판정
`todayString()`은 `APP_TIMEZONE`(`Asia/Seoul`) 고정 기준이다. 실행 환경 로컬 타임존을 쓰면 UTC 서버와 KST 사용자 사이에 하루가 어긋나고 SSR/클라이언트 값이 불일치한다.

### 에러 처리
서비스는 `NotFoundError`를 던지고, Route Handler는 `handleError()`로 변환한다. 검증 실패·미존재는 예상된 흐름이라 로깅하지 않고, 정체불명의 예외만 `logError()`로 원본을 남긴다. 응답 형식은 `{ error: { code, message, details? } }`.

## 프로젝트 문서 (반드시 참조)
- 제품 요구사항: /docs/PRD.md
- 기술 요구사항: /docs/TRD.md
- 상세 요구사항: /docs/REQUIREMENTS.md
- API 명세: /docs/API_SPEC.md
- 데이터 모델: /docs/DATA_MODEL.md
- 컴포넌트 명세: /docs/COMPONENT_SPEC.md
- 테스트 케이스: /docs/TEST_CASES.md

동작을 바꾸면 해당 문서를 **먼저** 고친다. 문서 간 내용이 충돌하면 임의로 고르지 말고 사용자에게 확인한다(과거 PRD와 REQUIREMENTS가 startedAt 기록 시점을 다르게 기술한 전례가 있다).

## 코딩 컨벤션

### TypeScript (공통)
- strict 모드 사용
- any 사용 금지, unknown 사용 후 타입 가드
- 인터페이스는 I 접두사 없이 명사로 (예: Ticket, BoardData)
- enum 대신 const 객체 + typeof 패턴 사용
- 공유 타입은 반드시 @/shared/types에서 import

### 백엔드 (app/api/ + src/server/)
- Route Handler는 얇게: 요청 파싱 → 서비스 호출 → 응답 반환
- 비즈니스 로직은 src/server/services/에 작성
- Zod로 요청 검증 (shared/validations에서 import)
- 에러 응답 형식 통일: { error: { code, message } }
- HTTP 상태 코드: 200, 201, 204, 400, 404, 500
- DB 쿼리는 Drizzle ORM으로만 작성 (raw SQL 금지)

### 프론트엔드 (src/client/)
- 함수 컴포넌트 + 화살표 함수
- Props 타입은 컴포넌트 파일 내 정의
- API 호출은 src/client/api/ticketApi.ts를 통해서만
- 파일명: PascalCase (예: TicketCard.tsx)

## 개발 규칙

### 반드시 지켜야 할 것
- 새 기능 구현 전 TEST_CASES.md의 해당 테스트부터 작성
- API 구현 시 API_SPEC.md의 명세를 정확히 따르기
- 컴포넌트 구현 시 COMPONENT_SPEC.md의 Props와 동작 준수
- 타입 변경 시 src/shared/types 먼저 수정

### 하지 말아야 할 것
- 명세에 없는 기능 임의 추가 금지
- 테스트 코드 삭제 또는 skip 금지
- any 타입 사용 금지
- console.log 커밋 금지 (디버깅 후 제거). 의도된 서버 에러 로깅은 `logError()`로 일원화
- src/client/에서 직접 DB 접근 금지
- src/server/에서 React 관련 코드 작성 금지

### 경계 규칙
- 백엔드 작업 시(app/api/, src/server/) 프론트엔드(src/client/) 코드 수정 금지
- 프론트엔드 작업 시(src/client/) 백엔드(app/api/, src/server/) 코드 수정 금지
- 양쪽에 영향을 주는 변경은 src/shared/ 먼저 수정 후 각각 반영

### TDD 사이클 규칙
- Red 단계: 테스트 코드만 작성, 구현 코드 생성 금지
- Green 단계: 테스트를 통과하는 최소한의 코드만 작성, 테스트 코드 수정 금지
- Refactor 단계: 코드 개선만, 새 기능 추가 금지, 테스트는 반드시 통과 유지
- 테스트와 구현을 한 번에 작성하지 말 것 — 반드시 단계별로 진행
- 테스트 실패 시 구현을 수정할 것, 테스트를 수정하지 말 것 (명세 오류인 경우 명세 먼저 수정)

## 함정 (실제로 겪은 것들)

- **`next build`를 dev 서버가 떠 있는 상태에서 실행하지 말 것.** 둘 다 `.next`를 공유해 dev 청크가 삭제되고, 페이지는 200으로 뜨지만 JS가 404가 되어 하이드레이션이 안 된다(화면은 보이는데 아무것도 동작하지 않음). 복구는 dev 종료 → `rm -rf .next` → 재시작. dev 서버 종료 시 자식 node 프로세스가 남아 포트를 붙잡는 경우가 있으니 포트도 확인할 것.
- **`DndContext`에는 고정 `id`가 필수다.** dnd-kit은 모듈 수준 카운터로 `aria-describedby`를 만들어 서버(요청마다 증가)와 클라이언트(0부터)가 어긋난다 → 하이드레이션 불일치.
- **`TicketCard`의 `onKeyDown`은 sortable 리스너를 덮어쓰면 안 된다.** `{...listeners}` 뒤에 같은 핸들러를 지정하면 키보드 드래그가 통째로 죽는다. `listeners.onKeyDown`을 먼저 호출하고 `defaultPrevented`를 확인할 것. Space=드래그, Enter=상세.
- **Jest 설정은 `jest.config.mjs`여야 한다** (`.ts`는 ts-node 필요).
- **`@jest-environment node` 지시어는 docblock의 마지막 줄에 둘 것.** 다음 줄까지 환경명으로 파싱된다.
- **`db:seed`는 대상 DB의 tickets를 전부 삭제한다.** `assertSeedTargetIsSafe()`가 로컬 접속만 허용하며, 우회하려면 `ALLOW_REMOTE_SEED=1`이 필요하다.
