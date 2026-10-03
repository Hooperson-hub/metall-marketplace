import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase, type OrderWithCount } from '@/lib/supabase';
import { ProcessBadges, MaterialBadge, OrderStatusBadge, formatDate } from '@/components/Badges';
import { FileText, Inbox, Search, ArrowRight } from 'lucide-react';

export function FactoryDashboard() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const [orders, setOrders] = useState<OrderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProcess, setFilterProcess] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(full_name, company_name),
          proposal_count:proposals(count)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      const rows = (data || []).map((r: Record<string, unknown>) => ({
        ...r,
        proposal_count: (r.proposal_count as [{ count: number }])?.[0]?.count ?? 0,
      })) as OrderWithCount[];
      setOrders(rows);
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter((o) => {
    const matchSearch = o.title.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer?.company_name || '').toLowerCase().includes(search.toLowerCase());
    const matchProcess = filterProcess === 'all' || orderProcesses(o).includes(filterProcess as ProcessType);
    return matchSearch && matchProcess;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Лента заказов</h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile?.company_name} — исполнитель
          </p>
        </div>
        <button
          onClick={() => navigate('/factory/proposals')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <FileText className="h-4 w-4" />
          Мои предложения
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию или компании…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={filterProcess}
          onChange={(e) => setFilterProcess(e.target.value)}
          className="input sm:w-52"
        >
          <option value="all">Все виды обработки</option>
          <option value="cutting">Лазерная резка</option>
          <option value="welding">Сварка</option>
          <option value="bending">Гибка</option>
          <option value="painting">Порошковая покраска</option>
        </select>
      </div>

      {/* Orders */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Inbox className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Заказов не найдено</h3>
            <p className="mt-1 text-sm text-slate-500">Попробуйте изменить параметры поиска</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900">{order.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{order.customer?.company_name || order.customer?.full_name}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProcessBadges order={order} />
                  <MaterialBadge material={order.material} />
                  <span className="text-sm text-slate-500">{order.quantity} шт.</span>
                  <span className="text-sm text-slate-400">·</span>
                  <span className="text-sm text-slate-500">{formatDate(order.created_at)}</span>
                </div>
                {order.drawing_name && (
                  <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{order.drawing_name}</span>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{order.proposal_count} КП подано</span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 transition group-hover:gap-2">
                    Открыть <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
