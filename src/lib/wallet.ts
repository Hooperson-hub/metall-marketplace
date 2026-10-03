import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface Tariffs {
  response_percent: number;
  response_min_rub: number;
  response_max_rub: number;
  free_orders_per_customer: number;
  order_fee_rub: number;
}

// Значения по умолчанию совпадают с таблицей tariffs в базе; реальные подгружаются с сервера
export const DEFAULT_TARIFFS: Tariffs = {
  response_percent: 1,
  response_min_rub: 150,
  response_max_rub: 2000,
  free_orders_per_customer: 2,
  order_fee_rub: 300,
};

export const MIN_TOPUP_RUB = 300;
export const MAX_TOPUP_RUB = 100000;

export function calcResponseFee(price: number, t: Tariffs): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const raw = Math.ceil((price * t.response_percent) / 100);
  return Math.min(t.response_max_rub, Math.max(t.response_min_rub, raw));
}

export function formatRub(n: number): string {
  return `${Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

export function isInsufficientFunds(message: string | undefined | null): boolean {
  return !!message && message.includes('INSUFFICIENT_FUNDS');
}

const WALLET_EVENT = 'wallet:changed';
export function notifyWalletChanged() {
  window.dispatchEvent(new Event(WALLET_EVENT));
}

export function useTariffs(): Tariffs {
  const [tariffs, setTariffs] = useState<Tariffs>(DEFAULT_TARIFFS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('tariffs').select('*').eq('id', 1).maybeSingle();
      if (!cancelled && data) {
        setTariffs({
          response_percent: Number(data.response_percent),
          response_min_rub: Number(data.response_min_rub),
          response_max_rub: Number(data.response_max_rub),
          free_orders_per_customer: Number(data.free_orders_per_customer),
          order_fee_rub: Number(data.order_fee_rub),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return tariffs;
}

export function useWallet() {
  const { profile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!profile) {
      setBalance(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', profile.id).maybeSingle();
    setBalance(data ? Number(data.balance) : 0);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    reload();
    window.addEventListener(WALLET_EVENT, reload);
    return () => window.removeEventListener(WALLET_EVENT, reload);
  }, [reload]);

  return { balance, loading, reload };
}

// Сколько заявок уже создал заказчик и сколько стоит следующая
export function useNextOrderFee(tariffs: Tariffs) {
  const { profile } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count: c } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', profile.id);
      setCount(c ?? 0);
    })();
  }, [profile]);

  const freeLeft = count === null ? null : Math.max(0, tariffs.free_orders_per_customer - count);
  const fee = count === null ? null : freeLeft && freeLeft > 0 ? 0 : tariffs.order_fee_rub;
  return { fee, freeLeft, count };
}
