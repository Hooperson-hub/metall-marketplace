import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { Navbar, ProtectedRoute } from '@/components/Layout';
import { LandingPage } from '@/pages/LandingPage';
import { SignUpPage, SignInPage } from '@/pages/AuthPages';
import { CustomerDashboard } from '@/pages/CustomerDashboard';
import { CreateOrderPage } from '@/pages/CreateOrderPage';
import { FactoryDashboard } from '@/pages/FactoryDashboard';
import { FactoryProposalsPage } from '@/pages/FactoryProposalsPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { WalletPage } from '@/pages/WalletPage';
import { TariffsPage } from '@/pages/TariffsPage';
import { TermsPage, PrivacyPage, ConsentPage, RefundPage, ContactsPage } from '@/pages/LegalPages';
import { COMPANY } from '@/lib/company';

const FOOTER_LINKS: { to: string; label: string }[] = [
  { to: '/tariffs', label: 'Тарифы' },
  { to: '/terms', label: 'Соглашение и оферта' },
  { to: '/privacy', label: 'Конфиденциальность' },
  { to: '/refund', label: 'Возврат' },
  { to: '/contacts', label: 'Контакты' },
];

const GUEST_PATHS = ['/', '/signin', '/signup', '/signup/customer', '/signup/factory'];

function Router() {
  const { path, navigate } = useHashRoute();
  const { session, profile, loading } = useAuth();

  // Авторизованных пользователей уводим с лендинга и страниц входа в кабинет
  const shouldRedirect = !loading && !!session && !!profile && GUEST_PATHS.includes(path);

  useEffect(() => {
    if (shouldRedirect) {
      navigate(profile?.role === 'factory' ? '/factory' : '/dashboard');
    }
  }, [shouldRedirect, profile?.role, navigate]);

  if (shouldRedirect) return null;

  let page: React.ReactNode;

  if (path === '/' || path === '') {
    page = <LandingPage />;
  } else if (path === '/signup' || path === '/signup/customer' || path === '/signup/factory') {
    const initialRole = path === '/signup/factory' ? 'factory' : 'customer';
    page = <SignUpPage initialRole={initialRole} />;
  } else if (path === '/signin') {
    page = <SignInPage />;
  } else if (path === '/dashboard') {
    page = (
      <ProtectedRoute role="customer">
        <CustomerDashboard />
      </ProtectedRoute>
    );
  } else if (path === '/orders/new') {
    page = (
      <ProtectedRoute role="customer">
        <CreateOrderPage />
      </ProtectedRoute>
    );
  } else if (path === '/factory') {
    page = (
      <ProtectedRoute role="factory">
        <FactoryDashboard />
      </ProtectedRoute>
    );
  } else if (path === '/factory/proposals') {
    page = (
      <ProtectedRoute role="factory">
        <FactoryProposalsPage />
      </ProtectedRoute>
    );
  } else if (path === '/wallet') {
    page = (
      <ProtectedRoute>
        <WalletPage />
      </ProtectedRoute>
    );
  } else if (path === '/tariffs') {
    page = <TariffsPage />;
  } else if (path === '/terms') {
    page = <TermsPage />;
  } else if (path === '/privacy') {
    page = <PrivacyPage />;
  } else if (path === '/consent') {
    page = <ConsentPage />;
  } else if (path === '/refund') {
    page = <RefundPage />;
  } else if (path === '/contacts') {
    page = <ContactsPage />;
  } else if (path.startsWith('/orders/')) {
    const segments = path.split('/');
    const orderId = segments[2];
    const initialChatFactoryId = segments[3] === 'chat' ? segments[4] : undefined;
    page = (
      <ProtectedRoute>
        <OrderDetailPage orderId={orderId} initialChatFactoryId={initialChatFactoryId} />
      </ProtectedRoute>
    );
  } else {
    page = (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-2xl font-bold text-slate-900">404 — страница не найдена</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm font-semibold text-slate-700 hover:underline">
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>{page}</main>
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-400 sm:px-6">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <button key={l.to} onClick={() => navigate(l.to)} className="hover:text-slate-700 hover:underline">
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-4">МеталлМаркет — B2B-маркетплейс услуг металлообработки</p>
          <p className="mt-1 text-xs">
            {COMPANY.operatorName}, {COMPANY.taxStatus}, ИНН {COMPANY.inn} · {COMPANY.email} · {COMPANY.phone}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
