import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase, type OrderWithCount } from '@/lib/supabase';
import { ProcessBadge, MaterialBadge, OrderStatusBadge, formatDate } from '@/components/Badges';
import { Plus, Package, FileText, Inbox } from 'lucide-react';

export function CustomerDashboard() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const [orders, setOrders] = useState<OrderWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(full_name, company_name),
          proposal_count:proposals(count)
        `)
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });
      const rows = (data || []).map((r: Record<string, unknown>) => ({
        ...r,
        proposal_count: (r.proposal_count as [{ count: number }])?.[0]?.count ?? 0,
      })) as OrderWithCount[];
      setOrders(rows);
      setLoading(false);
    })();
  }, [profile]);

  const openCount = orders.filter((o) => o.status === 'open' || o.status === 'in_progress').length;
  const totalProposals = orders.reduce((sum, o) => sum + o.proposal_count, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои заказы</h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile?.company_name} — заказчик
          </p>
        </div>
        <button
          onClick={() => navigate('/orders/new')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Создать заказ
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Package className="h-5 w-5" />} value={orders.length} label="Всего заказов" />
        <StatCard icon={<Inbox className="h-5 w-5" />} value={openCount} label="Активных" />
        <StatCard icon={<FileText className="h-5 w-5" />} value={totalProposals} label="Получено КП" />
      </div>

      {/* Orders list */}
      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState onCreate={() => navigate('/orders/new')} />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="block w-full rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{order.title}</h3>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ProcessBadge type={order.process_type} />
                      <MaterialBadge material={order.material} />
                      <span className="text-sm text-slate-500">{order.quantity} шт.</span>
                      <span className="text-sm text-slate-400">·</span>
                      <span className="text-sm text-slate-500">{formatDate(order.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
                      <FileText className="h-4 w-4" />
                      {order.proposal_count} КП
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <Package className="mx-auto h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Заказов пока нет</h3>
      <p className="mt-1 text-sm text-slate-500">Создайте первый заказ, чтобы получить предложения от заводов</p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" />
        Создать заказ
      </button>
    </div>
  );
}
