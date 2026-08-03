import { useEffect, useRef, useState } from 'react';
import { supabase, type Message } from '@/lib/supabase';
import { Send, X, MessageCircle } from 'lucide-react';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface ChatPanelProps {
  orderId: string;
  factoryId: string;
  currentUserId: string;
  title: string;
  onClose?: () => void;
}

export function ChatPanel({ orderId, factoryId, currentUserId, title, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('order_id', orderId)
          .eq('factory_id', factoryId)
          .order('created_at', { ascending: true });
        if (!cancelled) {
          const rows = (data || []) as Message[];
          setMessages(rows);
          const unreadIds = rows.filter((m) => m.sender_id !== currentUserId && !m.read_at).map((m) => m.id);
          if (unreadIds.length > 0) {
            supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then();
          }
        }
      } catch {
        // Silently retry on the next poll tick — a transient network blip
        // shouldn't wipe out messages already shown.
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }

    load(true);
    // Regular HTTP polling instead of a persistent WebSocket connection —
    // more resilient on unstable/restricted networks than Realtime, which
    // relies on a long-lived connection that gets reset more easily.
    const interval = setInterval(() => load(false), 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, factoryId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setText('');
    try {
      const { data, error: sendErr } = await supabase
        .from('messages')
        .insert({ order_id: orderId, factory_id: factoryId, sender_id: currentUserId, content })
        .select()
        .single();
      if (sendErr) {
        setError('Не удалось отправить сообщение: ' + sendErr.message);
        setText(content);
        return;
      }
      // Insert locally too — the next poll tick will pick it up either way
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось связаться с сервером. Проверьте интернет-соединение и попробуйте снова.');
      setText(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : messages.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-400">Сообщений пока нет — начните диалог</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-1 text-[11px] ${mine ? 'text-slate-300' : 'text-slate-400'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="px-4 pb-1 text-xs text-red-600">{error}</div>}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 p-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать сообщение…"
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
