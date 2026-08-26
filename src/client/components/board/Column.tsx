'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { TicketCard } from '@/client/components/board/TicketCard';
import { COLUMN_LABEL, type TicketStatus } from '@/shared/constants';
import type { TicketView } from '@/shared/types';

type ColumnProps = {
  status: TicketStatus;
  tickets: TicketView[];
  onSelectTicket: (ticket: TicketView) => void;
  /** 칼럼 하단에 배치할 추가 요소 (예: 새 티켓 버튼) */
  footer?: ReactNode;
  className?: string;
};

export const Column = ({
  status,
  tickets,
  onSelectTicket,
  footer,
  className = '',
}: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column', status } });

  return (
    <section
      aria-label={`${COLUMN_LABEL[status]} 칼럼`}
      className={`flex min-h-0 flex-col rounded-lg bg-slate-100 ${className}`}
    >
      <header className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          {COLUMN_LABEL[status]}
        </h2>
        <span
          className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600"
          aria-label={`${COLUMN_LABEL[status]} 카드 수 ${tickets.length}`}
        >
          {tickets.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        role="list"
        className={`flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 transition-colors ${
          isOver ? 'bg-blue-50' : ''
        }`}
      >
        <SortableContext
          items={tickets.map((ticket) => ticket.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <div role="listitem" key={ticket.id}>
              <TicketCard ticket={ticket} onSelect={onSelectTicket} />
            </div>
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">티켓이 없습니다</p>
        )}
      </div>

      {footer && <div className="border-t border-slate-200 p-3">{footer}</div>}
    </section>
  );
};
