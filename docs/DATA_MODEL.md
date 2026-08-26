# Tika - 데이터 모델 (DATA_MODEL.md)

> 버전: 1.0 (MVP)
> 기준 구현: `src/server/db/schema.ts`, `src/shared/types/index.ts`
> 관련 문서: [API_SPEC.md](./API_SPEC.md), [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## 1. ERD

MVP는 단일 사용자 · 고정 4칼럼 구조이므로 **테이블은 `tickets` 하나**이며 외래키가 없다.
칼럼(상태)은 별도 테이블이 아니라 `tickets.status` enum으로 표현한다.

```
┌─────────────────────────────────────────────┐
│ tickets                                     │
├─────────────────────────────────────────────┤
│ PK  id                  serial              │
│     title               varchar(200)  NOT NULL
│     description         text                │
│     status              ticket_status   NOT NULL  DEFAULT 'BACKLOG'
│     priority            ticket_priority NOT NULL  DEFAULT 'MEDIUM'
│     position            integer        NOT NULL  DEFAULT 0
│     planned_start_date  date                │
│     due_date            date                │
│     started_at          timestamptz         │
│     completed_at        timestamptz         │
│     created_at          timestamptz    NOT NULL  DEFAULT now()
│     updated_at          timestamptz    NOT NULL  DEFAULT now()
└─────────────────────────────────────────────┘
      INDEX tickets_status_position_idx (status, position)
```

---

## 2. Enum 정의

### 2.1 `ticket_status`

| 값 | 칼럼 라벨 | 의미 |
|----|----------|------|
| `BACKLOG` | Backlog | 아직 착수하지 않음 (기본값) |
| `TODO` | TODO | 착수 예정 / 착수함 |
| `IN_PROGRESS` | In-Progress | 진행 중 |
| `DONE` | Done | 완료 |

**칼럼 순서**: `BACKLOG → TODO → IN_PROGRESS → DONE` (고정, 추가/삭제/순서 변경 없음)
**이동 제약**: 없음. 어떤 칼럼에서 어떤 칼럼으로든 이동 가능(역방향 포함).

### 2.2 `ticket_priority`

| 값 | 라벨 | 뱃지 색상 |
|----|------|----------|
| `LOW` | 낮음 | 회색 |
| `MEDIUM` | 보통 (기본값) | 파랑 |
| `HIGH` | 높음 | 빨강 |

> TypeScript에서는 `enum` 대신 const 객체 + `typeof` 패턴으로 정의한다 (`src/shared/constants.ts`).

---

## 3. 컬럼 명세

| 컬럼 (DB) | 필드 (TS) | 타입 | NULL | 기본값 | 설명 |
|-----------|-----------|------|------|--------|------|
| `id` | `id` | serial | NOT NULL | 자동 증가 | PK |
| `title` | `title` | varchar(200) | NOT NULL | — | 티켓 제목. 1~200자, 공백만 불가 |
| `description` | `description` | text | NULL | `null` | 설명. 최대 1000자 (앱 레벨 검증) |
| `status` | `status` | ticket_status | NOT NULL | `BACKLOG` | 소속 칼럼 |
| `priority` | `priority` | ticket_priority | NOT NULL | `MEDIUM` | 우선순위 |
| `position` | `position` | integer | NOT NULL | `0` | 칼럼 내 정렬 키. 작을수록 위 |
| `planned_start_date` | `plannedStartDate` | date | NULL | `null` | 계획 시작일 |
| `due_date` | `dueDate` | date | NULL | `null` | 계획 종료일. 생성/수정 시 오늘 이상 |
| `started_at` | `startedAt` | timestamptz | NULL | `null` | 실제 시작일. IN_PROGRESS 진입 시 자동 기록 |
| `completed_at` | `completedAt` | timestamptz | NULL | `null` | 실제 종료일. DONE 진입 시 자동 기록 |
| `created_at` | `createdAt` | timestamptz | NOT NULL | `now()` | 생성 시각 |
| `updated_at` | `updatedAt` | timestamptz | NOT NULL | `now()` | 최종 수정 시각 |

### 3.1 타입 변환 경계

DB row와 애플리케이션 타입 사이 변환은 `src/server/db/ticketRepository.ts`가 전담한다.

| 구분 | DB | 애플리케이션 (`Ticket`) |
|------|-----|------------------------|
| `date` 컬럼 | `date` | `string` — `"2026-03-10"` |
| `timestamptz` 컬럼 | `Date` | `string` — ISO 8601 (`toISOString()`) |

서비스 계층 위쪽은 항상 문자열만 다루므로, 서버/클라이언트가 동일한 `Ticket` 타입을 공유할 수 있다.

---

## 4. 인덱스

| 이름 | 컬럼 | 목적 |
|------|------|------|
| PK | `id` | 기본키 |
| `tickets_status_position_idx` | `(status, position)` | 칼럼별 조회 + position 정렬 (보드 조회, 재정렬 계산) |

---

## 5. 파생 필드 (DB 미저장)

### 5.1 `isOverdue` — FR-008

```
isOverdue = dueDate !== null AND dueDate < 오늘 AND status !== 'DONE'
```

- DB에 저장하지 않고 **조회 시점에 계산**한다. 서버는 `ticketService.getBoard()`에서, 클라이언트는 `useTickets`에서 동일 규칙으로 계산한다.
- `오늘`은 **고정 타임존 `APP_TIMEZONE`(기본 `Asia/Seoul`) 기준** `YYYY-MM-DD` 문자열이며, `dueDate`와 문자열 비교한다 (`todayString()`).
- 실행 환경의 로컬 타임존을 쓰지 않는 이유: Vercel 서버는 UTC, 사용자는 KST라 KST 자정~오전 9시 사이에 판정이 하루 어긋나고 SSR/클라이언트 값이 불일치한다.
- 이 필드가 붙은 타입이 `TicketView = Ticket & { isOverdue: boolean }`이다.

### 5.2 `BoardData`

```ts
type BoardData = Record<TicketStatus, TicketView[]>;
```

4개 키가 항상 존재하며(빈 칼럼은 `[]`), 각 배열은 `position` 오름차순이다.

---

## 6. 비즈니스 규칙

### 6.1 position 관리 (FR-001, FR-007)

- **기준 간격**: `POSITION_GAP = 1024`
- **신규 생성**: BACKLOG 칼럼 최솟값 − 1024 (맨 위). 칼럼이 비어 있으면 `0`
- **완료 처리**: DONE 칼럼 최솟값 − 1024 (맨 위). 비어 있으면 `0`
- **드롭 위치 계산** (클라이언트, `calculatePosition`)

  | 위치 | 값 |
  |------|-----|
  | 빈 칼럼 | `0` |
  | 맨 앞 | `첫 카드 − 1024` |
  | 사이 | `floor((prev + next) / 2)` |
  | 맨 뒤 | `마지막 카드 + 1024` |

- **재정렬** (서버, `needsRebalance` / `rebalance`): 이동 후 대상 칼럼의 인접 간격이 **1 미만**이면 칼럼 전체를 `0, 1024, 2048, …`로 다시 매긴다. 갱신은 트랜잭션으로 처리한다.
- `position`은 정수 컬럼이고 reorder 스키마도 `int`를 요구하므로, **중간값 계산은 반드시 내림 처리한다.** 내림 때문에 앞 카드와 값이 같아지면 재정렬 규칙이 간격을 복구한다.
- `position`은 **칼럼 내에서만** 의미가 있다. 서로 다른 칼럼의 position 값끼리는 비교하지 않는다.

### 6.2 실제 일정 자동 기록 (FR-005, FR-007)

| 전이 | `startedAt` | `completedAt` |
|------|-------------|---------------|
| `→ IN_PROGRESS` (기존 상태 ≠ IN_PROGRESS) | 현재 시각 | 변화 없음 |
| `→ BACKLOG` | `null` | 변화 없음 |
| `→ TODO` | 변화 없음 (유지) | 변화 없음 |
| `→ DONE` (기존 상태 ≠ DONE) | 변화 없음 | 현재 시각 |
| `→ DONE` (기존 상태도 DONE) | 변화 없음 | **유지** (Done 내 재정렬) |
| `DONE →` 다른 칼럼 | 위 규칙 적용 | `null` |

- IN_PROGRESS 칼럼 안에서의 순서 변경만 하는 경우 `startedAt`은 유지된다.
- IN_PROGRESS에서 TODO로 되돌려도 `startedAt`은 유지된다. 완전한 초기화는 BACKLOG 복귀 시에만 일어난다.
- `startedAt` / `completedAt`은 사용자가 직접 편집할 수 없다. `PATCH /api/tickets/:id`로는 변경되지 않는다.

> **명세 이력**: 초기 REQUIREMENTS FR-007 / TRD 5.3은 "TODO로 이동 시 startedAt 기록"으로 기술했으나, PRD FR-008("티켓이 In-Progress로 이동하면 실제 시작일이 기록된다")을 정본으로 삼아 **IN_PROGRESS 진입 시 기록**으로 통일했다. REQUIREMENTS / TRD / API_SPEC / TEST_CASES 모두 갱신 완료.

### 6.3 Done 칼럼 노출 기간 (FR-005)

- `DONE_VISIBLE_MS = 24시간`
- 보드 조회 시 `now - completedAt >= 24시간`인 티켓은 응답에서 제외한다.
- **데이터는 삭제되지 않는다.** 조회 필터일 뿐이며, `GET /api/tickets/:id`로는 계속 조회된다.
- `completedAt`이 `null`인 `DONE` 티켓은 **숨기지 않는다.** 정상 경로에서는 생기지 않지만, 시드·수동 SQL 등으로 유입되면 숨길 경우 보드 어디에도 나타나지 않아 사용자가 되돌릴 수 없다.
- Done 칼럼 안에서 순서만 바꾸는 조작은 `completedAt`을 건드리지 않는다. 갱신하면 실제 완료 시각이 사라지고 24시간 창이 리셋된다.

### 6.4 삭제 정책 (FR-006)

하드 삭제. soft delete 컬럼(`deletedAt` 등)을 두지 않는다.

---

## 7. 마이그레이션

- 생성: `npm run db:generate` (drizzle-kit generate)
- 적용: `npm run db:migrate` (drizzle-kit migrate)
- 시드: `npm run db:seed`
- 마이그레이션 SQL(`drizzle/`)은 Git에 포함해 버전 관리한다.
- 초기 마이그레이션: `drizzle/0000_easy_photon.sql` — enum 2개 + `tickets` 테이블 + 인덱스 1개

**환경 변수**

```bash
POSTGRES_URL=   # Vercel Postgres (Neon) 연결 문자열
```

---

## 8. 2차 스펙 대비 (MVP 미적용)

아래는 현재 스키마에 **포함하지 않는다**. 도입 시 필요한 변경만 기록해 둔다.

| 항목 | 예상 변경 |
|------|----------|
| 인증 / 멀티 사용자 | `users` 테이블 + `tickets.user_id` FK, 모든 조회에 사용자 스코프 |
| 커스텀 칼럼 | `columns` 테이블 분리, `tickets.status` → `column_id` FK |
| 라벨 | `labels` + `ticket_labels` 조인 테이블 |
| 코멘트 | `comments` 테이블 (`ticket_id` FK) |
| 파일 업로드 | `attachments` 테이블 + 오브젝트 스토리지 |
