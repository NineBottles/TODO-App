'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * 열려 있는 모달 스택. Escape는 최상단 하나만 닫아야 한다.
 * 스택이 없으면 중첩 모달에서 Escape 한 번에 전부 닫힌다. (NFR-003)
 */
const openModals: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({ isOpen, title, onClose, children }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const modalId = useId();

  /**
   * onClose는 호출부에서 인라인 화살표로 넘어오므로 렌더마다 새 함수다.
   * 이것을 effect 의존성에 그대로 두면 모달이 열려 있는 동안 부모가 리렌더될 때마다
   * cleanup이 돌아 포커스를 previouslyFocused로 되돌리고(입력 중 포커스 탈취),
   * openModals 스택에서 빠졌다 다시 들어가 중첩 모달의 Escape 대상이 뒤바뀐다.
   * 최신 참조만 ref로 들고, effect는 열림 여부에만 반응하게 한다. (NFR-003)
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    openModals.push(modalId);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      // 최상단 모달만 반응한다.
      if (openModals[openModals.length - 1] !== modalId) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      // 포커스 트랩: 모달 밖으로 탭이 빠져나가지 않도록 순환시킨다.
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);

      const index = openModals.lastIndexOf(modalId);
      if (index !== -1) openModals.splice(index, 1);

      // 마지막 모달이 닫힐 때만 스크롤을 되돌린다.
      if (openModals.length === 0) document.body.style.overflow = previousOverflow;

      previouslyFocused?.focus?.();
    };
  }, [isOpen, modalId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
