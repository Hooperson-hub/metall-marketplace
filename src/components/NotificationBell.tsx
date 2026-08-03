import { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';

interface UnreadThread {
  orderId: string;
  factoryId: string;
  orderTitle: string;
  count: number;
  lastAt: string;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.round(hrs / 24)} дн назад`;
}

export function NotificationBell() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const [threads, setThreads] = useState<UnreadThread[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function load() {
      try {
        const { data } = await supabase
          .from('messages')
          .select('order_id, factory_id, created_at, order:orders(title)')
          .is('read_at', null)
          .neq('sender_id', profile!.id)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        const rows = (data || []) as unknown as { order_id: string; factory_id: string; created_at: string; order: { title: string } | null }[];
        const grouped = new Map<string, UnreadThread>();
        for (const row of rows) {
          const key = `${row.order_id}:${row.factory_id}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            grouped.set(key, {
              orderId: row.order_id,
              factoryId: row.factory_id,
              orderTitle: row.order?.title || 'Заказ',
              count: 1,
              lastAt: row.created_at,
            });
          }
        }
        setThreads(Array.from(grouped.values()));
      } catch {
        // Ignore transient failures — next poll tick will retry.
      }
    }

    load();
    const interval = setInterval(load, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!profile) return null;

  const totalUnread = threads.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Сообщения</div>
          {threads.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Новых сообщений нет</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {threads.map((t) => (
                <button
                  key={`${t.orderId}:${t.factoryId}`}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/orders/${t.orderId}/chat/${t.factoryId}`);
                  }}
                  className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{t.orderTitle}</p>
                    <p className="text-xs text-slate-400">{timeAgo(t.lastAt)}</p>
                  </div>
                  <span className="mt-0.5 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
