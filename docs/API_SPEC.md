# Tika - API 명세 (API_SPEC.md)

> 버전: 1.0 (MVP)
> 기준 구현: `app/api/tickets/**`, `src/server/services/ticketService.ts`
> 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) (FR), [DATA_MODEL.md](./DATA_MODEL.md)

---

## 1. 공통 규약

| 항목 | 값 |
|------|-----|
| 기본 경로 | `/api/tickets` |
| 요청/응답 형식 | `application/json` |
| 인증 | 없음 (단일 사용자 MVP) |
| 날짜 필드 | `plannedStartDate`, `dueDate` → `YYYY-MM-DD` 문자열 |
| 시각 필드 | `startedAt`, `completedAt`, `createdAt`, `updatedAt` → ISO 8601 문자열 (UTC) |

### 1.1 사용 상태 코드

| 코드 | 사용처 |
|------|--------|
| 200 OK | 조회, 수정, 완료, 순서 변경 성공 |
| 201 Created | 티켓 생성 성공 |
| 204 No Content | 티켓 삭제 성공 (본문 없음) |
| 400 Bad Request | Zod 검증 실패, 잘못된 JSON 본문 |
| 404 Not Found | 존재하지 않는 티켓 ID |
| 500 Internal Server Error | 서버/DB 오류 |

### 1.2 에러 응답 형식

모든 실패 응답은 아래 형식을 따른다. `details`는 검증 실패(400)일 때만 포함된다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "제목을 입력해주세요",
    "details": [
      { "field": "title", "message": "제목을 입력해주세요" }
    ]
  }
}
```

`message`는 첫 번째 검증 이슈의 메시지이며, `details`에 전체 이슈가 담긴다.

### 1.3 에러 코드

| code | HTTP | 의미 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 요청 값이 Zod 스키마를 통과하지 못함 |
| `TICKET_NOT_FOUND` | 404 | 해당 ID의 티켓이 없음 (`message`: "티켓을 찾을 수 없습니다") |
| `INTERNAL_ERROR` | 500 | 그 외 서버 오류 (`message`: "서버 오류가 발생했습니다"). **원본 예외는 서버 로그에 기록한다** — 응답에는 내부 정보를 담지 않되, 버리지도 않는다 |

### 1.4 Ticket 객체

```json
{
  "id": 1,
  "title": "PRD 검토",
  "description": "제품 요구사항 문서를 읽고 범위를 확인한다",
  "status": "BACKLOG",
  "priority": "HIGH",
  "position": 0,
  "plannedStartDate": "2026-03-01",
  "dueDate": "2026-03-10",
  "startedAt": null,
  "completedAt": null,
  "createdAt": "2026-03-01T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

보드 조회(`GET /api/tickets`)의 티켓에는 파생 필드 `isOverdue: boolean`이 추가된다 (TicketView).

---

## 2. 엔드포인트 목록

| Method | Path | 기능 | FR |
|--------|------|------|-----|
| GET | `/api/tickets` | 보드 조회 (칼럼별 그룹화) | FR-002 |
| POST | `/api/tickets` | 티켓 생성 | FR-001 |
| GET | `/api/tickets/:id` | 티켓 상세 조회 | FR-003 |
| PATCH | `/api/tickets/:id` | 티켓 수정 | FR-004 |
| DELETE | `/api/tickets/:id` | 티켓 삭제 | FR-006 |
| PATCH | `/api/tickets/:id/complete` | 완료 처리 (DONE 이동) | FR-005 |
| PATCH | `/api/tickets/reorder` | 상태/순서 변경 | FR-007 |

---

## 3. GET /api/tickets — 보드 조회 (FR-002)

전체 티켓을 4개 칼럼으로 그룹화해 반환한다.

**요청**: 파라미터 없음

**응답 200**

```json
{
  "BACKLOG": [ { "...": "TicketView" } ],
  "TODO": [],
  "IN_PROGRESS": [],
  "DONE": []
}
```

**처리 규칙**

- 4개 키(`BACKLOG`, `TODO`, `IN_PROGRESS`, `DONE`)는 티켓이 없어도 항상 빈 배열로 존재한다.
- 각 칼럼 내부는 `position` 오름차순 정렬.
- 각 티켓에 `isOverdue` 파생 필드를 계산해 포함한다 (FR-008: `dueDate < 오늘 AND status !== DONE`).
- `DONE` 칼럼은 `completedAt` 기준 **24시간 이내** 티켓만 포함한다. 24시간이 지난 완료 티켓은 DB에는 남지만 응답에서 제외된다.
- 단 `completedAt`이 `null`인 `DONE` 티켓은 **제외하지 않는다.** 숨기면 보드 어디에도 나타나지 않아 사용자가 되돌릴 수 없기 때문이다.

---

## 4. POST /api/tickets — 티켓 생성 (FR-001)

**요청 본문**

| 필드 | 타입 | 필수 | 제약 | 기본값 |
|------|------|------|------|--------|
| `title` | string | O | 1~200자, 공백만 불가(trim 후 판정) | — |
| `description` | string \| null | X | 최대 1000자 | `null` |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` | X | — | `MEDIUM` |
| `plannedStartDate` | string \| null | X | `YYYY-MM-DD` | `null` |
| `dueDate` | string \| null | X | `YYYY-MM-DD`, 오늘 이상 | `null` |

```json
{ "title": "새 티켓", "priority": "HIGH", "dueDate": "2026-12-31" }
```

**처리 규칙**

- `status`는 요청 값과 무관하게 항상 `BACKLOG`.
- `position`은 BACKLOG 칼럼의 최솟값 − 1024 (맨 위 배치). 칼럼이 비어 있으면 `0`.
- `createdAt`, `updatedAt` 자동 설정.

**응답 201**: 생성된 Ticket 전체

**응답 400** — 검증 에러 메시지

| 조건 | message |
|------|---------|
| 제목 누락 / 공백만 입력 | 제목을 입력해주세요 |
| 제목 200자 초과 | 제목은 200자 이내로 입력해주세요 |
| 설명 1000자 초과 | 설명은 1000자 이내로 입력해주세요 |
| 잘못된 우선순위 값 | 우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요 |
| 과거 종료예정일 | 종료예정일은 오늘 이후 날짜를 선택해주세요 |
| 날짜 형식 오류 | 날짜 형식은 YYYY-MM-DD 이어야 합니다 |
| JSON 파싱 실패 | JSON 형식의 요청 본문이 필요합니다 |

---

## 5. GET /api/tickets/:id — 상세 조회 (FR-003)

**경로 파라미터**: `id` — 양의 정수

**응답 200**: Ticket 전체 (`isOverdue` 미포함)
**응답 400**: `id`가 양의 정수가 아님
**응답 404**: `TICKET_NOT_FOUND`

---

## 6. PATCH /api/tickets/:id — 티켓 수정 (FR-004)

전송된 필드만 갱신하는 부분 수정.

**요청 본문** (모두 선택)

| 필드 | 타입 | 제약 |
|------|------|------|
| `title` | string | 1~200자 |
| `description` | string \| null | 최대 1000자. `null` 전송 시 삭제 |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` | — |
| `plannedStartDate` | string \| null | `YYYY-MM-DD`. `null` 전송 시 삭제 |
| `dueDate` | string \| null | `YYYY-MM-DD` 형식만 검증(**과거 날짜 허용**). `null` 전송 시 삭제 |

```json
{ "title": "수정된 제목", "description": null }
```

**처리 규칙**

- 본문에 없는 필드는 건드리지 않는다 (`undefined` ≠ `null`).
- **`dueDate`에 "오늘 이후" 제약을 적용하지 않는다.** 기한이 지난 티켓도 수정할 수 있어야 하기 때문이다(생성 시에만 미래 날짜 강제).
- `status`, `position`, `startedAt`, `completedAt`은 이 엔드포인트로 변경할 수 없다. 상태 이동은 FR-005/FR-007을 사용한다.
- `updatedAt` 자동 갱신.

**응답 200**: 수정된 Ticket 전체
**응답 400**: 검증 실패 (메시지는 4장 표와 동일. 단 "종료예정일은 오늘 이후…"는 발생하지 않음)
**응답 404**: `TICKET_NOT_FOUND`

---

## 7. DELETE /api/tickets/:id — 티켓 삭제 (FR-006)

하드 삭제(soft delete 아님).

**응답 204**: 본문 없음
**응답 404**: `TICKET_NOT_FOUND`

---

## 8. PATCH /api/tickets/:id/complete — 완료 처리 (FR-005)

**요청 본문**: 없음

**처리 규칙**

- `status = DONE`, `completedAt = 현재 시각`.
- `position`은 DONE 칼럼의 최솟값 − 1024 (맨 위 배치). 비어 있으면 `0`.
- `updatedAt` 자동 갱신.
- **멱등**: 이미 `DONE`인 티켓에 다시 호출해도 기존 `completedAt`을 유지한다. 덮어쓰면 실제 완료 시각이 사라지고 24시간 노출 창이 리셋된다.
- Done 칼럼 **안에서 순서만** 바꾸는 조작은 이 엔드포인트가 아니라 `PATCH /api/tickets/reorder`를 사용한다.
- DONE에서 다른 칼럼으로 되돌리는 것도 `PATCH /api/tickets/reorder`가 담당하며, 그때 `completedAt`이 `null`로 초기화된다.

**응답 200**: 업데이트된 Ticket 전체
**응답 404**: `TICKET_NOT_FOUND`

---

## 9. PATCH /api/tickets/reorder — 상태/순서 변경 (FR-007)

칼럼 간 이동과 칼럼 내 순서 변경을 모두 처리한다.

**요청 본문**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ticketId` | number | O | 이동할 티켓 ID (양의 정수) |
| `status` | `BACKLOG` \| `TODO` \| `IN_PROGRESS` \| `DONE` | O | 이동 대상 칼럼 (**`DONE` 포함**) |
| `position` | number | O | 칼럼 내 새 position 값 |

```json
{ "ticketId": 1, "status": "TODO", "position": 512 }
```

> `DONE`으로 **처음 진입**하면 `completedAt`이 기록되고, **이미 `DONE`이면 유지**된다. 따라서 Done 칼럼 내 재정렬에 안전하게 쓸 수 있다.
> `PATCH /api/tickets/:id/complete`(8장)는 Done 진입 전용 단축 경로로 계속 제공된다.

**position 계산 (클라이언트)**

클라이언트가 드롭 위치를 기준으로 계산해 전송한다 (`src/shared/position.ts`의 `calculatePosition`).

| 삽입 위치 | 계산식 |
|-----------|--------|
| 빈 칼럼 | `0` |
| 맨 앞 | `첫 카드.position - 1024` |
| 두 카드 사이 | `floor((prev.position + next.position) / 2)` |
| 맨 뒤 | `마지막 카드.position + 1024` |

`position`은 정수 컬럼이자 스키마상 `int`이므로 **소수를 전송하면 400으로 거부된다.** 두 카드 사이 계산은 반드시 내림 처리한다. 인접한 카드 사이(간격 1)에 삽입해 앞 카드와 값이 같아지면, 아래 재정렬이 간격을 복구한다.

**position 재정렬 (서버)**

이동 반영 후 대상 칼럼의 인접 간격이 **1 미만**이면(값이 같은 경우 포함), 해당 칼럼 전체를 `0, 1024, 2048, …` 간격으로 재정렬한다.

**티켓 갱신과 재정렬은 하나의 트랜잭션으로 처리한다.** 둘을 분리하면 재정렬 단계 실패 시 티켓만 이동하고 칼럼 position이 깨진 채 남는다.

**실제 일정 자동 기록**

| 조건 | 동작 |
|------|------|
| `status = IN_PROGRESS` 이고 기존 상태가 IN_PROGRESS가 아님 | `startedAt = 현재 시각` |
| `status = BACKLOG` | `startedAt = null` |
| `status = DONE` 이고 기존 상태가 DONE이 아님 | `completedAt = 현재 시각` |
| `status = DONE` 이고 기존 상태도 DONE | `completedAt` **유지** (Done 내 재정렬) |
| 기존 상태가 `DONE` 이고 대상이 DONE이 아님 | `completedAt = null` |

**응답 200**: 재정렬이 반영된 **대상 칼럼의 티켓 배열** (`position` 오름차순)

```json
[ { "id": 2, "position": 0, "...": "" }, { "id": 1, "position": 1024, "...": "" } ]
```

**응답 400**

| 조건 | message |
|------|---------|
| `status`가 잘못된 값 | 상태는 BACKLOG, TODO, IN_PROGRESS, DONE 중 선택해주세요 |
| `ticketId`/`position` 타입 오류 | Zod 기본 메시지 |

**응답 404**: 존재하지 않는 `ticketId` → "티켓을 찾을 수 없습니다"

---

## 10. 클라이언트 호출 함수 매핑

모든 API 호출은 `src/client/api/ticketApi.ts`를 경유한다 (컴포넌트에서 직접 `fetch` 금지).

| 함수 | 엔드포인트 |
|------|-----------|
| `fetchBoard()` | `GET /api/tickets` |
| `fetchTicket(id)` | `GET /api/tickets/:id` |
| `createTicket(input)` | `POST /api/tickets` |
| `updateTicket(id, input)` | `PATCH /api/tickets/:id` |
| `deleteTicket(id)` | `DELETE /api/tickets/:id` |
| `completeTicket(id)` | `PATCH /api/tickets/:id/complete` |
| `reorderTicket(input)` | `PATCH /api/tickets/reorder` |

실패 시 `ApiRequestError(status, code, message)`를 던진다.
