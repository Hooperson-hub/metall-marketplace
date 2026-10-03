// ИИ-помощник: подбирает операции и составляет черновик ТЗ по описанию изделия (и по изображению чертежа, если включено).
// Работает с любым провайдером, совместимым с OpenAI Chat Completions (например, Yandex AI Studio).
// Секреты (Supabase → Edge Functions → Secrets):
//   AI_BASE_URL      — адрес API, например https://ai.api.cloud.yandex.net/v1
//   AI_API_KEY       — ключ API (хранится только здесь, в браузер не попадает)
//   AI_MODEL         — модель, например gpt://<ID каталога>/yandexgpt/latest
//   AI_AUTH_SCHEME   — "Bearer" (по умолчанию) или "Api-Key" (для Yandex Cloud)
//   AI_PROJECT       — необязательно: ID каталога для заголовка OpenAI-Project (Yandex Cloud)
//   AI_DAILY_LIMIT   — необязательно: запросов на пользователя в сутки (по умолчанию 10)
//   AI_VISION        — "true" только если модель умеет читать изображения (по умолчанию выключено)
// SUPABASE_URL, SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPERATIONS: Record<string, string> = {
  cutting: 'лазерная резка',
  bending: 'гибка',
  welding: 'сварка',
  painting: 'порошковая покраска',
  installation: 'монтаж',
  machining: 'токарные и фрезерные работы',
};
const MATERIALS: Record<string, string> = { steel: 'сталь', aluminum: 'алюминий', copper: 'медь' };

const SYSTEM_PROMPT = `Ты — опытный инженер-технолог по обработке металла. Заказчик — не специалист и не знает, как изготавливается его изделие.
Твоя задача: по описанию изделия (и по изображению чертежа, если оно приложено) 1) определить, какие операции нужны; 2) составить понятное техническое задание для исполнителей; 3) перечислить вопросы, ответы на которые нужны исполнителю.
Допустимые операции (поле code): cutting (лазерная резка), bending (гибка), welding (сварка), painting (порошковая покраска), installation (монтаж), machining (токарные и фрезерные работы).
Правила:
- Не выдумывай размеры, марки металла, допуски и толщины. Если данных нет, пиши «уточнить».
- Не называй цены и сроки.
- Если чертёж не передан или его содержимое тебе недоступно, прямо скажи об этом в поле notes и опирайся только на описание.
- Выбирай только операции, которые действительно нужны. К каждой дай короткую причину (одно предложение).
- Пиши по-русски, коротко и по делу.
Ответ — ТОЛЬКО JSON без markdown и пояснений, формат:
{"operations":[{"code":"cutting","reason":"..."}],"spec":"текст ТЗ","questions":["..."],"notes":"..."}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function extractJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const base = Deno.env.get('AI_BASE_URL');
    const key = Deno.env.get('AI_API_KEY');
    const model = Deno.env.get('AI_MODEL');
    if (!base || !key || !model) return json({ error: 'AI_NOT_CONFIGURED' }, 503);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'AUTH' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Суточный лимит на пользователя, чтобы расходы на ИИ были под контролем
    const limit = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '10');
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin
      .from('ai_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if ((count ?? 0) >= limit) return json({ error: 'LIMIT' }, 429);

    const body = await req.json();
    const title = str(body.title, 200);
    const description = str(body.description, 3000);
    const material = MATERIALS[str(body.material, 20)] ?? 'не указан';
    const quantity = Math.max(1, Math.min(1_000_000, Number(body.quantity) || 1));
    const chosen = (Array.isArray(body.operations) ? body.operations : [])
      .filter((o: unknown) => typeof o === 'string' && o in OPERATIONS)
      .map((o: string) => OPERATIONS[o]);
    const drawingName = str(body.drawing_name, 200);
    const drawingPath = str(body.drawing_path, 300);

    // Изображение чертежа — только если модель это умеет и файл принадлежит самому пользователю
    let imageDataUrl: string | null = null;
    if (Deno.env.get('AI_VISION') === 'true' && drawingPath.startsWith(`${user.id}/`) && /\.(png|jpe?g|webp)$/i.test(drawingPath)) {
      const { data: blob } = await admin.storage.from('drawings').download(drawingPath);
      if (blob && blob.size <= 4 * 1024 * 1024) {
        const ext = drawingPath.split('.').pop()!.toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        imageDataUrl = `data:${mime};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
      }
    }

    const userText =
      `Изделие: ${title || 'не указано'}\n` +
      `Количество: ${quantity} шт.\n` +
      `Материал: ${material}\n` +
      `Операции, которые уже выбрал заказчик: ${chosen.length ? chosen.join(', ') : 'не выбраны'}\n` +
      `Описание заказчика: ${description || 'не указано'}\n` +
      `Чертёж: ${drawingName ? drawingName : 'не приложен'}; ` +
      (imageDataUrl ? 'изображение чертежа приложено.' : 'содержимое файла тебе недоступно — ориентируйся на описание.');

    const content = imageDataUrl
      ? [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]
      : userText;

    const { data: logRow } = await admin
      .from('ai_requests')
      .insert({ user_id: user.id, provider: new URL(base).host, ok: false })
      .select('id')
      .single();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `${Deno.env.get('AI_AUTH_SCHEME') ?? 'Bearer'} ${key}`,
    };
    const project = Deno.env.get('AI_PROJECT');
    if (project) headers['OpenAI-Project'] = project;

    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    });
    const data = await res.json().catch(() => null);
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed = res.ok ? extractJson(text) : null;
    if (!parsed || typeof parsed.spec !== 'string') return json({ error: 'AI_BAD_RESPONSE' }, 502);

    if (logRow?.id) await admin.from('ai_requests').update({ ok: true }).eq('id', logRow.id);

    const seen = new Set<string>();
    const operations = (Array.isArray(parsed.operations) ? parsed.operations : [])
      .filter((o: any) => o && typeof o.code === 'string' && o.code in OPERATIONS && !seen.has(o.code) && seen.add(o.code))
      .slice(0, 6)
      .map((o: any) => ({ code: o.code, reason: str(o.reason, 300) }));
    const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .filter((q: unknown) => typeof q === 'string')
      .slice(0, 8)
      .map((q: string) => q.slice(0, 300));

    return json({
      operations,
      spec: str(parsed.spec, 6000),
      questions,
      notes: str(parsed.notes, 500),
    });
  } catch (_e) {
    return json({ error: 'INTERNAL' }, 500);
  }
});
