'use client';

import { useSortable } from '@dnd-kit/sortable';
import type { KeyboardEvent } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/client/components/ui/Badge';
import type { TicketView } from '@/shared/types';

type TicketCardProps = {
  ticket: TicketView;
  onSelect: (ticket: TicketView) => void;
  /** 드래그 오버레이용 정적 렌더링 */
  isOverlay?: boolean;
};

const formatDate = (value: string | null) => (value ? value.slice(5).replace('-', '/') : '—');

export const TicketCard = ({ ticket, onSelect, isOverlay = false }: TicketCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { type: 'ticket', status: ticket.status },
    disabled: isOverlay,
  });

  /**
   * sortable의 onKeyDown을 먼저 호출한다. 여기서 덮어쓰면 KeyboardSensor가
   * 활성화될 수 없어 키보드 드래그가 통째로 죽는다. (NFR-003)
   * 드래그가 이벤트를 소비했으면(preventDefault) 상세 열기는 건너뛴다.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    listeners?.onKeyDown?.(event);
    if (event.defaultPrevented) return;

    // Space는 드래그 전용이므로 상세를 열지 않는다.
    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(ticket);
    }
  };

  return (
    <article
      ref={isOverlay ? undefined : setNodeRef}
      style={
        isOverlay ? undefined : { transform: CSS.Translate.toString(transform), transition }
      }
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={() => onSelect(ticket)}
      onKeyDown={handleKeyDown}
      aria-label={`티켓 ${ticket.title}`}
      className={`cursor-grab rounded-md border bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
        ticket.isOverdue ? 'border-red-400 bg-red-50' : 'border-slate-200'
      } ${isDragging && !isOverlay ? 'opacity-40' : ''} ${isOverlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900">{ticket.title}</h3>
        <Badge priority={ticket.priority} />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        <span aria-label="계획 일정">
          {formatDate(ticket.plannedStartDate)} ~ {formatDate(ticket.dueDate)}
        </span>
      </p>

      {ticket.isOverdue && (
        <p className="mt-1 text-xs font-semibold text-red-600" aria-label="기한 초과 경고">
          ⚠ 기한 초과
        </p>
      )}
    </article>
  );
};
