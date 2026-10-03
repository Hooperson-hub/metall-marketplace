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

# ИИ-помощник для заказов (необязательно)

Функция `generate-spec` (Verify JWT: **включено**) подбирает операции и составляет черновик ТЗ. Пока она не подключена,
сайт сам подбирает операции по ключевым словам и формирует шаблон ТЗ, ошибок пользователь не видит.

Secrets (Supabase → Edge Functions → Secrets), пример для Yandex AI Studio:
- `AI_BASE_URL` = `https://ai.api.cloud.yandex.net/v1`
- `AI_API_KEY` = API-ключ сервисного аккаунта (роль `ai.languageModels.user`)
- `AI_MODEL` = `gpt://<ID каталога>/yandexgpt/latest`
- `AI_AUTH_SCHEME` = `Api-Key`
- `AI_PROJECT` = `<ID каталога>`
- `AI_DAILY_LIMIT` = `10` (запросов на пользователя в сутки)
- `AI_VISION` = `false` (включайте `true` только для модели, умеющей читать изображения)
