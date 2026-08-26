'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/client/components/ui/Button';
import { TICKET_PRIORITY, PRIORITY_LABEL, type TicketPriority } from '@/shared/constants';
import { createTicketSchema, ticketFormSchema, todayString } from '@/shared/validations/ticket';

export type TicketFormValues = {
  title: string;
  description: string;
  priority: TicketPriority;
  plannedStartDate: string;
  dueDate: string;
};

type TicketFormProps = {
  initialValues?: Partial<TicketFormValues>;
  submitLabel: string;
  onSubmit: (values: TicketFormValues) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_VALUES: TicketFormValues = {
  title: '',
  description: '',
  priority: TICKET_PRIORITY.MEDIUM,
  plannedStartDate: '',
  dueDate: '',
};

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none';

export const TicketForm = ({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: TicketFormProps) => {
  const [values, setValues] = useState<TicketFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [errors, setErrors] = useState<Partial<Record<keyof TicketFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof TicketFormValues>(key: K, value: TicketFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // 종료예정일을 새로 고른 경우에만 "오늘 이후" 제약을 적용한다.
    // 기존 값을 그대로 두면 과거 날짜여도 통과시켜야 오버듀 티켓을 수정할 수 있다. (FR-004)
    const isDueDateUntouched = values.dueDate === (initialValues?.dueDate ?? '');
    const schema = isDueDateUntouched ? ticketFormSchema : createTicketSchema;

    // 백엔드와 동일한 Zod 스키마로 클라이언트 검증 (NFR-004)
    const parsed = schema.safeParse({
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      plannedStartDate: values.plannedStartDate || null,
      dueDate: values.dueDate || null,
    });

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof TicketFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof TicketFormValues | undefined;
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="ticket-title" className="mb-1 block text-sm font-medium text-slate-700">
          제목 <span className="text-red-600">*</span>
        </label>
        <input
          id="ticket-title"
          value={values.title}
          onChange={(event) => setField('title', event.target.value)}
          maxLength={200}
          aria-invalid={Boolean(errors.title)}
          className={FIELD_CLASS}
        />
        {errors.title && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="ticket-description"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          설명
        </label>
        <textarea
          id="ticket-description"
          rows={4}
          value={values.description}
          onChange={(event) => setField('description', event.target.value)}
          className={FIELD_CLASS}
        />
        {errors.description && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="ticket-priority" className="mb-1 block text-sm font-medium text-slate-700">
          우선순위
        </label>
        <select
          id="ticket-priority"
          value={values.priority}
          onChange={(event) => setField('priority', event.target.value as TicketPriority)}
          className={FIELD_CLASS}
        >
          {Object.values(TICKET_PRIORITY).map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="ticket-planned-start"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            시작예정일
          </label>
          <input
            id="ticket-planned-start"
            type="date"
            value={values.plannedStartDate}
            onChange={(event) => setField('plannedStartDate', event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="ticket-due" className="mb-1 block text-sm font-medium text-slate-700">
            종료예정일
          </label>
          <input
            id="ticket-due"
            type="date"
            min={initialValues?.dueDate && initialValues.dueDate < todayString() ? initialValues.dueDate : todayString()}
            value={values.dueDate}
            onChange={(event) => setField('dueDate', event.target.value)}
            aria-invalid={Boolean(errors.dueDate)}
            className={FIELD_CLASS}
          />
          {errors.dueDate && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.dueDate}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? '저장 중…' : submitLabel}
        </Button>
      </div>
    </form>
  );
};
