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

function Router() {
  const { path, navigate } = useHashRoute();
  const { session, profile, loading } = useAuth();

  // Redirect signed-in users away from landing/auth pages
  if (!loading && session && (path === '/' || path === '/signin' || path === '/signup' || path === '/signup/customer' || path === '/signup/factory')) {
    const target: string = profile?.role === 'factory' ? '/factory' : '/dashboard';
    navigate(target);
    return null;
  }

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
  } else if (path.startsWith('/orders/')) {
    const segments = path.split('/');
    const orderId = segments[2];
    const initialChatFactoryId = segments[3] === 'chat' ? segments[4] : undefined;
    page = (
      <ProtectedRoute>
        <OrderDetailPage orderId={orderId} initialChatFactoryId={initialChatFactoryId} />
      </ProtectedRoute>
    );
  } else if (path === '/download') {
    page = (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Скачать проект</h1>
          <p className="mt-2 text-sm text-slate-500">Архив содержит все файлы проекта (без node_modules)</p>
          
            href="project.zip
"
            download
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
          >
            Скачать ZIP (91 КБ)
          </a>
        </div>
      </div>
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
      <footer className="border-t border-slate-200 bg-whiimport { AuthProvider, useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { Navbar, ProtectedRoute } from '@/components/Layout';
import { LandingPage } from '@/pages/LandingPage';
import { SignUpPage, SignInPage } from '@/pages/AuthPages';
import { CustomerDashboard } from '@/pages/CustomerDashboard';
import { CreateOrderPage } from '@/pages/CreateOrderPage';
import { FactoryDashboard } from '@/pages/FactoryDashboard';
import { FactoryProposalsPage } from '@/pages/FactoryProposalsPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';

function Router() {
  const { path, navigate } = useHashRoute();
  const { session, profile, loading } = useAuth();

  // Redirect signed-in users away from landing/auth pages
  if (!loading && session && (path === '/' || path === '/signin' || path === '/signup' || path === '/signup/customer' || path === '/signup/factory')) {
    const target: string = profile?.role === 'factory' ? '/factory' : '/dashboard';
    navigate(target);
    return null;
  }

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
  } else if (path.startsWith('/orders/')) {
    const segments = path.split('/');
    const orderId = segments[2];
    const initialChatFactoryId = segments[3] === 'chat' ? segments[4] : undefined;
    page = (
      <ProtectedRoute>
        <OrderDetailPage orderId={orderId} initialChatFactoryId={initialChatFactoryId} />
      </ProtectedRoute>
    );
  } else if (path === '/download') {
    page = (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Скачать проект</h1>
          <p className="mt-2 text-sm text-slate-500">Архив содержит все файлы проекта (без node_modules)</p>
          
            href="project.zip
"
            download
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
          >
            Скачать ZIP (91 КБ)
          </a>
        </div>
      </div>
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
      <footer className="border-t border-slate-200 bg-whiimport { AuthProvider, useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { Navbar, ProtectedRoute } from '@/components/Layout';
import { LandingPage } from '@/pages/LandingPage';
import { SignUpPage, SignInPage } from '@/pages/AuthPages';
import { CustomerDashboard } from '@/pages/CustomerDashboard';
import { CreateOrderPage } from '@/pages/CreateOrderPage';
import { FactoryDashboard } from '@/pages/FactoryDashboard';
import { FactoryProposalsPage } from '@/pages/FactoryProposalsPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';

function Router() {
  const { path, navigate } = useHashRoute();
  const { session, profile, loading } = useAuth();

  // Redirect signed-in users away from landing/auth pages
  if (!loading && session && (path === '/' || path === '/signin' || path === '/signup' || path === '/signup/customer' || path === '/signup/factory')) {
    const target: string = profile?.role === 'factory' ? '/factory' : '/dashboard';
    navigate(target);
    return null;
  }

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
  } else if (path.startsWith('/orders/')) {
    const segments = path.split('/');
    const orderId = segments[2];
    const initialChatFactoryId = segments[3] === 'chat' ? segments[4] : undefined;
    page = (
      <ProtectedRoute>
        <OrderDetailPage orderId={orderId} initialChatFactoryId={initialChatFactoryId} />
      </ProtectedRoute>
    );
  } else if (path === '/download') {
    page = (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Скачать проект</h1>
          <p className="mt-2 text-sm text-slate-500">Архив содержит все файлы проекта (без node_modules)</p>
          
            href="project.zip
"
            download
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
          >
            Скачать ZIP (91 КБ)
          </a>
        </div>
      </div>
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
          МеталлМаркет — B2B-маркетплейс услуг металлообработки
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
