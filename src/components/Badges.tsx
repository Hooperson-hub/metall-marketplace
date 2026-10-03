import type { ProcessType, Material, OrderStatus, ProposalStatus } from '@/lib/supabase';
import { PROCESS_LABELS, MATERIAL_LABELS, orderProcesses } from '@/lib/supabase';
import {
  Scissors,
  Flame,
  Minimize2,
  Paintbrush,
  Wrench,
  Cog,
  type LucideIcon,
} from 'lucide-react';

export const PROCESS_ICONS: Record<ProcessType, LucideIcon> = {
  cutting: Scissors,
  welding: Flame,
  bending: Minimize2,
  painting: Paintbrush,
  installation: Wrench,
  machining: Cog,
};

export function ProcessBadge({ type }: { type: ProcessType }) {
  const Icon = PROCESS_ICONS[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      <Icon className="h-3.5 w-3.5" />
      {PROCESS_LABELS[type]}
    </span>
  );
}

export function ProcessBadges({ order }: { order: { process_type: ProcessType; process_types?: ProcessType[] | null } }) {
  return (
    <>
      {orderProcesses(order).map((t) => (
        <ProcessBadge key={t} type={t} />
      ))}
    </>
  );
}

export function MaterialBadge({ material }: { material: Material }) {
  const colors: Record<Material, string> = {
    steel: 'bg-zinc-100 text-zinc-700',
    aluminum: 'bg-sky-100 text-sky-700',
    copper: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${colors[material]}`}>
      {MATERIAL_LABELS[material]}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-blue-100 text-blue-700',
    closed: 'bg-slate-200 text-slate-600',
  };
  const labels: Record<OrderStatus, string> = {
    open: 'Приём предложений',
    in_progress: 'Исполнитель выбран',
    completed: 'Выполнен',
    closed: 'Закрыт',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const styles: Record<ProposalStatus, string> = {
    submitted: 'bg-blue-100 text-blue-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };
  const labels: Record<ProposalStatus, string> = {
    submitted: 'Подано',
    accepted: 'Принято',
    rejected: 'Отклонено',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
