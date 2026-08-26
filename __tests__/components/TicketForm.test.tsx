import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketForm } from '@/client/components/ticket/TicketForm';

describe('TicketForm (US-001, US-002)', () => {
  it('제목만 입력해도 제출되고 우선순위 기본값은 보통(MEDIUM)이다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TicketForm submitLabel="생성" onSubmit={onSubmit} onCancel={jest.fn()} />);

    await userEvent.type(screen.getByLabelText(/제목/), '새 할 일');
    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: '새 할 일', priority: 'MEDIUM' }),
      ),
    );
  });

  it('제목이 비어 있으면 에러 메시지를 보여주고 제출하지 않는다', async () => {
    const onSubmit = jest.fn();
    render(<TicketForm submitLabel="생성" onSubmit={onSubmit} onCancel={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('제목을 입력해주세요');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('과거 종료예정일이면 에러 메시지를 보여준다', async () => {
    const onSubmit = jest.fn();
    render(<TicketForm submitLabel="생성" onSubmit={onSubmit} onCancel={jest.fn()} />);

    await userEvent.type(screen.getByLabelText(/제목/), '할 일');
    await userEvent.type(screen.getByLabelText('종료예정일'), '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '종료예정일은 오늘 이후 날짜를 선택해주세요',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('initialValues를 폼에 채워 넣는다 (US-007)', () => {
    render(
      <TicketForm
        initialValues={{ title: '기존 티켓', description: '설명', priority: 'HIGH' }}
        submitLabel="저장"
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/제목/)).toHaveValue('기존 티켓');
    expect(screen.getByLabelText('설명')).toHaveValue('설명');
    expect(screen.getByLabelText('우선순위')).toHaveValue('HIGH');
  });

  it('TC-COMP-004f: 종료예정일이 과거인 티켓도 다른 필드를 수정할 수 있다 (US-004, US-007)', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <TicketForm
        initialValues={{ title: '오버듀 티켓', dueDate: '2020-01-01' }}
        submitLabel="저장"
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/제목/));
    await userEvent.type(screen.getByLabelText(/제목/), '제목만 수정');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: '제목만 수정', dueDate: '2020-01-01' }),
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('TC-COMP-004g: 종료예정일을 과거로 새로 선택하면 거부한다', async () => {
    const onSubmit = jest.fn();
    render(
      <TicketForm
        initialValues={{ title: '기존 티켓', dueDate: '2030-01-01' }}
        submitLabel="저장"
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );

    await userEvent.clear(screen.getByLabelText('종료예정일'));
    await userEvent.type(screen.getByLabelText('종료예정일'), '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '종료예정일은 오늘 이후 날짜를 선택해주세요',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('취소를 누르면 onCancel이 호출된다', async () => {
    const onCancel = jest.fn();
    render(<TicketForm submitLabel="생성" onSubmit={jest.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
