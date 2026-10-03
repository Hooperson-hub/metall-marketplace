// Приём уведомлений ЮKassa об успешной оплате.
// Разверните БЕЗ проверки JWT (Verify JWT = выключено), иначе ЮKassa не сможет достучаться.
// В личном кабинете ЮKassa → Интеграция → HTTP-уведомления укажите адрес этой функции и событие payment.succeeded.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const id = body?.object?.id;
    if (body?.event !== 'payment.succeeded' || !id) return new Response('ignored', { status: 200 });

    // Не доверяем содержимому уведомления: сами спрашиваем ЮKassa о статусе платежа
    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')!;
    const secret = Deno.env.get('YOOKASSA_SECRET_KEY')!;
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${id}`, {
      headers: { Authorization: 'Basic ' + btoa(`${shopId}:${secret}`) },
    });
    const p = await res.json();
    if (!res.ok || p.status !== 'succeeded' || !p.paid) return new Response('not paid', { status: 200 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Сверяем сумму с тем, что мы сами записали при создании платежа
    const { data: row } = await admin.from('payments').select('amount').eq('provider_payment_id', id).maybeSingle();
    if (!row || Number(row.amount) !== Number(p.amount?.value)) return new Response('amount mismatch', { status: 200 });

    const { error } = await admin.rpc('apply_succeeded_payment', { p_provider_payment_id: id });
    if (error) return new Response(error.message, { status: 500 }); // ЮKassa повторит уведомление позже
    return new Response('ok', { status: 200 });
  } catch (_e) {
    return new Response('error', { status: 500 });
  }
});
