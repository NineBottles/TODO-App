# Tika - 테스트 케이스 (TEST_CASES.md)

> 버전: 1.0 (MVP)
> 기준 구현: `__tests__/**`
> 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) (추적 매트릭스), [API_SPEC.md](./API_SPEC.md), [COMPONENT_SPEC.md](./COMPONENT_SPEC.md)

---

## 1. 테스트 전략

### 1.1 TDD 사이클

1. **Red** — 이 문서의 테스트 케이스를 먼저 작성한다. 구현 코드는 만들지 않는다.
2. **Green** — 테스트를 통과하는 최소한의 코드를 작성한다. 테스트는 수정하지 않는다.
3. **Refactor** — 테스트를 통과한 상태를 유지하며 코드를 개선한다. 새 기능은 추가하지 않는다.

테스트가 실패하면 **구현을 고친다**. 명세 자체가 잘못된 경우에만 명세를 먼저 고치고 테스트를 조정한다.

### 1.2 계층별 범위

| 계층 | 위치 | 환경 | 대상 | 대역(mock) |
|------|------|------|------|-----------|
| 서비스 | `__tests__/services/` | node | `ticketService`, Zod 스키마, position 유틸, 시드 가드 | `ticketRepository` |
| API | `__tests__/api/` | node | Route Handler (상태 코드, 응답 형식, 검증) | `ticketService` |
| 컴포넌트 | `__tests__/components/` | jsdom | 렌더링, 사용자 상호작용 | `ticketApi` |
| 훅 | `__tests__/hooks/` | jsdom | `useTickets` (낙관적 업데이트/롤백) | `ticketApi` |

DB 접근 계층(`ticketRepository`)은 실제 Postgres 연결이 필요하므로 MVP 단위 테스트 범위에서 제외하고, 모든 상위 계층에서 mock으로 대체한다.

### 1.3 실행

```bash
npm test              # 전체
npm run test:watch    # 감시 모드
npx jest __tests__/services   # 특정 디렉토리
```

### 1.4 테스트 ID 체계

| 접두사 | 계층 |
|--------|------|
| `TC-SVC-*` | 서비스 / 검증 / 유틸 |
| `TC-API-*` | Route Handler |
| `TC-COMP-*` | 컴포넌트 |
| `TC-HOOK-*` | 훅 |
| `TC-INT-*` | 흐름 통합 (훅 + API 계약 조합) |

---

## 2. TC-SVC — 서비스 계층

**파일**: `__tests__/services/ticketService.test.ts`, `__tests__/services/validations.test.ts`

### 2.1 티켓 생성 (FR-001)

| ID | 케이스 | 기대 결과 |
|----|--------|----------|
| TC-SVC-001 | 어떤 입력이든 생성 | `status`가 항상 `BACKLOG` |
| TC-SVC-002 | 빈 BACKLOG 칼럼에 생성 | `position = 0` |
| TC-SVC-003 | 기존 티켓(position 0, 2048)이 있는 칼럼에 생성 | `position = -1024` (최솟값 − 1024, 맨 위) |

### 2.2 보드 조회 (FR-002, FR-008)

| ID | 케이스 | 기대 결과 |
|----|--------|----------|
| TC-SVC-004 | 여러 상태의 티켓 조회 | 4개 키가 모두 존재하고, 각 칼럼이 `position` 오름차순 정렬. 티켓 없는 칼럼은 `[]` |
| TC-SVC-005 | `dueDate`가 과거 + `status ≠ DONE` | `isOverdue === true` |
| TC-SVC-006 | `dueDate`가 과거 + `status === DONE` | `isOverdue === false` |
| TC-SVC-007 | `dueDate`가 `null` | `isOverdue === false` |
| TC-SVC-008 | DONE 티켓 2건 (`completedAt` 1시간 전 / 25시간 전) | 1시간 전 티켓만 응답에 포함 |

### 2.3 조회 · 수정 · 삭제 (FR-003, FR-004, FR-006)

| ID | 케이스 | 기대 결과 |
|----|--------|----------|
| TC-SVC-009 | 없는 ID로 `getById` | `NotFoundError` |
| TC-SVC-010 | `{ title }`만 전달해 수정 | `title`과 `updatedAt`만 갱신, `priority`는 전달되지 않음 |
| TC-SVC-011 | 없는 ID로 수정 | `NotFoundError` |
| TC-SVC-012 | 없는 ID로 삭제 | `NotFoundError` |

### 2.4 완료 처리 (FR-005)

| ID | 케이스 | 기대 결과 |
|----|--------|----------|
| TC-SVC-013 | IN_PROGRESS 티켓 완료 | `status = DONE`, `completedAt`이 현재 시각 문자열로 설정 |
| TC-SVC-014 | 없는 ID로 완료 | `NotFoundError` |

### 2.5 상태/순서 변경 (FR-007)

| ID | 케이스 | 기대 결과 |
|----|--------|----------|
| TC-SVC-015 | TODO → IN_PROGRESS | `startedAt`이 현재 시각으로 기록 |
| TC-SVC-016 | IN_PROGRESS → BACKLOG (기존 `startedAt` 있음) | `startedAt = null` |
| TC-SVC-016a | IN_PROGRESS → TODO (기존 `startedAt` 있음) | `startedAt` 유지 |
| TC-SVC-017 | DONE → IN_PROGRESS | `completedAt = null` |
| TC-SVC-018 | 칼럼에 position 0, 1인 티켓이 있고 0.5 위치로 이동 | 칼럼 전체를 1024 간격 재정렬: `[{2,0},{1,1024},{3,2048}]` |
| TC-SVC-019 | 없는 `ticketId`로 이동 | `NotFoundError` |

### 2.6 Zod 검증 (FR-001, FR-004, FR-007)

| ID | 입력 | 기대 결과 |
|----|------|----------|
| TC-SVC-020 | `{ title: '할 일' }` | 통과, `priority` 기본값 `MEDIUM` |
| TC-SVC-021 | `{ title: '' }` | 실패 — "제목을 입력해주세요" |
| TC-SVC-022 | `{ title: '   ' }` (공백만) | 실패 — "제목을 입력해주세요" |
| TC-SVC-023 | 제목 201자 | 실패 — "제목은 200자 이내로 입력해주세요" |
| TC-SVC-024 | 설명 1001자 | 실패 — "설명은 1000자 이내로 입력해주세요" |
| TC-SVC-025 | `priority: 'URGENT'` | 실패 — "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요" |
| TC-SVC-026 | `dueDate: '2020-01-01'` (생성 스키마) | 실패 — "종료예정일은 오늘 이후 날짜를 선택해주세요" |
| TC-SVC-027 | 수정 스키마에 `{ title }`만 / `{}` | 둘 다 통과 (부분 수정) |
| TC-SVC-028 | 수정 스키마에 `{ description: null, dueDate: null }` | 통과 (null로 삭제 가능) |
| TC-SVC-028a | 수정 스키마에 `{ dueDate: '2020-01-01' }` | **통과** — 오버듀 티켓도 수정 가능해야 하므로 미래 제약 없음 |
| TC-SVC-028b | 수정 스키마에 `{ dueDate: '2020-13-99' }` | 실패 — 형식 검증은 유지 |
| TC-SVC-029 | reorder 스키마에 `status: 'DONE'` | 실패 — "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" |

### 2.7 position 유틸 (FR-007)

| ID | 케이스 | 기대 결과 |
|----|--------|----------|
| TC-SVC-030 | 빈 칼럼에 삽입 | `0` |
| TC-SVC-031 | 맨 앞 삽입 (첫 카드 0) | `-1024` |
| TC-SVC-032 | 맨 뒤 삽입 (마지막 카드 1024) | `2048` |
| TC-SVC-033 | 0과 1024 사이 삽입 | `512` |
| TC-SVC-033a | 0과 1 사이 삽입 (인접) | `0` — **정수 보장**(내림). 소수를 반환하면 reorder가 400으로 거부됨 |
| TC-SVC-033b | 0과 3 사이 삽입 | `1` — 내림 처리 |
| TC-SVC-034 | 간격 1024 / 간격 0.5 | `needsRebalance` → `false` / `true` |
| TC-SVC-035 | 재정렬 실행 | position이 `0, 1024`로 다시 매겨짐 |

---

## 3. TC-API — Route Handler

**파일**: `__tests__/api/tickets.test.ts` (`ticketService` mock)

| ID | 대상 | 케이스 | 기대 결과 | FR |
|----|------|--------|----------|-----|
| TC-API-001 | `POST /api/tickets` | 유효한 제목으로 생성 | 201 + 생성된 티켓 본문 | FR-001 |
| TC-API-001a | `POST /api/tickets` | `title: ''` | 400, `code: VALIDATION_ERROR`, `message: "제목을 입력해주세요"` | FR-001 |
| TC-API-002 | `GET /api/tickets` | 보드 조회 | 200 + 4개 칼럼 키를 가진 객체 | FR-002 |
| TC-API-003 | `GET /api/tickets/:id` | 존재하는 ID | 200, 서비스에 숫자 `1`이 전달됨 | FR-003 |
| TC-API-003a | `GET /api/tickets/:id` | 없는 ID | 404 + `{ code: 'TICKET_NOT_FOUND', message: '티켓을 찾을 수 없습니다' }` | FR-003 |
| TC-API-004 | `PATCH /api/tickets/:id` | `{ title: '수정됨' }` | 200, 서비스에 `(1, { title: '수정됨' })` 전달 | FR-004 |
| TC-API-004a | `PATCH /api/tickets/:id` | 제목 201자 | 400 — "제목은 200자 이내로 입력해주세요" | FR-004 |
| TC-API-005 | `PATCH /api/tickets/:id/complete` | 완료 처리 | 200, 서비스에 `1` 전달 | FR-005 |
| TC-API-006 | `DELETE /api/tickets/:id` | 삭제 성공 | 204, 본문 없음 | FR-006 |
| TC-API-006a | `DELETE /api/tickets/:id` | 없는 ID | 404 | FR-006 |
| TC-API-007 | `PATCH /api/tickets/reorder` | 유효한 이동 | 200 + 갱신된 티켓 배열 | FR-007 |
| TC-API-007a | `PATCH /api/tickets/reorder` | `status: 'DONE'` | 400 — "상태는 BACKLOG, TODO, IN_PROGRESS 중 선택해주세요" | FR-007 |
| TC-API-007b | `PATCH /api/tickets/reorder` | 없는 `ticketId` | 404 | FR-007 |
| TC-API-008 | `GET /api/tickets` | 오버듀 파생 필드 | `isOverdue` 계산은 서비스 계층에서 검증 (TC-SVC-005~007) | FR-008 |

> TC-API-008은 Route Handler가 서비스 결과를 그대로 직렬화하는 얇은 계층이므로, 실제 판정 로직 검증은 TC-SVC-005~007이 담당한다.

---

## 4. TC-COMP — 컴포넌트

### 4.0 Modal — `__tests__/components/Modal.test.tsx`

| ID | 케이스 | 기대 결과 | NFR |
|----|--------|----------|-----|
| TC-COMP-008 | Escape | `onClose` 1회 호출 | NFR-003 |
| TC-COMP-008a | 열림/닫힘 | `body` 스크롤 잠금 후 복원 | NFR-003 |
| TC-COMP-008b | 닫힐 때 | 열기 직전 포커스로 복원 | NFR-003 |
| TC-COMP-008c | 마지막 요소에서 `Tab` | 첫 요소로 순환 (포커스 트랩) | NFR-003 |
| TC-COMP-008d | 중첩 모달에서 Escape | **최상단만** 닫힘, 바깥 모달은 유지 | NFR-003 |

### 4.1 TicketCard — `__tests__/components/TicketCard.test.tsx`

| ID | 케이스 | 기대 결과 | US |
|----|--------|----------|-----|
| TC-COMP-001 | `isOverdue: true` | "기한 초과 경고" 요소가 나타난다 | US-004 |
| TC-COMP-001a | `isOverdue: false` | 경고 요소가 없다 | US-004 |
| TC-COMP-001b | 기본 렌더링 | 제목과 계획 일정(`03/01 ~ 03/10`)을 표시한다 | US-003 |
| TC-COMP-001c | `priority: HIGH` | "우선순위 높음" 뱃지를 표시한다 | US-002 |
| TC-COMP-001d | 카드 클릭 | `onSelect`가 해당 티켓과 함께 호출된다 | US-007 |

> 카드 클릭 테스트는 `PointerSensor`에 6px 활성화 제약을 건 DnD 하네스에서 실행해야 한다. 제약이 없으면 @dnd-kit이 클릭을 드래그로 처리해 후속 click 이벤트를 막는다.

**키보드 조작** — `__tests__/components/TicketCardKeyboard.test.tsx` (`useSortable` mock)

| ID | 케이스 | 기대 결과 | NFR |
|----|--------|----------|-----|
| TC-COMP-009 | 키 입력 | sortable의 `onKeyDown`이 **덮어써지지 않고 호출**된다 | NFR-003 |
| TC-COMP-009a | `Space` | 상세를 열지 않는다 (드래그 전용) | NFR-003 |
| TC-COMP-009b | `Enter` | 상세를 연다 | NFR-003 |
| TC-COMP-009c | sortable이 `preventDefault` | 상세를 열지 않는다 (드래그 시작됨) | NFR-003 |

### 4.2 Column — `__tests__/components/Column.test.tsx`

| ID | 케이스 | 기대 결과 | US |
|----|--------|----------|-----|
| TC-COMP-003 | 티켓 2건 | 칼럼 이름과 카드 수 `2`를 표시한다 | US-003 |
| TC-COMP-003a | 티켓 2건 | 전달받은 순서대로 렌더링된다 | US-003 |
| TC-COMP-003b | 티켓 0건 | "티켓이 없습니다" + 카드 수 `0` | US-003 |

### 4.3 resolveDropTarget — `__tests__/components/resolveDropTarget.test.ts`

드래그 대상 인덱스 계산 순수 함수. jsdom에서 재현이 어려운 DnD 좌표 로직을 분리해 검증한다.

| ID | 케이스 (칼럼 `[A,B,C]`) | 기대 결과 | US |
|----|------|----------|-----|
| TC-COMP-007 | A를 C 위에 드롭 (아래로) | `targetIndex = 2` → 결과 `[B,C,A]` | US-005 |
| TC-COMP-007a | A를 B 위에 드롭 (한 칸 아래) | `targetIndex = 1` → 결과 `[B,A,C]` | US-005 |
| TC-COMP-007b | C를 A 위에 드롭 (위로) | `targetIndex = 0` → 결과 `[C,A,B]` | US-005 |
| TC-COMP-007c | A를 자기 자신 위에 드롭 | `null` (API 미호출) | US-005 |
| TC-COMP-007d | 같은 칼럼 여백에 드롭 | `targetIndex = 길이 − 1` (맨 뒤) | US-005 |
| TC-COMP-007e | 다른 칼럼 여백에 드롭 | `targetIndex = 길이` (맨 뒤) | US-005 |
| TC-COMP-007f | 다른 칼럼의 티켓 위에 드롭 | `targetIndex` = 그 티켓 인덱스 | US-005 |

### 4.4 Board — `__tests__/components/Board.test.tsx`

| ID | 케이스 | 기대 결과 | US |
|----|--------|----------|-----|
| TC-COMP-002 | 초기 렌더링 | Backlog / TODO / In-Progress / Done 4개 칼럼이 모두 존재한다 | US-003 |
| TC-COMP-002a | 초기 렌더링 | 각 티켓이 상태에 맞는 칼럼 안에 배치된다 | US-003 |
| TC-COMP-004 | "+ 새 티켓" 클릭 → 제목 입력 → 생성 | 생성 폼이 열리고, `createTicket` 호출 후 폼이 닫힌다 | US-001 |
| TC-COMP-005 | 카드 클릭 | "티켓 상세" 모달이 열린다 | US-007 |
| TC-COMP-010 | 두 번 렌더링 후 `aria-describedby` 비교 | 값이 동일하다 — `DndContext`에 고정 `id`가 없으면 SSR 하이드레이션이 깨진다 | NFR-005 |

### 4.5 TicketForm — `__tests__/components/TicketForm.test.tsx`

| ID | 케이스 | 기대 결과 | US |
|----|--------|----------|-----|
| TC-COMP-004a | 제목만 입력 후 제출 | `onSubmit`이 `priority: 'MEDIUM'`과 함께 호출된다 | US-001 |
| TC-COMP-004b | 빈 제목으로 제출 | "제목을 입력해주세요" 표시, `onSubmit` 미호출 | US-001 |
| TC-COMP-004c | 과거 종료예정일로 제출 | "종료예정일은 오늘 이후 날짜를 선택해주세요" 표시, `onSubmit` 미호출 | US-002 |
| TC-COMP-004d | `initialValues` 전달 | 제목·설명·우선순위가 폼에 채워진다 | US-007 |
| TC-COMP-004e | 취소 클릭 | `onCancel` 호출 | US-001 |
| TC-COMP-004f | `initialValues.dueDate`가 과거인 채로 제목만 수정 후 저장 | **에러 없이** `onSubmit` 호출 (오버듀 티켓 수정 가능) | US-004, US-007 |
| TC-COMP-004g | 종료예정일을 과거로 **새로 선택**해서 저장 | "종료예정일은 오늘 이후 날짜를 선택해주세요" 표시, `onSubmit` 미호출 | US-002 |

### 4.6 TicketModal — `__tests__/components/TicketModal.test.tsx`

| ID | 케이스 | 기대 결과 | US |
|----|--------|----------|-----|
| TC-COMP-005a | 티켓 전달 | "티켓 상세" 다이얼로그가 열리고 제목이 채워진다 | US-007 |
| TC-COMP-005b | 제목 수정 후 저장 | `onUpdate(7, { title: '수정된 제목', ... })` 호출 후 모달이 닫힌다 | US-007 |
| TC-COMP-006 | 삭제 클릭 | 확인 다이얼로그가 열리고, **이 시점에는 `onDelete` 미호출** | US-008 |
| TC-COMP-006a | 확인 다이얼로그에서 삭제 확정 | `onDelete(7)` 호출 | US-008 |
| TC-COMP-005c | `ticket: null` | 아무것도 렌더링하지 않는다 | US-007 |

---

## 5. TC-HOOK / TC-INT — 흐름 통합

**파일**: `__tests__/hooks/useTickets.test.ts` (`ticketApi` mock)

드래그앤드롭의 실제 포인터 조작은 jsdom에서 안정적으로 재현되지 않으므로, DnD **결과 처리 흐름**을 훅 수준에서 검증한다. `Board.onDragEnd`는 좌표 계산 후 `moveTicket(id, toStatus, targetIndex)`을 호출하는 얇은 어댑터이며, 그 이후 로직 전부가 아래 케이스로 커버된다.

| ID | 케이스 | 기대 결과 | 관련 |
|----|--------|----------|------|
| TC-INT-001 | BACKLOG 티켓을 TODO 칼럼 인덱스 1로 이동 | `reorderTicket({ ticketId: 1, status: 'TODO', position: 1024 })` 호출 | FR-007, US-005 |
| TC-INT-002 | TODO 티켓을 DONE으로 이동 | `completeTicket(2)` 호출, `reorderTicket`은 미호출 | FR-005, US-006 |
| TC-INT-003 | 이동 API가 실패 | 보드가 이동 전 상태로 롤백되고 `error` 메시지가 설정된다 | NFR-004, US-005 |
| TC-HOOK-001 | 티켓 생성 | 새 티켓이 BACKLOG **맨 위**에 추가된다 (`[9, 1]`) | FR-001, US-001 |
| TC-HOOK-002 | 티켓 삭제 | 해당 티켓이 보드에서 사라진다 | FR-006, US-008 |
| TC-HOOK-003 | 티켓 수정 | 수정된 제목이 보드에 반영된다 | FR-004, US-007 |
| TC-INT-004 | 이동 API 성공 + `refresh` 실패 | **롤백하지 않는다.** 서버에 반영됐으므로 화면도 이동 상태 유지 | NFR-004 |
| TC-INT-005 | 이미 DONE인 티켓을 Done 안에서 이동 | `reorderTicket` 호출, `completeTicket` **미호출** | FR-005 |
| TC-INT-006 | DONE이 아니던 티켓을 Done으로 이동 | `completeTicket` 호출 | FR-005, US-006 |

---

## 6. 추적 매트릭스 (US ↔ FR ↔ TC)

| 사용자 스토리 | FR | 테스트 케이스 |
|--------------|-----|--------------|
| US-001 새 할 일 등록 | FR-001 | TC-SVC-001~003, TC-API-001, TC-COMP-004, TC-COMP-004a/b/e, TC-HOOK-001 |
| US-002 상세 정보 설정 | FR-001 | TC-SVC-020, TC-SVC-025~026, TC-COMP-001c, TC-COMP-004c |
| US-003 칸반 보드 현황 파악 | FR-002, FR-008 | TC-SVC-004, TC-API-002, TC-COMP-001b, TC-COMP-002, TC-COMP-002a, TC-COMP-003~003b |
| US-004 마감 초과 인지 | FR-008 | TC-SVC-005~007, TC-API-008, TC-COMP-001, TC-COMP-001a |
| US-005 드래그앤드롭 상태 변경 | FR-007 | TC-SVC-015~019, TC-API-007~007b, TC-SVC-030~035, TC-COMP-007~007f, TC-INT-001, TC-INT-003 |
| US-006 할 일 완료 처리 | FR-005 | TC-SVC-013~014, TC-SVC-015~017, TC-API-005, TC-INT-002 |
| US-007 할 일 수정 | FR-003, FR-004 | TC-SVC-009~011, TC-SVC-028a~028b, TC-API-003~004a, TC-COMP-004f, TC-COMP-005, TC-COMP-005a~c, TC-HOOK-003 |
| US-008 할 일 삭제 | FR-006 | TC-SVC-012, TC-API-006, TC-API-006a, TC-COMP-006, TC-COMP-006a, TC-HOOK-002 |

---

## 7. MVP 범위 밖 (미작성)

의도적으로 작성하지 않은 테스트와 그 이유를 남긴다. 2차 스펙에서 다룬다.

| 항목 | 이유 |
|------|------|
| `ticketRepository` 통합 테스트 | 실제 Postgres 인스턴스 필요. `tika_test` DB는 준비돼 있으나 연결 구성은 2차 |
| `applyReorder` 트랜잭션 롤백 검증 | 서비스 테스트는 "한 번의 호출로 넘긴다"까지만 검증한다. 실제 롤백은 실 DB 통합 테스트 영역 |
| E2E (Playwright 등) | MVP 도구 스택에 포함되지 않음 (Jest + RTL만 사용) |
| 실제 포인터 드래그 시뮬레이션 | jsdom에서 @dnd-kit 좌표 계산이 불안정. TC-INT로 결과 흐름을 대체 검증 |
| 키보드 드래그의 실제 좌표 이동 | 활성화 경로는 TC-COMP-009로 고정했으나, 화살표 이동 후 최종 위치는 jsdom에서 재현 불가. 수동 확인 대상 (NFR-003) |
| 반응형 브레이크포인트 | CSS 미디어 쿼리는 jsdom에서 검증 불가. 수동 확인 대상 (NFR-002) |
| 성능 기준 (NFR-001) | Lighthouse / 배포 환경 측정 대상 |
