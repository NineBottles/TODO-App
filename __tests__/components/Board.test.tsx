import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from '@/client/components/board/Board';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/shared/constants';
import type { BoardData, TicketView } from '@/shared/types';

jest.mock('@/client/api/ticketApi', () => ({
  fetchBoard: jest.fn(),
  createTicket: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
  completeTicket: jest.fn(),
  reorderTicket: jest.fn(),
}));

import * as ticketApi from '@/client/api/ticketApi';

const api = ticketApi as jest.Mocked<typeof ticketApi>;

const makeTicket = (id: number, title: string, status: TicketView['status']): TicketView => ({
  id,
  title,
  description: null,
  status,
  priority: TICKET_PRIORITY.MEDIUM,
  position: 0,
  plannedStartDate: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  isOverdue: false,
});

const board: BoardData = {
  BACKLOG: [makeTicket(1, '백로그 티켓', TICKET_STATUS.BACKLOG)],
  TODO: [makeTicket(2, '할 일 티켓', TICKET_STATUS.TODO)],
  IN_PROGRESS: [],
  DONE: [],
};

describe('Board (US-003, US-001, US-007)', () => {
  it('4개 칼럼을 모두 렌더링한다', () => {
    render(<Board initialBoard={board} />);

    for (const label of ['Backlog', 'TODO', 'In-Progress', 'Done']) {
      expect(screen.getByLabelText(`${label} 칼럼`)).toBeInTheDocument();
    }
  });

  it('칼럼별로 티켓을 배치한다', () => {
    render(<Board initialBoard={board} />);

    expect(
      within(screen.getByLabelText('Backlog 칼럼')).getByText('백로그 티켓'),
    ).toBeInTheDocument();
    expect(within(screen.getByLabelText('TODO 칼럼')).getByText('할 일 티켓')).toBeInTheDocument();
  });

  it('"새 티켓" 버튼을 누르면 생성 폼이 열리고, 생성 후 닫힌다 (US-001)', async () => {
    api.createTicket.mockResolvedValue(makeTicket(3, '새로 만든 티켓', TICKET_STATUS.BACKLOG));
    render(<Board initialBoard={board} />);

    await userEvent.click(screen.getByRole('button', { name: '+ 새 티켓' }));
    expect(await screen.findByRole('dialog', { name: '새 티켓' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/제목/), '새로 만든 티켓');
    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '새 티켓' })).not.toBeInTheDocument(),
    );
    expect(api.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ title: '새로 만든 티켓' }),
    );
  });

  it('dnd-kit이 만드는 aria-describedby가 렌더마다 동일하다 (SSR 하이드레이션)', () => {
    // dnd-kit의 useUniqueId는 모듈 수준 카운터를 쓴다. DndContext에 고정 id를 주지 않으면
    // 서버 렌더와 클라이언트 렌더의 값이 달라져 하이드레이션 불일치가 발생한다.
    const { unmount } = render(<Board initialBoard={board} />);
    const first = screen.getByLabelText('티켓 백로그 티켓').getAttribute('aria-describedby');
    unmount();

    render(<Board initialBoard={board} />);
    const second = screen.getByLabelText('티켓 백로그 티켓').getAttribute('aria-describedby');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('카드를 클릭하면 상세 모달이 열린다 (US-007)', async () => {
    render(<Board initialBoard={board} />);

    await userEvent.click(screen.getByText('할 일 티켓'));

    expect(await screen.findByRole('dialog', { name: '티켓 상세' })).toBeInTheDocument();
  });
});
