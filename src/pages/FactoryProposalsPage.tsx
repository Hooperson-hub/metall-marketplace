import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { ProcessBadge, MaterialBadge, ProposalStatusBadge, formatDate } from '@/components/Badges';
import { FileText, ArrowRight } from 'lucide-react';

interface ProposalWithOrder {
  id: string;
  price: number;
  lead_time_days: number;
  comment: string | null;
  status: string;
  created_at: string;
  order: {
    id: string;
    title: string;
    process_type: string;
    material: string;
    quantity: number;
  } | null;
}

export function FactoryProposalsPage() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const [proposals, setProposals] = useState<ProposalWithOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('proposals')
        .select(`
          id, price, lead_time_days, comment, status, created_at,
          order:orders(id, title, process_type, material, quantity)
        `)
        .eq('factory_id', profile.id)
        .order('created_at', { ascending: false });
      setProposals((data || []) as unknown as ProposalWithOrder[]);
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Мои коммерческие предложения</h1>
      <p className="mt-1 text-sm text-slate-500">История ваших откликов на заказы</p>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Вы ещё не подали ни одного КП</h3>
            <p className="mt-1 text-sm text-slate-500">Откройте ленту заказов и отправьте предложение</p>
            <button
              onClick={() => navigate('/factory')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              К ленте заказов
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <button
                key={p.id}
                onClick={() => p.order && navigate(`/orders/${p.order.id}`)}
                className="block w-full rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{p.order?.title || '—'}</h3>
                      <ProposalStatusBadge status={p.status as 'submitted' | 'accepted' | 'rejected'} />
                    </div>
                    {p.order && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ProcessBadge type={p.order.process_type as 'cutting' | 'welding' | 'bending' | 'painting'} />
                        <MaterialBadge material={p.order.material as 'steel' | 'aluminum' | 'copper'} />
                        <span className="text-sm text-slate-500">{p.order.quantity} шт.</span>
                      </div>
                    )}
                    {p.comment && (
                      <p className="mt-2 text-sm text-slate-500 line-clamp-2">{p.comment}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
                    <p className="text-sm text-slate-500">{p.lead_time_days} дн.</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                      Открыть <ArrowRight className="h-4 w-4" />
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
