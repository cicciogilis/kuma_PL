import { useEffect, useState } from 'react';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const readPersistedValue = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (parsed == null) return fallback;

    if (isPlainObject(fallback) && isPlainObject(parsed)) {
      return { ...fallback, ...parsed };
    }

    if (typeof fallback !== typeof parsed) return fallback;

    return parsed;
  } catch {
    return fallback;
  }
};

export const usePersistentState = (key, initialValue) => {
  const [state, setState] = useState(() =>
    readPersistedValue(
      key,
      typeof initialValue === 'function' ? initialValue() : initialValue
    )
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode, quota, etc.).
    }
  }, [key, state]);

  return [state, setState];
};
