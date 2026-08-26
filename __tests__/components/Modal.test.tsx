/** 모달 접근성 · 중첩 동작 (NFR-003) */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Modal } from '@/client/components/ui/Modal';
import { ConfirmDialog } from '@/client/components/ui/ConfirmDialog';

describe('Modal 단독 (NFR-003)', () => {
  it('Escape로 닫힌다', async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen title="바깥 모달" onClose={onClose}>
        <button type="button">안쪽 버튼</button>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('열리는 동안 배경 스크롤을 잠그고 닫히면 되돌린다', () => {
    const { rerender } = render(
      <Modal isOpen title="모달" onClose={jest.fn()}>
        <p>내용</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} title="모달" onClose={jest.fn()}>
        <p>내용</p>
      </Modal>,
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('닫힐 때 이전 포커스를 복원한다', async () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            열기
          </button>
          <Modal isOpen={open} title="모달" onClose={() => setOpen(false)}>
            <p>내용</p>
          </Modal>
        </>
      );
    };
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '열기' });

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');

    expect(opener).toHaveFocus();
  });

  it('Tab이 모달 안에서 순환한다 (포커스 트랩)', async () => {
    render(
      <Modal isOpen title="모달" onClose={jest.fn()}>
        <button type="button">첫 번째</button>
        <button type="button">마지막</button>
      </Modal>,
    );

    const last = screen.getByRole('button', { name: '마지막' });
    last.focus();
    await userEvent.tab();

    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
  });
});

describe('중첩 모달 (NFR-003)', () => {
  it('Escape는 최상단 모달 하나만 닫는다', async () => {
    const onOuterClose = jest.fn();
    const onInnerCancel = jest.fn();

    render(
      <>
        <Modal isOpen title="바깥 모달" onClose={onOuterClose}>
          <p>내용</p>
        </Modal>
        <ConfirmDialog
          isOpen
          title="확인 다이얼로그"
          message="정말 삭제할까요?"
          onConfirm={jest.fn()}
          onCancel={onInnerCancel}
        />
      </>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onInnerCancel).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });
});
