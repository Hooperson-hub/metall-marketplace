import { useHashRoute } from '@/lib/router';
import { Scissors, Flame, Minimize2, Paintbrush, ArrowRight, ShieldCheck, Clock, TrendingUp, Users } from 'lucide-react';

export function LandingPage() {
  const { navigate } = useHashRoute();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, #64748b 1px, transparent 1px), radial-gradient(circle at 75% 75%, #64748b 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300 ring-1 ring-slate-700">
              B2B-маркетплейс металлообработки
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Закажите металлообработку у проверенных заводов
            </h1>
            <p className="mt-6 text-lg text-slate-300 sm:text-xl">
              Лазерная резка, сварка, гибка и порошковая покраска. Загрузите чертёж — получите коммерческие предложения от нескольких исполнителей.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Начать бесплатно
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate('/signin')}
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
              >
                Войти в кабинет
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Виды услуг</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-slate-500">
          Полный цикл металлообработки в одном месте
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Scissors, title: 'Лазерная резка', desc: 'Точная резка листового металла по чертежу' },
            { icon: Flame, title: 'Сварка', desc: 'Аргонодуговая и полуавтоматическая сварка' },
            { icon: Minimize2, title: 'Гибка', desc: 'Формовка деталей на ЧПУ-станках' },
            { icon: Paintbrush, title: 'Порошковая покраска', desc: 'Защитное и декоративное покрытие' },
          ].map((s) => (
            <div
              key={s.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white transition group-hover:scale-110">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Как это работает</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { step: '01', title: 'Создайте заказ', desc: 'Загрузите чертёж (DXF, PDF, DWG), выберите материал, тип обработки и количество деталей' },
              { step: '02', title: 'Получите предложения', desc: 'Заводы видят ваш заказ и присылают коммерческие предложения с ценой и сроками' },
              { step: '03', title: 'Выберите исполнителя', desc: 'Сравните предложения, примите лучшее — и завод приступит к работе' },
            ].map((item) => (
              <div key={item.step} className="relative rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                <span className="text-4xl font-bold text-slate-200">{item.step}</span>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, value: '120+', label: 'Заводов-исполнителей' },
            { icon: TrendingUp, value: '8 500+', label: 'Выполненных заказов' },
            { icon: Clock, value: '24 ч', label: 'Среднее время отклика' },
            { icon: ShieldCheck, value: '100%', label: 'Проверенные подрядчики' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <s.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Готовы разместить заказ?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Присоединяйтесь к платформе и получите предложения от заводов уже сегодня
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Создать аккаунт
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
