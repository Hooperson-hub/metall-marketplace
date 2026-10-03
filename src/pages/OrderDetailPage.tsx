import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute, navigateTo } from '@/lib/router';
import { supabase, type Order, type ProposalWithFactory } from '@/lib/supabase';
import { calcResponseFee, formatRub, isInsufficientFunds, notifyWalletChanged, useTariffs, useWallet } from '@/lib/wallet';
import { ProcessBadges, MaterialBadge, OrderStatusBadge, ProposalStatusBadge, formatDate } from '@/components/Badges';
import { FileText, ArrowLeft, Download, Check, X, Send, Clock, User, MessageCircle } from 'lucide-react';
import { ChatPanel } from '@/components/ChatPanel';

export function OrderDetailPage({ orderId, initialChatFactoryId }: { orderId: string; initialChatFactoryId?: string }) {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<{ full_name: string; company_name: string } | null>(null);
  const [proposals, setProposals] = useState<ProposalWithFactory[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProposal, setMyProposal] = useState<ProposalWithFactory | null>(null);
  const [unreadByFactory, setUnreadByFactory] = useState<Record<string, number>>({});

  // proposal form
  const [price, setPrice] = useState('');
  const tariffs = useTariffs();
  const wallet = useWallet();
  const responseFee = calcResponseFee(parseFloat(price), tariffs);
  const notEnoughForResponse = responseFee > 0 && wallet.balance !== null && wallet.balance < responseFee;
  const [leadTime, setLeadTime] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChatFactoryId, setActiveChatFactoryId] = useState<string | null>(initialChatFactoryId || null);

  const isCustomer = profile?.role === 'customer';
  const isFactory = profile?.role === 'factory';

  useEffect(() => {
    (async () => {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (!orderData) {
        setLoading(false);
        return;
      }
      setOrder(orderData as Order);

      const { data: custData } = await supabase
        .from('profiles')
        .select('full_name, company_name')
        .eq('id', (orderData as Order).customer_id)
        .maybeSingle();
      setCustomer(custData as { full_name: string; company_name: string } | null);

      const { data: propData } = await supabase
        .from('proposals')
        .select(`
          *,
          factory:profiles!proposals_factory_id_fkey(full_name, company_name)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      const props = (propData || []) as ProposalWithFactory[];
      setProposals(props);
      if (isFactory && profile) {
        setMyProposal(props.find((p) => p.factory_id === profile.id) || null);
      }

      if (profile?.role === 'customer') {
        const { data: unreadData } = await supabase
          .from('messages')
          .select('factory_id')
          .eq('order_id', orderId)
          .is('read_at', null)
          .neq('sender_id', profile.id);
        const counts: Record<string, number> = {};
        for (const row of (unreadData || []) as { factory_id: string }[]) {
          counts[row.factory_id] = (counts[row.factory_id] || 0) + 1;
        }
        if (initialChatFactoryId) counts[initialChatFactoryId] = 0;
        setUnreadByFactory(counts);
      }

      setLoading(false);
    })();
  }, [orderId, profile, isFactory]);

  async function handleSubmitProposal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profile) return;
    if (notEnoughForResponse) {
      setError(`Недостаточно средств на балансе: комиссия за отклик ${formatRub(responseFee)}. Пополните кошелёк.`);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('proposals').insert({
      order_id: orderId,
      factory_id: profile.id,
      price: parseFloat(price),
      lead_time_days: parseInt(leadTime),
      comment: comment || null,
      status: 'submitted',
    });
    setSubmitting(false);
    if (error) {
      setError(
        error.code === '23505'
          ? 'Вы уже отправляли предложение по этому заказу — повторно откликнуться нельзя.'
          : isInsufficientFunds(error.message)
            ? 'Недостаточно средств на балансе для отклика. Пополните кошелёк и повторите.'
            : error.message
      );
      return;
    }
    notifyWalletChanged();
    // reload proposals
    const { data: propData } = await supabase
      .from('proposals')
      .select(`*, factory:profiles!proposals_factory_id_fkey(full_name, company_name)`)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    const props = (propData || []) as ProposalWithFactory[];
    setProposals(props);
    setMyProposal(props.find((p) => p.factory_id === profile.id) || null);
    setPrice('');
    setLeadTime('');
    setComment('');
  }

  async function handleProposalStatus(proposalId: string, status: 'accepted' | 'rejected') {
    const { error } = await supabase
      .from('proposals')
      .update({ status })
      .eq('id', proposalId);
    if (error) {
      setError(error.message);
      return;
    }
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) return { ...p, status };
        // На стороне БД остальные предложения автоматически отклоняются, а заказ закрывается
        if (status === 'accepted' && p.status === 'submitted') return { ...p, status: 'rejected' };
        return p;
      })
    );
    if (status === 'accepted') {
      setOrder((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
    }
  }

  async function handleCloseOrder() {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'closed' })
      .eq('id', orderId);
    if (error) {
      setError(error.message);
      return;
    }
    setOrder((prev) => prev ? { ...prev, status: 'closed' } : prev);
  }

  async function handleCompleteOrder() {
    if (!window.confirm('Отметить заказ выполненным?')) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId);
    if (error) {
      setError(error.message);
      return;
    }
    setOrder((prev) => (prev ? { ...prev, status: 'completed' } : prev));
  }

  const acceptedProposal = proposals.find((p) => p.status === 'accepted') || null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">Заказ не найден</p>
        <button onClick={() => navigate(profile?.role === 'customer' ? '/dashboard' : '/factory')} className="mt-4 text-sm font-semibold text-slate-700 hover:underline">
          Вернуться назад
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate(isCustomer ? '/dashboard' : '/factory')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Order header */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{order.title}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ProcessBadges order={order} />
              <MaterialBadge material={order.material} />
              <span className="text-sm text-slate-500">{order.quantity} шт.</span>
              <span className="text-sm text-slate-400">·</span>
              <span className="text-sm text-slate-500">{formatDate(order.created_at)}</span>
            </div>
          </div>
          {isCustomer && order.status === 'open' && (
            <button
              onClick={handleCloseOrder}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Снять заказ
            </button>
          )}
          {isCustomer && order.status === 'in_progress' && (
            <button
              onClick={handleCompleteOrder}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Заказ выполнен
            </button>
          )}
        </div>

        {/* Customer info */}
        {isFactory && customer && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <User className="h-4 w-4 text-slate-400" />
            <span className="text-slate-600">Заказчик:</span>
            <span className="font-medium text-slate-900">{customer.company_name || customer.full_name}</span>
          </div>
        )}

        {/* Drawing */}
        {order.drawing_url && (
          <div className="mt-4">
            <a
              href={order.drawing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-slate-500" />
              {order.drawing_name || 'Скачать чертёж'}
              <Download className="h-4 w-4 text-slate-400" />
            </a>
          </div>
        )}

        {/* Description */}
        {order.description && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-700">Описание</h3>
            <p className="mt-1.5 text-sm text-slate-600">{order.description}</p>
          </div>
        )}

        {order.spec && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-700">Техническое задание</h3>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-sans text-sm text-slate-700 ring-1 ring-slate-200">{order.spec}</pre>
          </div>
        )}
      </div>

      {order.status === 'in_progress' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {isCustomer && (
            <>
              Вы выбрали исполнителя
              {acceptedProposal?.factory
                ? `: ${acceptedProposal.factory.company_name || acceptedProposal.factory.full_name}`
                : ''}
              . Заказ в работе. Когда работа будет выполнена, нажмите «Заказ выполнен».
            </>
          )}
          {isFactory && myProposal?.status === 'accepted' && (
            <>Заказчик выбрал вас исполнителем. Обсудите детали в чате и приступайте к работе.</>
          )}
          {isFactory && myProposal?.status !== 'accepted' && (
            <>Заказчик выбрал другого исполнителя.</>
          )}
        </div>
      )}
      {order.status === 'completed' && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          Заказ выполнен.
        </div>
      )}

      {/* Factory: submit proposal */}
      {isFactory && !myProposal && order.status === 'open' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Отправить коммерческое предложение</h2>
          <form onSubmit={handleSubmitProposal} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Цена, ₽</label>
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="input"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Срок, дней</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  className="input"
                  placeholder="14"
                />
              </div>
            </div>
            {responseFee > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Комиссия за отклик: <b>{formatRub(responseFee)}</b> ({tariffs.response_percent}% от цены, не менее{' '}
                {formatRub(tariffs.response_min_rub)}, не более {formatRub(tariffs.response_max_rub)}). Спишется с баланса при отправке.
                Ваш баланс: <b>{wallet.balance === null ? '…' : formatRub(wallet.balance)}</b>.{' '}
                {notEnoughForResponse && (
                  <button type="button" onClick={() => navigateTo('/wallet')} className="font-semibold text-slate-900 underline">
                    Пополнить кошелёк
                  </button>
                )}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Комментарий</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Условия, гарантии, особенности выполнения…"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || notEnoughForResponse}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Отправка…' : responseFee > 0 ? `Отправить КП (комиссия ${formatRub(responseFee)})` : 'Отправить КП'}
            </button>
          </form>
        </div>
      )}

      {/* Factory: already submitted */}
      {isFactory && myProposal && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Ваше предложение</h2>
            <ProposalStatusBadge status={myProposal.status} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-sm text-slate-500">Цена</p>
              <p className="text-xl font-bold text-slate-900">{Number(myProposal.price).toLocaleString('ru-RU')} ₽</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Срок</p>
              <p className="text-xl font-bold text-slate-900">{myProposal.lead_time_days} дн.</p>
            </div>
          </div>
          {myProposal.comment && (
            <p className="mt-3 text-sm text-slate-600">{myProposal.comment}</p>
          )}
        </div>
      )}

      {/* Factory: chat with the customer, available once a proposal exists */}
      {isFactory && myProposal && profile && (
        <div className="mt-6">
          <ChatPanel
            orderId={orderId}
            factoryId={profile.id}
            currentUserId={profile.id}
            title={`Чат с заказчиком · ${customer?.company_name || customer?.full_name || ''}`}
          />
        </div>
      )}

      {/* Proposals list — only the customer needs to compare offers; a factory
          only ever gets its own row back now (see RLS), and already has its
          own proposal card + chat above, so showing it again here would be
          redundant and the old "все предложения" heading would be misleading. */}
      {isCustomer && (
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Коммерческие предложения
          <span className="ml-2 text-sm font-normal text-slate-500">({proposals.length})</span>
        </h2>

        {proposals.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Предложения ещё не поступили</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {proposals.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border bg-white p-5 transition ${
                  p.status === 'accepted' ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {p.factory?.company_name || p.factory?.full_name || 'Завод'}
                      </span>
                      <ProposalStatusBadge status={p.status} />
                    </div>
                    {p.comment && (
                      <p className="mt-2 text-sm text-slate-600">{p.comment}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-900">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
                      <p className="text-sm text-slate-500">{p.lead_time_days} дн.</p>
                    </div>
                    {isCustomer && (
                      <button
                        onClick={() => {
                          setActiveChatFactoryId((prev) => (prev === p.factory_id ? null : p.factory_id));
                          setUnreadByFactory((prev) => ({ ...prev, [p.factory_id]: 0 }));
                        }}
                        className={`relative flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                          activeChatFactoryId === p.factory_id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Чат
                        {!!unreadByFactory[p.factory_id] && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                            {unreadByFactory[p.factory_id]}
                          </span>
                        )}
                      </button>
                    )}
                    {isCustomer && order.status === 'open' && p.status === 'submitted' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleProposalStatus(p.id, 'accepted')}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700"
                          title="Принять"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleProposalStatus(p.id, 'rejected')}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition hover:bg-red-600"
                          title="Отклонить"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {isCustomer && activeChatFactoryId && profile && (
        <div className="mt-6">
          <ChatPanel
            orderId={orderId}
            factoryId={activeChatFactoryId}
            currentUserId={profile.id}
            title={`Чат · ${proposals.find((p) => p.factory_id === activeChatFactoryId)?.factory?.company_name || 'Завод'}`}
            onClose={() => setActiveChatFactoryId(null)}
          />
        </div>
      )}
    </div>
  );
}

