import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Factory, LogOut, User, Plus, LayoutDashboard, FileText, Wallet } from 'lucide-react';
import { formatRub, useWallet } from '@/lib/wallet';
import { NotificationBell } from '@/components/NotificationBell';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { navigate, path } = useHashRoute();

  const isCustomer = profile?.role === 'customer';
  const isFactory = profile?.role === 'factory';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => navigate(profile ? (isCustomer ? '/dashboard' : '/factory') : '/')}
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Factory className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">МеталлМаркет</span>
        </button>

        {profile ? (
          <div className="flex items-center gap-1 sm:gap-2">
            {isCustomer && (
              <>
                <NavButton active={path === '/dashboard'} onClick={() => navigate('/dashboard')} icon={<LayoutDashboard className="h-4 w-4" />}>
                  <span className="hidden sm:inline">Заказы</span>
                </NavButton>
                <NavButton active={path === '/orders/new'} onClick={() => navigate('/orders/new')} icon={<Plus className="h-4 w-4" />}>
                  <span className="hidden sm:inline">Новый заказ</span>
                </NavButton>
              </>
            )}
            {isFactory && (
              <>
                <NavButton active={path === '/factory'} onClick={() => navigate('/factory')} icon={<LayoutDashboard className="h-4 w-4" />}>
                  <span className="hidden sm:inline">Лента заказов</span>
                </NavButton>
                <NavButton active={path === '/factory/proposals'} onClick={() => navigate('/factory/proposals')} icon={<FileText className="h-4 w-4" />}>
                  <span className="hidden sm:inline">Мои КП</span>
                </NavButton>
              </>
            )}
            <WalletChip />
            <NotificationBell />
            <div className="mx-1 hidden items-center gap-2 rounded-lg px-3 py-1.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <User className="h-4 w-4 text-slate-600" />
              </div>
              <div className="text-sm">
                <p className="font-medium leading-tight text-slate-900">{profile.company_name || profile.full_name}</p>
                <p className="text-xs leading-tight text-slate-500">{isCustomer ? 'Заказчик' : 'Завод'}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/signin')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Войти
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Регистрация
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function WalletChip() {
  const { balance } = useWallet();
  const { navigate, path } = useHashRoute();
  return (
    <button
      onClick={() => navigate('/wallet')}
      title="Кошелёк"
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition hover:bg-slate-100 ${
        path === '/wallet' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'
      }`}
    >
      <Wallet className="h-4 w-4" />
      <span>{balance === null ? '…' : formatRub(balance)}</span>
    </button>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: 'customer' | 'factory' }) {
  const { session, profile, loading, signOut } = useAuth();
  const { navigate } = useHashRoute();

  const wrongRole = !!role && !!profile && profile.role !== role;

  useEffect(() => {
    if (loading) return;
    if (!session) navigate('/signin');
    else if (wrongRole) navigate(profile!.role === 'customer' ? '/dashboard' : '/factory');
  }, [loading, session, wrongRole, profile, navigate]);

  if (loading || !session || wrongRole) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-semibold text-slate-900">Не удалось загрузить профиль</p>
        <p className="mt-2 text-sm text-slate-500">Попробуйте обновить страницу или войти заново.</p>
        <button onClick={signOut} className="mt-4 text-sm font-semibold text-slate-900 hover:underline">
          Выйти
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function supabaseUpload(file: File, userId: string) {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return supabase.storage.from('drawings').upload(path, file);
}
