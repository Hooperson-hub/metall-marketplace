import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import type { UserRole } from '@/lib/supabase';
import { Factory, ShoppingCart, Check } from 'lucide-react';

export function SignUpPage({ initialRole }: { initialRole?: UserRole }) {
  const { signUp } = useAuth();
  const { navigate } = useHashRoute();

  const [role, setRole] = useState<UserRole>(initialRole || 'customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error, needsEmailConfirmation } = await signUp({ email, password, role, companyName, fullName, phone });
      if (error) {
        setError(error);
      } else if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        navigate(role === 'customer' ? '/dashboard' : '/factory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось связаться с сервером. Проверьте интернет-соединение и попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Проверьте почту</h1>
          <p className="mt-3 text-sm text-slate-500">
            Мы отправили письмо на <span className="font-medium text-slate-700">{email}</span>. Перейдите по ссылке
            в письме, чтобы подтвердить аккаунт и войти.
          </p>
          <button
            onClick={() => navigate('/signin')}
            className="mt-6 font-semibold text-slate-900 hover:underline"
          >
            К странице входа
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Регистрация</h1>
        <p className="mt-2 text-sm text-slate-500">Выберите тип аккаунта и заполните данные</p>

        {/* Role selector */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <RoleCard
            active={role === 'customer'}
            onClick={() => setRole('customer')}
            icon={<ShoppingCart className="h-6 w-6" />}
            title="Заказчик"
            desc="Размещаю заказы"
          />
          <RoleCard
            active={role === 'factory'}
            onClick={() => setRole('factory')}
            icon={<Factory className="h-6 w-6" />}
            title="Завод"
            desc="Выполняю заказы"
          />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Название компании" required>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input"
              placeholder="ООО «МеталлДеталь»"
            />
          </Field>
          <Field label="Контактное лицо" required>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="Иван Иванов"
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@company.ru"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Пароль" required>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Минимум 6 символов"
              />
            </Field>
            <Field label="Телефон">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="+7 (___) ___-__-__"
              />
            </Field>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Создание аккаунта…' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{' '}
          <button onClick={() => navigate('/signin')} className="font-semibold text-slate-900 hover:underline">
            Войти
          </button>
        </p>
      </div>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border p-4 text-left transition ${
        active ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {icon}
      </div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500">{desc}</p>
      {active && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  );
}

export function SignInPage() {
  const { signIn } = useAuth();
  const { navigate } = useHashRoute();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
      } else {
        // The auth state change will redirect via the route guard, but push to a default
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось связаться с сервером. Проверьте интернет-соединение и попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Вход</h1>
        <p className="mt-2 text-sm text-slate-500">Войдите в личный кабинет</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Email" required>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@company.ru"
            />
          </Field>
          <Field label="Пароль" required>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Ваш пароль"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Нет аккаунта?{' '}
          <button onClick={() => navigate('/signup')} className="font-semibold text-slate-900 hover:underline">
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

