# Tika - 컴포넌트 명세 (COMPONENT_SPEC.md)

> 버전: 1.0 (MVP)
> 기준 구현: `src/client/**`, `app/(board)/**`
> 관련 문서: [API_SPEC.md](./API_SPEC.md), [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## 1. 컴포넌트 계층

```
app/layout.tsx                     (RootLayout, 서버)
└─ app/(board)/layout.tsx          (BoardLayout, 서버 — 헤더 "Tika Board")
   └─ app/(board)/page.tsx         (BoardPage, 서버 — 초기 보드 데이터 SSR)
      └─ Board                     ('use client' — DndContext + 상태 소유)
         ├─ Column × 4             (Backlog 사이드바 / TODO / In-Progress / Done)
         │  └─ TicketCard × n      (useSortable)
         │     └─ Badge
         ├─ DragOverlay
         │  └─ TicketCard (isOverlay)
         ├─ Modal "새 티켓"
         │  └─ TicketForm
         └─ TicketModal            (선택된 티켓이 있을 때만)
            ├─ Modal
            │  └─ TicketForm
            └─ ConfirmDialog
               └─ Modal
```

**상태 소유**: 보드 데이터는 `Board`가 `useTickets` 훅을 통해 단독 소유한다. 하위 컴포넌트는 모두 props로 데이터와 콜백을 받는 표현 컴포넌트다.

**렌더링 전략**: 초기 보드 데이터는 서버 컴포넌트(`page.tsx`)가 `ticketService.getBoard()`로 직접 로드해 `initialBoard`로 내려준다. 이후 변경은 클라이언트에서 API를 통해 처리한다.

---

## 2. 페이지 / 레이아웃

### 2.1 `BoardPage` — `app/(board)/page.tsx` (서버 컴포넌트)

| 항목 | 내용 |
|------|------|
| 역할 | 초기 보드 데이터 SSR 로드 후 `Board`에 전달 |
| 렌더링 | `export const dynamic = 'force-dynamic'` (요청 시마다 최신 데이터) |
| 실패 처리 | DB 조회 실패 시 빈 보드 + `role="alert"` 안내 문구 노출, 앱은 계속 동작 |

### 2.2 `BoardLayout` — `app/(board)/layout.tsx` (서버 컴포넌트)

상단 헤더("Tika Board")와 본문 영역(`main`)을 배치하는 전체 높이 레이아웃.

---

## 3. Board — `src/client/components/board/Board.tsx`

칸반 보드 컨테이너. DnD 컨텍스트와 모든 사용자 상호작용의 진입점.

**Props**

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `initialBoard` | `BoardData` | O | SSR로 받은 초기 보드 데이터 |

**내부 상태**

| 상태 | 타입 | 설명 |
|------|------|------|
| `board`, `error` 외 | `useTickets` 반환값 | 보드 데이터 및 CRUD/이동 액션 |
| `activeTicket` | `TicketView \| null` | 드래그 중인 티켓 (DragOverlay용) |
| `selectedTicket` | `TicketView \| null` | 상세 모달에 표시할 티켓 |
| `isCreateOpen` | `boolean` | 생성 모달 열림 여부 |
| `createError` | `string \| null` | 생성 실패 메시지 |

**레이아웃 (와이어프레임 대응)**

```
┌─────────────┬──────────────────────────────────────┐
│  Backlog    │   TODO    │  In-Progress  │   Done   │
│  (사이드바) │           │               │          │
│ [+ 새 티켓] │           │               │          │
└─────────────┴──────────────────────────────────────┘
```

- 좌측: `Backlog` 칼럼 하나. `footer`로 `+ 새 티켓` 버튼 배치.
- 우측: `TODO` / `In-Progress` / `Done` 3칼럼 swimlane.
- 반응형 (NFR-002): `~767px` 단일 칼럼 세로 스크롤 / `768px~` 2칼럼 그리드 / `1024px~` 사이드바(280px) + 3칼럼 가로 배치.

**DnD 설정**

| 항목 | 값 |
|------|-----|
| `id` | **`"tika-board"` 고정 (필수)** |
| 센서 | `PointerSensor`(distance 6px), `TouchSensor`(delay 200ms, tolerance 8px), `KeyboardSensor`(start/end: **Space만**) |
| 충돌 감지 | `closestCorners` |
| 드래그 오버레이 | `TicketCard` (`isOverlay`) |

> **`DndContext`에 고정 `id`를 반드시 넘긴다.** dnd-kit의 `useUniqueId`는 모듈 수준 카운터로 접근성 id(`DndDescribedBy-N`)를 만드는데, 서버 프로세스에서는 요청마다 값이 증가하고 클라이언트는 0부터 시작한다. 그러면 카드의 `aria-describedby`가 서버/클라이언트에서 달라져 하이드레이션 불일치 경고가 발생하고, 해당 트리는 패치되지 않는다. `id`를 주면 `useUniqueId`가 그 값을 그대로 사용해 결정적이 된다.

> `PointerSensor`의 6px 활성화 제약은 **단순 클릭이 드래그로 오인되지 않도록** 하기 위한 것이다. 이 제약이 없으면 카드 클릭 시 상세 모달이 열리지 않는다.
>
> `KeyboardSensor`의 `keyboardCodes`에서 **Enter를 제외**한다(기본값은 Space+Enter). Enter는 티켓 상세 열기에 쓰므로, 그대로 두면 한 번의 Enter가 드래그와 상세 열기를 동시에 유발한다. (NFR-003)

**이벤트 흐름**

| 이벤트 | 처리 |
|--------|------|
| `onDragStart` | `activeTicket` 설정 |
| `onDragEnd` | 드롭 대상에서 `toStatus`/`targetIndex` 산출 → `moveTicket()` 호출 |
| `onDragCancel` | `activeTicket` 초기화 |

`onDragEnd`의 드롭 대상은 **칼럼(id = status)** 또는 **다른 티켓(id = ticketId)** 중 하나다. 대상 인덱스 계산은 순수 함수 `resolveDropTarget`(`src/client/components/board/resolveDropTarget.ts`)이 담당하며 단위 테스트로 검증한다.

계산 규칙 — 반환하는 `targetIndex`는 **드래그 중인 카드를 제외한 배열** 기준의 삽입 위치다.

| 상황 | targetIndex |
|------|-------------|
| 티켓 위에 드롭 | 대상 칼럼 **원본 배열**에서의 그 티켓 인덱스 |
| 칼럼 여백에 드롭 (다른 칼럼) | 칼럼 길이 (맨 뒤) |
| 칼럼 여백에 드롭 (같은 칼럼) | 칼럼 길이 − 1 (맨 뒤) |
| 같은 칼럼이고 위치 변화 없음 | `null` — API 호출하지 않음 |

> 같은 칼럼에서 아래로 이동할 때, 원본 인덱스를 그대로 쓰면 제외 후 배열에서 대상 카드가 한 칸 앞으로 당겨지므로 결과적으로 "그 카드 뒤"에 놓인다. 위로 이동할 때는 "그 카드 앞"에 놓인다. 양방향 모두 sortable 관례와 일치한다.

**에러 표시**: `useTickets`의 `error`가 있으면 보드 상단에 `role="alert"` 배너를 띄우고 닫기 버튼을 제공한다.

---

## 4. Column — `src/client/components/board/Column.tsx`

**Props**

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `status` | `TicketStatus` | O | — | 칼럼 식별자 겸 드롭 영역 id |
| `tickets` | `TicketView[]` | O | — | 표시할 티켓 (position 정렬 완료 상태) |
| `onSelectTicket` | `(ticket: TicketView) => void` | O | — | 카드 클릭 콜백 |
| `footer` | `ReactNode` | X | — | 칼럼 하단 영역 (Backlog의 `+ 새 티켓` 버튼) |
| `className` | `string` | X | `''` | 추가 클래스 |

**동작**

- `useDroppable({ id: status })`로 칼럼 전체를 드롭 영역으로 등록하고, 드래그가 위에 올라오면 배경색을 변경한다.
- `SortableContext` + `verticalListSortingStrategy`로 칼럼 내 정렬을 지원한다.
- 헤더에 칼럼 라벨과 **카드 수**를 표시한다 (US-003).
- 티켓이 없으면 "티켓이 없습니다" 빈 상태 문구를 표시한다.

**접근성** (NFR-003)

| 요소 | 속성 |
|------|------|
| `section` | `aria-label="{라벨} 칼럼"` |
| 카드 수 | `aria-label="{라벨} 카드 수 {n}"` |
| 리스트 | `role="list"` / 각 항목 `role="listitem"` |

---

## 5. TicketCard — `src/client/components/board/TicketCard.tsx`

**Props**

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `ticket` | `TicketView` | O | — | 표시할 티켓 |
| `onSelect` | `(ticket: TicketView) => void` | O | — | 클릭/Enter 시 호출 |
| `isOverlay` | `boolean` | X | `false` | DragOverlay용 정적 렌더링. `true`면 sortable 비활성 |

**표시 내용**

- 제목 (2줄 클램프)
- 우선순위 `Badge`
- 계획 일정 요약 — `MM/DD ~ MM/DD` 형식, 값이 없으면 `—`
- 오버듀일 때: 붉은 테두리·배경 + "⚠ 기한 초과" 문구

**동작**

- `useSortable({ id: ticket.id, data: { type: 'ticket', status } })`
- 클릭 또는 `Enter` 키 → `onSelect(ticket)` (US-007, NFR-003 키보드 접근)
- **키보드 핸들러는 합성해야 한다.** `{...listeners}`를 펼친 뒤 같은 이름의 `onKeyDown`을 지정하면 dnd-kit의 활성화 핸들러를 덮어써 **키보드 드래그가 통째로 죽는다.** 반드시 `listeners.onKeyDown`을 먼저 호출하고, `event.defaultPrevented`면(드래그가 이벤트를 소비) 상세 열기를 건너뛴다.

| 키 | 동작 |
|----|------|
| `Space` | 드래그 시작 / 놓기 (dnd-kit) |
| 화살표 | 드래그 중 이동 |
| `Escape` | 드래그 취소 |
| `Enter` | 티켓 상세 열기 |
- 드래그 중에는 원본 카드를 반투명 처리하고 실제 이동 표현은 `DragOverlay`가 담당한다.

**접근성**

| 요소 | 속성 |
|------|------|
| `article` | `aria-label="티켓 {제목}"` |
| 계획 일정 | `aria-label="계획 일정"` |
| 오버듀 문구 | `aria-label="기한 초과 경고"` |

> 오버듀 문구에 `role="status"`를 쓰지 않는 이유: @dnd-kit이 자체 live region에 `role="status"`를 사용해 조회가 모호해진다.

---

## 6. TicketForm — `src/client/components/ticket/TicketForm.tsx`

티켓 생성과 수정에 **공통으로** 사용하는 폼.

**Props**

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `initialValues` | `Partial<TicketFormValues>` | X | — | 수정 시 초기값 |
| `submitLabel` | `string` | O | — | 제출 버튼 라벨 ("생성" / "저장") |
| `onSubmit` | `(values: TicketFormValues) => Promise<void>` | O | — | 제출 핸들러 |
| `onCancel` | `() => void` | O | — | 취소 핸들러 |

```ts
type TicketFormValues = {
  title: string;
  description: string;        // 빈 문자열 = 미입력
  priority: TicketPriority;
  plannedStartDate: string;   // 'YYYY-MM-DD' 또는 ''
  dueDate: string;
};
```

**필드**

| 필드 | 입력 요소 | 라벨 | 비고 |
|------|----------|------|------|
| 제목 | `input` | 제목 * | `maxLength=200` |
| 설명 | `textarea` | 설명 | 4행 |
| 우선순위 | `select` | 우선순위 | 기본값 보통(MEDIUM) |
| 시작예정일 | `input[type=date]` | 시작예정일 | — |
| 종료예정일 | `input[type=date]` | 종료예정일 | `min`은 기존 값이 과거면 그 값, 아니면 오늘 |

**검증** (NFR-004)

- 제출 시 백엔드와 **동일한** Zod 스키마(`src/shared/validations/ticket.ts`)로 클라이언트 검증한다.
- **종료예정일의 "오늘 이후" 검증은 사용자가 값을 새로 선택했을 때만 적용한다.** `initialValues.dueDate`와 같은 값이면(= 손대지 않았으면) 과거 날짜여도 통과시킨다. 이렇게 하지 않으면 오버듀 티켓의 다른 필드를 전혀 수정할 수 없다.
  - 값이 바뀐 경우 → `createTicketSchema` (미래 날짜 강제)
  - 값이 그대로인 경우 → `ticketFormSchema` (형식만 검증)
- 실패하면 `onSubmit`을 호출하지 않고 필드별 첫 에러를 `role="alert"`로 표시하며, 해당 입력에 `aria-invalid`를 설정한다.
- 빈 문자열은 API 전송 직전에 `null`로 변환된다 (변환 책임은 호출측 `Board` / `TicketModal`).
- 제출 중에는 버튼이 비활성화되고 라벨이 "저장 중…"으로 바뀐다.

---

## 7. TicketModal — `src/client/components/ticket/TicketModal.tsx`

티켓 상세 조회 · 수정 · 삭제 (FR-003, FR-004, FR-006).

**Props**

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ticket` | `TicketView \| null` | O | `null`이면 아무것도 렌더링하지 않음 |
| `onClose` | `() => void` | O | 닫기 |
| `onUpdate` | `(id, payload: UpdateTicketPayload) => Promise<unknown>` | O | 수정 |
| `onDelete` | `(id: number) => Promise<void>` | O | 삭제 |

**구성**

1. 읽기 전용 요약 (`dl`): 상태, 기한 초과 여부, 실제 시작일, 실제 종료일 — 실제 일정은 자동 기록 값이므로 편집 불가
2. `TicketForm` (`submitLabel="저장"`) — 제목/설명/우선순위/시작예정일/종료예정일 수정
3. 삭제 버튼 → `ConfirmDialog`

**동작**

- 저장 성공 시 모달을 닫는다. 실패하면 모달 안에 `role="alert"` 메시지를 표시하고 열어 둔다.
- 삭제는 확인 다이얼로그를 거친 뒤에만 실행된다 (US-008).
- `key={ticket.id}`로 폼을 초기화해, 다른 티켓을 열면 이전 입력이 남지 않는다.

---

## 8. 공통 UI 컴포넌트 — `src/client/components/ui/`

### 8.1 Button

| Prop | 타입 | 기본값 |
|------|------|--------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'primary'` |
| `type` | `ButtonHTMLAttributes['type']` | `'button'` |
| 그 외 | `ButtonHTMLAttributes<HTMLButtonElement>` | — |

`type` 기본값이 `'button'`이므로 폼 내부에서 의도치 않은 제출이 발생하지 않는다.

### 8.2 Badge

| Prop | 타입 | 설명 |
|------|------|------|
| `priority` | `TicketPriority` | 라벨과 색상을 결정 |

LOW 회색 / MEDIUM 파랑 / HIGH 빨강, `aria-label="우선순위 {라벨}"` (US-002).

### 8.3 Modal

| Prop | 타입 | 설명 |
|------|------|------|
| `isOpen` | `boolean` | `false`면 렌더링하지 않음 |
| `title` | `string` | 헤더 제목 겸 `aria-label` |
| `onClose` | `() => void` | 닫기 |
| `children` | `ReactNode` | 본문 |

`role="dialog"` + `aria-modal="true"`. 배경 클릭으로 닫히며, 열릴 때 패널에 포커스를 준다.

**접근성 동작** (NFR-003)

| 항목 | 동작 |
|------|------|
| Escape | **최상단 모달 하나만** 닫는다. 모듈 수준 스택으로 순서를 추적하며, 스택이 없으면 중첩 모달이 한 번에 전부 닫힌다 |
| 포커스 트랩 | `Tab` / `Shift+Tab`이 모달 안에서 순환한다 |
| 포커스 복원 | 닫힐 때 열기 직전 포커스였던 요소로 되돌린다 |
| 배경 스크롤 | 열려 있는 동안 `body` 스크롤을 잠그고, **마지막** 모달이 닫힐 때 되돌린다 |

### 8.4 ConfirmDialog

| Prop | 타입 | 기본값 |
|------|------|--------|
| `isOpen` | `boolean` | — |
| `title` | `string` | — |
| `message` | `string` | — |
| `confirmLabel` | `string` | `'삭제'` |
| `onConfirm` | `() => void` | — |
| `onCancel` | `() => void` | — |

`Modal` 위에 구성한 확인 다이얼로그.

---

## 9. useTickets — `src/client/hooks/useTickets.ts`

보드 상태와 모든 변경 액션을 소유하는 단일 훅.

**시그니처**: `useTickets(initialBoard: BoardData)`

**반환값**

| 키 | 타입 | 설명 |
|----|------|------|
| `board` | `BoardData` | 현재 보드 |
| `error` | `string \| null` | 이동 실패 메시지 |
| `setError` | `(v: string \| null) => void` | 에러 배너 닫기용 |
| `refresh` | `() => Promise<void>` | 서버 상태 재동기화 |
| `createTicket` | `(input) => Promise<Ticket>` | 생성 후 BACKLOG 맨 위에 추가 |
| `updateTicket` | `(id, payload) => Promise<Ticket>` | 수정 결과를 보드에 반영 |
| `deleteTicket` | `(id) => Promise<void>` | 모든 칼럼에서 제거 |
| `moveTicket` | `(id, toStatus, targetIndex) => Promise<void>` | 드래그앤드롭 이동 |

**`moveTicket` 흐름** (FR-007, NFR-004)

```
1. 현재 board를 snapshot으로 보관
2. 낙관적 업데이트: 모든 칼럼에서 제거 → 대상 칼럼 targetIndex에 삽입
   - position = calculatePosition(대상 칼럼, targetIndex)
   - startedAt / completedAt을 서버와 동일한 규칙으로 미리 반영
3. 대상이 DONE  → completeTicket(id)
   그 외        → reorderTicket({ ticketId, status, position })
4. 성공 → refresh()로 서버 확정 상태 재동기화
   실패 → setBoard(snapshot) 롤백 + error 메시지 설정
```

`createTicket` / `updateTicket` / `deleteTicket`은 낙관적 업데이트를 하지 않고 API 성공 후 반영하며, 에러는 호출측(모달)이 잡아 표시한다.

---

## 10. 데이터 흐름 요약

```
BoardPage (서버)
  └ ticketService.getBoard() ──► initialBoard
       │
       ▼
     Board ── useTickets(initialBoard)
       │         │
       │         └─► ticketApi ──► /api/tickets/* ──► ticketService ──► DB
       │
       ├─► Column ─► TicketCard ─► onSelectTicket ─► selectedTicket
       ├─► Modal("새 티켓") ─► TicketForm ─► createTicket()
       └─► TicketModal ─► TicketForm ─► updateTicket()
                        └─► ConfirmDialog ─► deleteTicket()
```

---

## 11. 컴포넌트 작성 규칙

- 함수 컴포넌트 + 화살표 함수, 파일명 PascalCase
- Props 타입은 컴포넌트 파일 내에 정의 (공유 타입은 `@/shared/types`에서 import)
- 상호작용이 있는 컴포넌트에는 `'use client'` 지시자
- API 호출은 `src/client/api/ticketApi.ts`를 통해서만 (컴포넌트에서 직접 `fetch` 금지)
- `src/client/`에서 `src/server/` import 금지 — 공유는 `src/shared/`만
