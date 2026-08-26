import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { TicketCard } from '@/client/components/board/TicketCard';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { TicketView } from '@/shared/types';

const ticket: TicketView = {
  id: 1,
  title: 'PRD 검토',
  description: null,
  status: TICKET_STATUS.TODO,
  priority: TICKET_PRIORITY.HIGH,
  position: 0,
  plannedStartDate: '2026-03-01',
  dueDate: '2026-03-10',
  startedAt: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  isOverdue: false,
};

/** Board와 동일한 활성화 제약을 걸어야 단순 클릭이 드래그로 오인되지 않는다. */
const DndHarness = ({ children }: { children: React.ReactNode }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  return <DndContext sensors={sensors}>{children}</DndContext>;
};

const renderCard = (override: Partial<TicketView> = {}, onSelect = jest.fn()) => {
  const value = { ...ticket, ...override };
  render(
    <DndHarness>
      <SortableContext items={[value.id]}>
        <TicketCard ticket={value} onSelect={onSelect} />
      </SortableContext>
    </DndHarness>,
  );
  return onSelect;
};

describe('TicketCard (US-002, US-004, US-007)', () => {
  it('제목과 계획 일정을 표시한다', () => {
    renderCard();

    expect(screen.getByText('PRD 검토')).toBeInTheDocument();
    expect(screen.getByLabelText('계획 일정')).toHaveTextContent('03/01 ~ 03/10');
  });

  it('우선순위 뱃지를 표시한다', () => {
    renderCard();

    expect(screen.getByLabelText('우선순위 높음')).toBeInTheDocument();
  });

  it('오버듀면 경고 표시가 나타난다 (FR-008)', () => {
    renderCard({ isOverdue: true });

    expect(screen.getByLabelText('기한 초과 경고')).toBeInTheDocument();
  });

  it('오버듀가 아니면 경고 표시가 없다', () => {
    renderCard();

    expect(screen.queryByLabelText('기한 초과 경고')).not.toBeInTheDocument();
  });

  it('클릭하면 onSelect가 호출된다', async () => {
    const onSelect = renderCard();

    await userEvent.click(screen.getByText('PRD 검토'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
