'use client';

import { Button } from '@/client/components/ui/Button';
import { Modal } from '@/client/components/ui/Modal';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = '삭제',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal isOpen={isOpen} title={title} onClose={onCancel}>
    <p className="text-sm text-slate-700">{message}</p>
    <div className="mt-6 flex justify-end gap-2">
      <Button variant="secondary" onClick={onCancel}>
        취소
      </Button>
      <Button variant="danger" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);
