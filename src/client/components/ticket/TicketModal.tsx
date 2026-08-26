'use client';

import { useState } from 'react';
import { TicketForm, type TicketFormValues } from '@/client/components/ticket/TicketForm';
import { Button } from '@/client/components/ui/Button';
import { ConfirmDialog } from '@/client/components/ui/ConfirmDialog';
import { Modal } from '@/client/components/ui/Modal';
import { COLUMN_LABEL } from '@/shared/constants';
import type { TicketView } from '@/shared/types';
import type { UpdateTicketPayload } from '@/shared/validations/ticket';

type TicketModalProps = {
  ticket: TicketView | null;
  onClose: () => void;
  onUpdate: (id: number, payload: UpdateTicketPayload) => Promise<unknown>;
  onDelete: (id: number) => Promise<void>;
};

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('ko-KR') : '—';

/** 티켓 상세/수정 모달 (FR-003, FR-004, FR-006) */
export const TicketModal = ({ ticket, onClose, onUpdate, onDelete }: TicketModalProps) => {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!ticket) return null;

  const handleSubmit = async (values: TicketFormValues) => {
    setErrorMessage(null);
    try {
      await onUpdate(ticket.id, {
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        plannedStartDate: values.plannedStartDate || null,
        dueDate: values.dueDate || null,
      });
      onClose();
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : '수정에 실패했습니다');
    }
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    try {
      await onDelete(ticket.id);
      onClose();
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : '삭제에 실패했습니다');
    }
  };

  return (
    <>
      <Modal isOpen title="티켓 상세" onClose={onClose}>
        <dl className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <div>
            <dt className="font-semibold text-slate-500">상태</dt>
            <dd>{COLUMN_LABEL[ticket.status]}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">기한 초과</dt>
            <dd>{ticket.isOverdue ? '초과' : '정상'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">실제 시작일</dt>
            <dd>{formatDateTime(ticket.startedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">실제 종료일</dt>
            <dd>{formatDateTime(ticket.completedAt)}</dd>
          </div>
        </dl>

        {errorMessage && (
          <p role="alert" className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">
            {errorMessage}
          </p>
        )}

        <TicketForm
          key={ticket.id}
          initialValues={{
            title: ticket.title,
            description: ticket.description ?? '',
            priority: ticket.priority,
            plannedStartDate: ticket.plannedStartDate ?? '',
            dueDate: ticket.dueDate ?? '',
          }}
          submitLabel="저장"
          onSubmit={handleSubmit}
          onCancel={onClose}
        />

        <div className="mt-4 border-t border-slate-200 pt-4">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            삭제
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="티켓 삭제"
        message={`"${ticket.title}" 티켓을 영구 삭제합니다. 계속할까요?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
