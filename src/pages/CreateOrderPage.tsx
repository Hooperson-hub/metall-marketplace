import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase, type ProcessType, type Material } from '@/lib/supabase';
import { PROCESS_LABELS, MATERIAL_LABELS } from '@/lib/supabase';
import { supabaseUpload } from '@/components/Layout';
import { ProcessBadge, MaterialBadge } from '@/components/Badges';
import { Upload, File, X, Sparkles, Check } from 'lucide-react';
import { formatRub, isInsufficientFunds, notifyWalletChanged, useNextOrderFee, useTariffs, useWallet } from '@/lib/wallet';

const PROCESS_OPTIONS: ProcessType[] = ['cutting', 'welding', 'bending', 'painting'];
const MATERIAL_OPTIONS: Material[] = ['steel', 'aluminum', 'copper'];
const ACCEPTED = '.dxf,.pdf,.dwg';

export function CreateOrderPage() {
  const { profile } = useAuth();
  const { navigate } = useHashRoute();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tariffs = useTariffs();
  const { balance } = useWallet();
  const { fee, freeLeft } = useNextOrderFee(tariffs);
  const notEnough = fee !== null && fee > 0 && balance !== null && balance < fee;

  const [title, setTitle] = useState('');
  const [processType, setProcessType] = useState<ProcessType>('cutting');
  const [material, setMaterial] = useState<Material>('steel');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specGenerated, setSpecGenerated] = useState(false);
  const [specText, setSpecText] = useState('');

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function removeFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function generateSpec() {
    setSpecGenerated(true);
    setSpecText(
      `ТЕХНИЧЕСКОЕ ЗАДАНИЕ\n` +
      `Наименование: ${title || '—'}\n` +
      `Тип обработки: ${PROCESS_LABELS[processType]}\n` +
      `Материал: ${MATERIAL_LABELS[material]}\n` +
      `Количество деталей: ${quantity} шт.\n` +
      `Чертёж: ${file?.name || 'не приложен'}\n` +
      `Описание: ${description || '—'}\n` +
      `\nДанное ТЗ сформировано автоматически и носит предварительный характер. ` +
      `Окончательные требования уточняются после согласования с исполнителем.`
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profile) return;
    if (notEnough && fee !== null) {
      setError(`Недостаточно средств на балансе: размещение стоит ${formatRub(fee)}. Пополните кошелёк.`);
      return;
    }
    setSubmitting(true);

    let drawingUrl: string | null = null;
    let drawingName: string | null = null;

    if (file) {
      setUploading(true);
      const { data: upData, error: upErr } = await supabaseUpload(file, profile.id);
      setUploading(false);
      if (upErr) {
        setError('Не удалось загрузить файл: ' + upErr.message);
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from('drawings').getPublicUrl(upData.path);
      drawingUrl = pub.publicUrl;
      drawingName = file.name;
    }

    const { data: orderData, error: insErr } = await supabase
      .from('orders')
      .insert({
        customer_id: profile.id,
        title,
        process_type: processType,
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Чертёж (DXF, PDF, DWG)</label>
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-slate-400 hover:bg-slate-100"
            >
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-600">Нажмите, чтобы загрузить файл</p>
              <p className="mt-1 text-xs text-slate-400">DXF, PDF или DWG, до 10 МБ</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <File className="h-5 w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} КБ</p>
                </div>
              </div>
              <button type="button" onClick={removeFile} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFileSelect} className="hidden" />
        </div>

        {/* Process type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Тип обработки</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PROCESS_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProcessType(p)}
                className={`rounded-xl border p-3 text-center transition ${
                  processType === p ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <ProcessBadge type={p} />
              </button>
            ))}
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

        {/* Generate spec */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={generateSpec}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 transition hover:bg-slate-100"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            Сгенерировать ТЗ
          </button>
          {specGenerated && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" />
                ТЗ сформировано
              </div>
              <pre className="whitespace-pre-wrap rounded-lg bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                {specText}
              </pre>
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
            disabled={submitting || uploading || notEnough}
            className="flex-1 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {uploading ? 'Загрузка файла…' : submitting ? 'Создание…' : fee && fee > 0 ? `Опубликовать за ${formatRub(fee)}` : 'Опубликовать заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}
