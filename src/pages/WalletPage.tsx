import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import {
  MIN_TOPUP_RUB,
  MAX_TOPUP_RUB,
  calcResponseFee,
  formatRub,
  useTariffs,
  useWallet,
  notifyWalletChanged,
} from '@/lib/wallet';
import { Wallet } from 'lucide-react';

interface Tx {
  id: string;
  kind: string;
  amount: number;
  description: string;
  created_at: string;
}

const KIND_LABELS: Record<string, string> = {
  topup: 'Пополнение',
  order_fee: 'Размещение заказа',
  response_fee: 'Отклик на заказ',
  refund: 'Возврат',
  bonus: 'Бонус',
};

const PRESETS = [500, 1000, 3000, 5000];

export function WalletPage() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const tariffs = useTariffs();
  const { balance, loading, reload } = useWallet();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [amount, setAmount] = useState('1000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const justPaid = new URLSearchParams(window.location.search).get('paid') === '1';

  async function loadTxs() {
    const { data } = await supabase
      .from('wallet_transactions')
      .select('id, kind, amount, description, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setTxs(((data || []) as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) })));
  }

  useEffect(() => {
    loadTxs();
    window.addEventListener('wallet:changed', loadTxs);
    return () => window.removeEventListener('wallet:changed', loadTxs);
  }, []);

  // После возврата с оплаты баланс обновляется не мгновенно: несколько раз перепроверяем
  useEffect(() => {
    if (!justPaid) return;
    let n = 0;
    const id = setInterval(() => {
      notifyWalletChanged();
      n += 1;
      if (n >= 6) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [justPaid]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_TOPUP_RUB || value > MAX_TOPUP_RUB) {
      setError(`Сумма пополнения: от ${formatRub(MIN_TOPUP_RUB)} до ${formatRub(MAX_TOPUP_RUB)}`);
      return;
    }
    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-payment', { body: { amount: value } });
      if (fnErr || !data?.confirmation_url) {
        setError('Приём платежей пока не подключён или временно недоступен. Попробуйте позже или напишите нам.');
      } else {
        window.location.href = data.confirmation_url;
        return;
      }
    } catch {
      setError('Не удалось связаться с платёжным сервисом. Попробуйте позже.');
    }
    setBusy(false);
  }

  const isFactory = profile?.role === 'factory';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Кошелёк</h1>
      <p className="mt-1 text-sm text-slate-500">С баланса списывается плата за размещение заказов и отклики.</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Баланс</p>
            <p className="text-3xl font-bold text-slate-900">{loading || balance === null ? '…' : formatRub(balance)}</p>
          </div>
        </div>

        {justPaid && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Спасибо! Платёж обрабатывается, баланс обновится в течение минуты.{' '}
            <button onClick={reload} className="font-semibold underline">Обновить сейчас</button>
          </div>
        )}

        <form onSubmit={handleTopUp} className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Сумма пополнения, ₽</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  Number(amount) === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p.toLocaleString('ru-RU')} ₽
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            <input
              type="number"
              min={MIN_TOPUP_RUB}
              max={MAX_TOPUP_RUB}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input max-w-[200px]"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Переход к оплате…' : 'Пополнить'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            От {formatRub(MIN_TOPUP_RUB)} до {formatRub(MAX_TOPUP_RUB)}. Оплата банковской картой и другими способами через платёжный сервис.
          </p>
          {error && <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        {isFactory ? (
          <p>
            За каждый отклик (КП) списывается {tariffs.response_percent}% от указанной вами цены, но не менее{' '}
            {formatRub(tariffs.response_min_rub)} и не более {formatRub(tariffs.response_max_rub)}. Например, при цене КП 50 000 ₽ комиссия{' '}
            {formatRub(calcResponseFee(50000, tariffs))}.
          </p>
        ) : (
          <p>
            Первые {tariffs.free_orders_per_customer} заказа бесплатно, начиная со следующего размещение стоит{' '}
            {formatRub(tariffs.order_fee_rub)}. Если вы снимете заказ до получения первого КП, плата вернётся на баланс.
          </p>
        )}
        <button onClick={() => navigate('/tariffs')} className="mt-2 font-semibold text-slate-900 hover:underline">
          Подробнее о тарифах
        </button>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">История операций</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {txs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Операций пока нет</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{t.description || KIND_LABELS[t.kind] || t.kind}</p>
                  <p className="text-xs text-slate-400">
                    {KIND_LABELS[t.kind] || t.kind} · {new Date(t.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${t.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {t.amount >= 0 ? '+' : '−'}
                  {formatRub(Math.abs(t.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
