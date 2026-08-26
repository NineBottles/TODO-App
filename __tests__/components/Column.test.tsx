import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import { Column } from '@/client/components/board/Column';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { TicketView } from '@/shared/types';

const makeTicket = (id: number, title: string): TicketView => ({
  id,
  title,
  description: null,
  status: TICKET_STATUS.TODO,
  priority: TICKET_PRIORITY.MEDIUM,
  position: id * 1024,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  isOverdue: false,
});

const renderColumn = (tickets: TicketView[]) =>
  render(
    <DndContext>
      <Column status={TICKET_STATUS.TODO} tickets={tickets} onSelectTicket={jest.fn()} />
    </DndContext>,
  );

describe('Column (US-003)', () => {
  it('칼럼 이름과 카드 수를 표시한다', () => {
    renderColumn([makeTicket(1, 'A'), makeTicket(2, 'B')]);

    expect(screen.getByRole('heading', { name: 'TODO' })).toBeInTheDocument();
    expect(screen.getByLabelText('TODO 카드 수 2')).toHaveTextContent('2');
  });

  it('전달받은 순서대로 카드를 렌더링한다', () => {
    renderColumn([makeTicket(1, 'A'), makeTicket(2, 'B')]);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('A');
    expect(items[1]).toHaveTextContent('B');
  });

  it('티켓이 없으면 빈 상태 문구를 보여준다', () => {
    renderColumn([]);

    expect(screen.getByText('티켓이 없습니다')).toBeInTheDocument();
    expect(screen.getByLabelText('TODO 카드 수 0')).toBeInTheDocument();
  });
});
