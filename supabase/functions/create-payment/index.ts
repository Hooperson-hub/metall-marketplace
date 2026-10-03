// Создание платежа в ЮKassa для пополнения баланса.
// Секреты (Supabase → Edge Functions → Secrets): YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, SITE_URL
// SUPABASE_URL, SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Требуется вход' }, 401);

    const { amount } = await req.json();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 300 || value > 100000) {
      return json({ error: 'Сумма пополнения: от 300 до 100 000 ₽' }, 400);
    }

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: pay, error: insErr } = await admin
      .from('payments')
      .insert({ user_id: user.id, amount: value })
      .select()
      .single();
    if (insErr || !pay) return json({ error: 'Не удалось создать платёж' }, 500);

    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')!;
    const secret = Deno.env.get('YOOKASSA_SECRET_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://hoopersonhub.ru';

    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': pay.id,
        Authorization: 'Basic ' + btoa(`${shopId}:${secret}`),
      },
      body: JSON.stringify({
        amount: { value: value.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: `${siteUrl}/wallet?paid=1` },
        description: 'Пополнение баланса МеталлМаркет',
        metadata: { payment_row_id: pay.id, user_id: user.id },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.id || !data?.confirmation?.confirmation_url) {
      await admin.from('payments').update({ status: 'canceled' }).eq('id', pay.id);
      return json({ error: 'Платёжный сервис отклонил запрос' }, 502);
    }

    await admin.from('payments').update({ provider_payment_id: data.id }).eq('id', pay.id);
    return json({ confirmation_url: data.confirmation.confirmation_url });
  } catch (_e) {
    return json({ error: 'Внутренняя ошибка' }, 500);
  }
});
