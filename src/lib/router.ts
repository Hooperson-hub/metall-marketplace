import { useEffect, useState, useCallback } from 'react';

// Клиентский роутер на History API (обычные URL вида /orders/123 вместо #/orders/123).
// Имя useHashRoute сохранено, чтобы не менять импорты во всех страницах.

const NAV_EVENT = 'app:navigate';

function currentPath() {
  return window.location.pathname || '/';
}

// Старые ссылки вида /#/orders/123 переписываем в /orders/123
function migrateLegacyHash() {
  const h = window.location.hash;
  if (h.startsWith('#/')) {
    window.history.replaceState({}, '', h.slice(1));
  }
}

export function navigateTo(to: string) {
  if (to === currentPath()) return;
  window.history.pushState({}, '', to);
  window.scrollTo(0, 0);
  // Асинхронно, чтобы не обновлять состояние других компонентов во время рендера
  queueMicrotask(() => window.dispatchEvent(new Event(NAV_EVENT)));
}

export function useHashRoute() {
  const [path, setPath] = useState(() => {
    migrateLegacyHash();
    return currentPath();
  });

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('popstate', onChange);
    window.addEventListener(NAV_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(NAV_EVENT, onChange);
    };
  }, []);

  const navigate = useCallback((to: string) => navigateTo(to), []);

  return { path, navigate };
}

export const useRoute = useHashRoute;
