import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useHashRoute } from '@/lib/router';

// Страница, на которую ведут ссылки из писем (подтверждение почты, смена пароля).
// Ссылка содержит одноразовый токен; проверка идёт через адрес нашего сайта/прокси,
// поэтому пользователю не нужно открывать зарубежные адреса.
export function ConfirmPage() {
  const { navigate } = useHashRoute();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    if (!tokenHash || !type) {
      setError('Ссылка повреждена. Запросите письмо ещё раз.');
      return;
    }
    let cancelled = false;
    (async () => {
      const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (cancelled) return;
      if (err) {
        setError('Ссылка недействительна или устарела. Запросите письмо ещё раз.');
        return;
      }
      navigate(type === 'recovery' ? '/reset-password' : '/dashboard');
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Не удалось подтвердить</h1>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={() => navigate('/signin')} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Войти
            </button>
            <button onClick={() => navigate('/forgot-password')} className="text-sm font-medium text-slate-600 hover:underline">
              Забыли пароль?
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
    </div>
  );
}
