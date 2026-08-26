import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketModal } from '@/client/components/ticket/TicketModal';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { TicketView } from '@/shared/types';

const ticket: TicketView = {
  id: 7,
  title: '기존 티켓',
  description: '설명',
  status: TICKET_STATUS.IN_PROGRESS,
  priority: TICKET_PRIORITY.LOW,
  position: 0,
  plannedStartDate: null,
  dueDate: null,
  startedAt: '2026-03-01T00:00:00.000Z',
  completedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  isOverdue: false,
};

describe('TicketModal (US-007, US-008)', () => {
  it('티켓 정보를 폼에 채워 보여준다', () => {
    render(
      <TicketModal
        ticket={ticket}
        onClose={jest.fn()}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: '티켓 상세' })).toBeInTheDocument();
    expect(screen.getByLabelText(/제목/)).toHaveValue('기존 티켓');
  });

  it('저장하면 onUpdate가 호출되고 모달이 닫힌다', async () => {
    const onUpdate = jest.fn().mockResolvedValue(ticket);
    const onClose = jest.fn();
    render(
      <TicketModal ticket={ticket} onClose={onClose} onUpdate={onUpdate} onDelete={jest.fn()} />,
    );

    await userEvent.clear(screen.getByLabelText(/제목/));
    await userEvent.type(screen.getByLabelText(/제목/), '수정된 제목');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ title: '수정된 제목' })),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('삭제 버튼은 확인 다이얼로그를 거친 뒤에만 삭제한다', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(
      <TicketModal ticket={ticket} onClose={jest.fn()} onUpdate={jest.fn()} onDelete={onDelete} />,
    );

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(await screen.findByRole('dialog', { name: '티켓 삭제' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: '티켓 삭제' });
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(7));
  });

  it('ticket이 null이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <TicketModal ticket={null} onClose={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
