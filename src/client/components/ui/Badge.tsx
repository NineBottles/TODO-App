'use client';

import { PRIORITY_LABEL, type TicketPriority } from '@/shared/constants';

type BadgeProps = {
  priority: TicketPriority;
};

/** 우선순위 뱃지 — LOW: 회색, MEDIUM: 파랑, HIGH: 빨강 (US-002) */
const PRIORITY_CLASS: Record<TicketPriority, string> = {
  LOW: 'bg-slate-200 text-slate-700',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-red-100 text-red-800',
};

export const Badge = ({ priority }: BadgeProps) => (
  <span
    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${PRIORITY_CLASS[priority]}`}
    aria-label={`우선순위 ${PRIORITY_LABEL[priority]}`}
  >
    {PRIORITY_LABEL[priority]}
  </span>
);
