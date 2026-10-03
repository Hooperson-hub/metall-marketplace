import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { PasswordInput } from '@/components/PasswordInput';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

// Шаг 1: пользователь вводит email и получает письмо со ссылкой
export function ForgotPasswordPage() {
  const { navigate } = useHashRoute();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) {
        setError(
          /rate limit|too many/i.test(err.message)
            ? 'Слишком много запросов. Подождите немного и попробуйте снова.'
            : 'Не удалось отправить письмо: ' + err.message
        );
      } else {
        setSent(true);
      }
    } catch {
      setError('Не удалось связаться с сервером. Проверьте интернет-соединение.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card title="Проверьте почту">
        <p className="text-sm text-slate-600">
          Если аккаунт с адресом <b>{email}</b> существует, мы отправили на него письмо со ссылкой для смены пароля.
          Ссылка действует ограниченное время. Если письма нет, загляните в папку «Спам».
        </p>
        <button onClick={() => navigate('/signin')} className="mt-6 text-sm font-semibold text-slate-900 hover:underline">
          Вернуться ко входу
        </button>
      </Card>
    );
  }

  return (
    <Card title="Восстановление пароля" subtitle="Укажите email, с которым вы регистрировались">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@company.ru"
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Отправка…' : 'Отправить ссылку'}
        </button>
      </form>
      <button onClick={() => navigate('/signin')} className="mt-5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline">
        Вернуться ко входу
      </button>
    </Card>
  );
}

// Шаг 2: пользователь перешёл по ссылке из письма и задаёт новый пароль
export function ResetPasswordPage() {
  const { navigate } = useHashRoute();
  const { profile } = useAuth();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    // Сессия из ссылки подхватывается не мгновенно: ждём несколько секунд
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setReady(true);
    });
    const timer = setTimeout(() => setReady((r) => (r === null ? false : r)), 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(
          /same|different/i.test(err.message)
            ? 'Новый пароль должен отличаться от прежнего'
            : 'Не удалось изменить пароль: ' + err.message
        );
      } else {
        setDone(true);
      }
    } catch {
      setError('Не удалось связаться с сервером. Проверьте интернет-соединение.');
    } finally {
      setBusy(false);
    }
  }

  if (ready === null) {
    return (
      <Card title="Проверяем ссылку…">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card title="Ссылка недействительна" subtitle="Она устарела или уже была использована.">
        <button
          onClick={() => navigate('/forgot-password')}
          className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          Запросить новую ссылку
        </button>
      </Card>
    );
  }

  if (done) {
    return (
      <Card title="Пароль изменён" subtitle="Теперь вы можете пользоваться новым паролем.">
        <button
          onClick={() => navigate(profile?.role === 'factory' ? '/factory' : '/dashboard')}
          className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          Перейти в кабинет
        </button>
      </Card>
    );
  }

  return (
    <Card title="Новый пароль" subtitle="Придумайте пароль не короче 8 символов">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Новый пароль</label>
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Не короче 8 символов"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Повторите пароль</label>
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Ещё раз"
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Сохранение…' : 'Сохранить пароль'}
        </button>
      </form>
    </Card>
  );
}
