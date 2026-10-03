import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { calcResponseFee, formatRub, useTariffs } from '@/lib/wallet';

const EXAMPLES = [5000, 20000, 50000, 100000, 300000, 1000000];

export function TariffsPage() {
  const tariffs = useTariffs();
  const { session } = useAuth();
  const { navigate } = useHashRoute();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Тарифы</h1>
      <p className="mt-2 text-slate-600">
        Мы берём плату только за работу сервиса: размещение заявок и отклики. С самой сделки между заказчиком и заводом комиссии нет,
        расчёты за работы стороны ведут напрямую.
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Для заказчиков</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li>Первые {tariffs.free_orders_per_customer} заявки на аккаунт: <b>бесплатно</b>.</li>
          <li>Начиная со следующей: <b>{formatRub(tariffs.order_fee_rub)}</b> за каждую опубликованную заявку.</li>
          <li>Получение предложений, чат с заводами и выбор исполнителя: бесплатно.</li>
          <li>Если вы снимаете заявку до получения первого КП, плата за размещение возвращается на баланс автоматически.</li>
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Для заводов и цехов</h2>
        <p className="mt-3 text-slate-700">
          Регистрация и просмотр ленты заказов бесплатны. Платный только отклик: при отправке коммерческого предложения списывается{' '}
          <b>{tariffs.response_percent}% от указанной цены КП</b>, но не менее <b>{formatRub(tariffs.response_min_rub)}</b> и не более{' '}
          <b>{formatRub(tariffs.response_max_rub)}</b>.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Цена вашего КП</th>
                <th className="px-4 py-2 font-medium">Комиссия за отклик</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {EXAMPLES.map((p) => (
                <tr key={p}>
                  <td className="px-4 py-2 text-slate-800">{formatRub(p)}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">{formatRub(calcResponseFee(p, tariffs))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Комиссия списывается в момент отправки КП и не зависит от того, выберет ли заказчик ваше предложение. Точная сумма показывается в форме
          до отправки.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Как оплачивать</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-slate-700">
          <li>Пополните баланс в разделе «Кошелёк» удобным способом.</li>
          <li>Плата списывается автоматически при публикации заявки или отправке КП.</li>
          <li>Все операции видны в истории кошелька. Чек выдаётся в соответствии с законодательством о налоге на профессиональный доход.</li>
        </ol>
        <p className="mt-3 text-sm text-slate-500">
          Условия возврата описаны на странице{' '}
          <button onClick={() => navigate('/refund')} className="font-semibold text-slate-900 underline">«Возврат»</button>. Об изменении тарифов мы
          сообщаем на сайте не менее чем за 7 дней.
        </p>
      </section>

      {!session && (
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => navigate('/signup/customer')} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Я заказчик
          </button>
          <button onClick={() => navigate('/signup/factory')} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Я исполнитель
          </button>
        </div>
      )}
    </div>
  );
}
