import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase, type ProcessType, type Material } from '@/lib/supabase';
import { PROCESS_LABELS, PROCESS_ORDER } from '@/lib/supabase';
import { requestAiHelp, type AiHelpResult } from '@/lib/ai';
import { supabaseUpload } from '@/components/Layout';
import { ProcessBadge, MaterialBadge } from '@/components/Badges';
import { Upload, File, X, Sparkles, Check, Loader2 } from 'lucide-react';
import { formatRub, isInsufficientFunds, notifyWalletChanged, useNextOrderFee, useTariffs, useWallet } from '@/lib/wallet';

const PROCESS_OPTIONS: ProcessType[] = PROCESS_ORDER;
const MATERIAL_OPTIONS: Material[] = ['steel', 'aluminum', 'copper'];
const ACCEPTED = '.dxf,.pdf,.dwg,.png,.jpg,.jpeg,.step,.stp';
const MAX_FILE = 10 * 1024 * 1024;

export function CreateOrderPage() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tariffs = useTariffs();
  const { balance } = useWallet();
  const { fee, freeLeft } = useNextOrderFee(tariffs);
  const notEnough = fee !== null && fee > 0 && balance !== null && balance < fee;

  const [title, setTitle] = useState('');
  const [processTypes, setProcessTypes] = useState<ProcessType[]>(['cutting']);
  const [material, setMaterial] = useState<Material>('steel');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ path: string; url: string } | null>(null);
  const [spec, setSpec] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [ai, setAi] = useState<AiHelpResult | null>(null);

  function toggleProcess(p: ProcessType) {
    setProcessTypes((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : PROCESS_ORDER.filter((x) => x === p || prev.includes(x))));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !profile) return;
    setError(null);
    if (f.size > MAX_FILE) {
      setError('Файл больше 10 МБ. Сожмите его или разделите на части.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
    setUploading(true);
    const { data, error: upErr } = await supabaseUpload(f, profile.id);
    setUploading(false);
    if (upErr || !data) {
      setError('Не удалось загрузить файл: ' + (upErr?.message ?? 'неизвестная ошибка'));
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const { data: pub } = supabase.storage.from('drawings').getPublicUrl(data.path);
    setUploaded({ path: data.path, url: pub.publicUrl });
  }

  function removeFile() {
    if (uploaded) supabase.storage.from('drawings').remove([uploaded.path]);
    setUploaded(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function runAi() {
    setError(null);
    if (!title.trim() && !description.trim() && !file) {
      setError('Сначала укажите название изделия, опишите его или приложите чертёж — так подсказка будет точнее.');
      return;
    }
    setAiBusy(true);
    const result = await requestAiHelp({
      title,
      description,
      material,
      quantity,
      operations: processTypes,
      drawingPath: uploaded?.path ?? null,
      drawingName: file?.name ?? null,
    });
    setAi(result);
    setSpec(result.spec);
    setAiBusy(false);
  }

  function applySuggestedOperations() {
    if (!ai) return;
    const codes = ai.operations.map((o) => o.code);
    if (codes.length > 0) setProcessTypes(PROCESS_ORDER.filter((p) => codes.includes(p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profile) return;
    if (notEnough && fee !== null) {
      setError(`Недостаточно средств на балансе: размещение стоит ${formatRub(fee)}. Пополните кошелёк.`);
      return;
    }

    if (processTypes.length === 0) {
      setError('Выберите хотя бы одну операцию');
      return;
    }
    if (uploading) return;
    setSubmitting(true);
    const drawingUrl = uploaded?.url ?? null;
    const drawingName = file?.name ?? null;

    const { data: orderData, error: insErr } = await supabase
      .from('orders')
      .insert({
        customer_id: profile.id,
        title,
        process_type: processTypes[0],
        process_types: processTypes,
        spec: spec.trim() || null,
        material,
        quantity,
        description: description || null,
        drawing_url: drawingUrl,
        drawing_name: drawingName,
        status: 'open',
      })
      .select()
      .single();

    setSubmitting(false);

    if (insErr) {
      setError(
        isInsufficientFunds(insErr.message)
          ? 'Недостаточно средств на балансе для размещения заказа. Пополните кошелёк и повторите.'
          : 'Ошибка создания заказа: ' + insErr.message
      );
      return;
    }
    notifyWalletChanged();

    navigate(`/orders/${orderData.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Новый заказ</h1>
      <p className="mt-1 text-sm text-slate-500">Заполните параметры — заводы получат уведомление</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Title */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Название заказа</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Корпус для электрощитка"
          />
        </div>

        {/* Drawing upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Чертёж или эскиз</label>
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-slate-400 hover:bg-slate-100"
            >
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-600">Нажмите, чтобы загрузить файл</p>
              <p className="mt-1 text-xs text-slate-400">DXF, DWG, PDF, STEP, фото или скан, до 10 МБ</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <File className="h-5 w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{uploading ? 'Загрузка…' : `${(file.size / 1024).toFixed(0)} КБ`}</p>
                </div>
              </div>
              <button type="button" onClick={removeFile} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFileSelect} className="hidden" />
        </div>

        {/* Operations (multi-select) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Нужные операции</label>
          <p className="mb-2 text-xs text-slate-500">Отметьте всё, что требуется для изделия. Не уверены, что нужно? Нажмите «Подобрать с помощью ИИ» ниже.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PROCESS_OPTIONS.map((p) => {
              const on = processTypes.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProcess(p)}
                  aria-pressed={on}
                  className={`relative rounded-xl border p-3 text-center transition ${
                    on ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <ProcessBadge type={p} />
                  {on && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Material */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Материал</label>
          <div className="grid grid-cols-3 gap-3">
            {MATERIAL_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMaterial(m)}
                className={`rounded-xl border p-3 text-center transition ${
                  material === m ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <MaterialBadge material={m} />
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Количество деталей</label>
          <input
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="input w-32"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Дополнительное описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="Допуски, требования к качеству, сроки и т.д."
          />
        </div>

        {/* AI helper + spec */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Помощь с операциями и техническим заданием</p>
          <p className="mt-1 text-xs text-slate-500">
            Помощник подскажет, какие операции обычно нужны для такого изделия, и составит черновик ТЗ. Это рекомендация:
            проверьте результат перед публикацией.
          </p>
          <button
            type="button"
            onClick={runAi}
            disabled={aiBusy || uploading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
            {aiBusy ? 'Анализируем…' : ai ? 'Составить заново' : 'Подобрать операции и составить ТЗ'}
          </button>

          {ai && (
            <div className="mt-4 space-y-4">
              {ai.notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{ai.notice}</p>}

              {ai.operations.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Рекомендуемые операции</p>
                  <ul className="mt-2 space-y-1.5">
                    {ai.operations.map((o) => (
                      <li key={o.code} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                        <b>{PROCESS_LABELS[o.code]}</b>
                        {o.reason ? <span className="text-slate-500"> — {o.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={applySuggestedOperations}
                    className="mt-2 text-sm font-semibold text-slate-900 underline"
                  >
                    Выбрать эти операции
                  </button>
                </div>
              )}

              {ai.questions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Что стоит уточнить (добавьте в описание, если знаете)</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {ai.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {ai.notes && <p className="text-xs text-slate-500">{ai.notes}</p>}
            </div>
          )}

          {(ai || spec) && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Техническое задание (можно править)</label>
              <textarea
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                rows={10}
                className="input font-mono text-xs"
              />
              <p className="mt-1 text-xs text-slate-500">Это ТЗ увидят заводы в вашем заказе. Оставьте пустым, если оно не нужно.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {fee !== null && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              fee === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {fee === 0 ? (
              <>
                Размещение этой заявки <b>бесплатно</b>
                {freeLeft !== null ? ` (бесплатных заявок осталось: ${freeLeft})` : ''}.
              </>
            ) : (
              <>
                Размещение заявки: <b>{formatRub(fee)}</b>, спишется с баланса при публикации. Ваш баланс:{' '}
                <b>{balance === null ? '…' : formatRub(balance)}</b>.{' '}
                {notEnough && (
                  <button type="button" onClick={() => navigate('/wallet')} className="font-semibold text-slate-900 underline">
                    Пополнить кошелёк
                  </button>
                )}
                <span className="mt-1 block text-xs text-slate-500">
                  Если вы снимете заявку до получения первого КП, плата вернётся на баланс.
                </span>
              </>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-xl border border-slate-300 px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting || uploading || notEnough || processTypes.length === 0}
            className="flex-1 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {uploading ? 'Загрузка файла…' : submitting ? 'Создание…' : fee && fee > 0 ? `Опубликовать за ${formatRub(fee)}` : 'Опубликовать заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}
