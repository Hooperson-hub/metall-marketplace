# МеталлМаркет

B2B-маркетплейс услуг металлообработки: заказчик публикует заказ с чертежом, заводы присылают коммерческие предложения, стороны общаются в чате.

**Стек:** Vite + React 18 + TypeScript + Tailwind, бэкенд — Supabase (Postgres, Auth, Storage).

## Запуск
```bash
npm install
cp .env.example .env   # впишите URL и anon-ключ своего проекта Supabase
npm run dev
```

## База данных
В Supabase → SQL Editor выполните файлы из `supabase/migrations` по порядку (по имени файла).

## Деплой
Vercel: Import Git Repository → переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` → Deploy.
Файл `vercel.json` уже настроен для клиентских маршрутов.
