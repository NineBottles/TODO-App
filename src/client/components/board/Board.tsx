'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';
import { Column } from '@/client/components/board/Column';
import { resolveDropTarget } from '@/client/components/board/resolveDropTarget';
import { TicketCard } from '@/client/components/board/TicketCard';
import { TicketForm, type TicketFormValues } from '@/client/components/ticket/TicketForm';
import { TicketModal } from '@/client/components/ticket/TicketModal';
import { AlertDialog } from '@/client/components/ui/AlertDialog';
import { Button } from '@/client/components/ui/Button';
import { Modal } from '@/client/components/ui/Modal';
import { useTickets } from '@/client/hooks/useTickets';
import { COLUMN_ORDER, TICKET_STATUS, type TicketStatus } from '@/shared/constants';
import type { BoardData, TicketView } from '@/shared/types';

type BoardProps = {
  initialBoard: BoardData;
};

const BOARD_COLUMNS: TicketStatus[] = [
  TICKET_STATUS.TODO,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.DONE,
];

const isTicketStatus = (value: unknown): value is TicketStatus =>
  typeof value === 'string' && (COLUMN_ORDER as readonly string[]).includes(value);

export const Board = ({ initialBoard }: BoardProps) => {
  const { board, error, setError, createTicket, updateTicket, deleteTicket, moveTicket } =
    useTickets(initialBoard);
  const [activeTicket, setActiveTicket] = useState<TicketView | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketView | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /** 단계 전이 거부 알림. null이면 팝업이 닫혀 있다. (FR-007) */
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Enter는 상세 열기에 쓰므로 드래그 시작/종료 키에서 제외한다. (NFR-003)
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const findTicketById = (id: number): TicketView | undefined =>
    COLUMN_ORDER.flatMap((status) => board[status]).find((ticket) => ticket.id === id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTicket(findTicketById(Number(event.active.id)) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = Number(active.id);
    const source = findTicketById(ticketId);
    if (!source) return;

    // 드롭 대상은 칼럼(status) 또는 다른 티켓(id) 둘 중 하나다.
    const overData = over.data.current as { type?: string; status?: TicketStatus } | undefined;
    const toStatus: TicketStatus | undefined = isTicketStatus(over.id)
      ? over.id
      : overData?.status;
    if (!toStatus) return;

    const targetIndex = resolveDropTarget({
      activeId: ticketId,
      overId: over.id,
      fromStatus: source.status,
      toStatus,
      columnIds: (status) => board[status].map((ticket) => ticket.id),
    });
    if (targetIndex === null) return;

    const outcome = await moveTicket(ticketId, toStatus, targetIndex);
    // 차단된 경우 보드는 이미 변동 없이 유지된다. 알림만 띄운다. (FR-007)
    if (outcome.blocked) setBlockedMessage(outcome.message);
  };

  const handleCreate = async (values: TicketFormValues) => {
    setCreateError(null);
    try {
      await createTicket({
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        plannedStartDate: values.plannedStartDate || null,
        dueDate: values.dueDate || null,
      });
      setCreateOpen(false);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : '생성에 실패했습니다');
    }
  };

  const newTicketButton = (
    <Button className="w-full" onClick={() => setCreateOpen(true)}>
      + 새 티켓
    </Button>
  );

  return (
    <DndContext
      /**
       * 고정 id가 필수다. dnd-kit의 useUniqueId는 모듈 수준 카운터로 접근성 id를
       * 만드는데, 서버 프로세스에서는 요청마다 증가하고 클라이언트는 0부터 시작한다.
       * 그러면 카드의 aria-describedby가 서버/클라이언트에서 달라져
       * "server rendered HTML didn't match the client properties" 하이드레이션 경고가 난다.
       */
      id="tika-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTicket(null)}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="알림 닫기">
              ✕
            </button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
          {/* 좌측 Backlog 사이드바 */}
          <Column
            status={TICKET_STATUS.BACKLOG}
            tickets={board.BACKLOG}
            onSelectTicket={setSelectedTicket}
            footer={newTicketButton}
            className="max-h-[40vh] lg:max-h-none"
          />

          {/* 우측 3칼럼 보드 (swimlane) */}
          <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {BOARD_COLUMNS.map((status) => (
              <Column
                key={status}
                status={status}
                tickets={board[status]}
                onSelectTicket={setSelectedTicket}
                className="max-h-[40vh] lg:max-h-none"
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTicket && <TicketCard ticket={activeTicket} onSelect={() => {}} isOverlay />}
      </DragOverlay>

      <Modal isOpen={isCreateOpen} title="새 티켓" onClose={() => setCreateOpen(false)}>
        {createError && (
          <p role="alert" className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">
            {createError}
          </p>
        )}
        <TicketForm submitLabel="생성" onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <AlertDialog
        isOpen={blockedMessage !== null}
        title="이동할 수 없습니다"
        message={blockedMessage ?? ''}
        onClose={() => setBlockedMessage(null)}
      />

      <TicketModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={updateTicket}
        onDelete={deleteTicket}
      />
    </DndContext>
  );
};
