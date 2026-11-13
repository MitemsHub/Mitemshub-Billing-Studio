import { AlertTriangle, CheckCircle2, Clock, FileEdit } from 'lucide-react';
import type { InvoiceStatus } from '../types/billing';

interface StatusLabelProps {
  status: InvoiceStatus;
  extraText?: string;
}

const STATUS_META: Record<
  InvoiceStatus,
  { label: string; colorClass: string; Icon: typeof CheckCircle2 }
> = {
  paid: {
    label: 'Paid',
    colorClass: 'text-[#15803D]',
    Icon: CheckCircle2,
  },
  sent: {
    label: 'Sent',
    colorClass: 'text-[#1D4ED8]',
    Icon: Clock,
  },
  overdue: {
    label: 'Overdue',
    colorClass: 'text-[#B91C1C]',
    Icon: AlertTriangle,
  },
  draft: {
    label: 'Draft',
    colorClass: 'text-[#5A6065]',
    Icon: FileEdit,
  },
};

export function StatusLabel({ status, extraText }: StatusLabelProps) {
  const { label, colorClass, Icon } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      {extraText && (
        <>
          <span aria-hidden="true" className="text-[#9CA3AF]">
            ·
          </span>
          <span className="font-normal text-[#5A6065]">{extraText}</span>
        </>
      )}
    </span>
  );
}
