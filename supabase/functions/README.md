# Приём платежей (ЮKassa) — включать только после одобрения магазина

1. В Supabase → Edge Functions создайте две функции с такими же именами и вставьте код из папок:
   - `create-payment` (Verify JWT: включено);
   - `yookassa-webhook` (Verify JWT: **выключено**).
2. Supabase → Edge Functions → Secrets добавьте:
   - `YOOKASSA_SHOP_ID` — идентификатор магазина;
   - `YOOKASSA_SECRET_KEY` — секретный ключ (из кабинета ЮKassa, не публикуйте его нигде);
   - `SITE_URL` — `https://hoopersonhub.ru`.
3. В кабинете ЮKassa → Интеграция → HTTP-уведомления укажите адрес функции `yookassa-webhook`
   (`https://<id-проекта>.supabase.co/functions/v1/yookassa-webhook`) и событие `payment.succeeded`.
4. Сначала работайте с тестовым магазином ЮKassa и тестовыми картами, потом переключайте боевые ключи.
