# Этап 1: сборка проекта
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Эти два значения не секретные: они и так попадают в браузер любого посетителя.
# Адрес "/supabase" означает прокси на нашем домене (настроен в nginx.conf).
ENV VITE_SUPABASE_URL=/supabase
# ВСТАВЬТЕ вместо слов ниже ключ "anon public" из Supabase (Project Settings → API). Не ключ service_role!
ENV VITE_SUPABASE_ANON_KEY=sb_publishable_C-TnUTsSJV5HVunVC0i0hg_2BYhmlSK
RUN npm run build

# Этап 2: раздача готовых файлов
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
