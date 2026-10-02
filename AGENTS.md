# Инструкция для ИИ-агентов

B2B-маркетплейс услуг металлообработки (МеталлМаркет).

## Технологии
- Фронтенд: Vite + React 18 + TypeScript + Tailwind CSS, роутер на History API (`src/lib/router.ts`)
- Бэкенд: Supabase (Postgres + RLS, Auth, Storage, Realtime). Своего сервера нет.
- Деплой: Vercel

## Структура
- `src/pages` — страницы, `src/components` — общие компоненты, `src/context/AuthContext.tsx` — авторизация и профиль
- `src/lib/supabase.ts` — клиент и типы
- `supabase/migrations` — вся схема БД и политики безопасности; любое изменение БД — новым файлом миграции

## Правила
- Секреты не коммитить (`.env` в `.gitignore`); в браузере используется только anon-ключ.
- Каждая новая таблица — с включённым RLS и политиками.
