/**
 * 키보드 조작 분리 검증 (NFR-003)
 *
 * Space = 드래그(@dnd-kit KeyboardSensor), Enter = 상세 열기.
 * 카드가 자체 onKeyDown으로 sortable의 리스너를 덮어쓰면 키보드 드래그가 죽는다.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCard } from '@/client/components/board/TicketCard';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { TicketView } from '@/shared/types';

const sortableKeyDown = jest.fn();

jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'),
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: { onKeyDown: sortableKeyDown, onPointerDown: jest.fn() },
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

const ticket: TicketView = {
  id: 1,
  title: '키보드 티켓',
  description: null,
  status: TICKET_STATUS.TODO,
  priority: TICKET_PRIORITY.MEDIUM,
  position: 0,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  isOverdue: false,
};

const renderCard = () => {
  const onSelect = jest.fn();
  render(<TicketCard ticket={ticket} onSelect={onSelect} />);
  return onSelect;
};

describe('TicketCard 키보드 조작 (NFR-003)', () => {
  it('sortable의 onKeyDown 리스너를 덮어쓰지 않고 그대로 호출한다', async () => {
    renderCard();

    screen.getByLabelText('티켓 키보드 티켓').focus();
    await userEvent.keyboard('{ }');

    expect(sortableKeyDown).toHaveBeenCalled();
  });

  it('Space는 드래그용이므로 상세를 열지 않는다', async () => {
    const onSelect = renderCard();

    screen.getByLabelText('티켓 키보드 티켓').focus();
    await userEvent.keyboard('{ }');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Enter는 상세를 연다', async () => {
    const onSelect = renderCard();

    screen.getByLabelText('티켓 키보드 티켓').focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('sortable이 이벤트를 소비하면(드래그 시작) 상세를 열지 않는다', async () => {
    sortableKeyDown.mockImplementation((event: KeyboardEvent) => event.preventDefault());
    const onSelect = renderCard();

    screen.getByLabelText('티켓 키보드 티켓').focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });
});
