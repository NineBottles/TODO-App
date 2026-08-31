'use client';

import { Button } from '@/client/components/ui/Button';
import { Modal } from '@/client/components/ui/Modal';

type AlertDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
};

/**
 * 알림 전용 다이얼로그. 선택지 없이 확인 버튼 하나만 둔다.
 * ConfirmDialog와 달리 결정을 묻지 않고, 이미 거부된 동작을 알리기만 한다. (FR-007)
 */
export const AlertDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = '확인',
  onClose,
}: AlertDialogProps) => (
  <Modal isOpen={isOpen} title={title} onClose={onClose}>
    <p className="text-sm text-slate-700">{message}</p>
    <div className="mt-6 flex justify-end">
      <Button onClick={onClose} autoFocus>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);
