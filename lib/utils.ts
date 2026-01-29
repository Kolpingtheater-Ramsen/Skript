import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ScriptRow, CategoryFilter } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const categoryMap: Record<string, CategoryFilter> = {
  'Schauspieler': 'actor',
  'Anweisung': 'instruction',
  'Regieanweisung': 'instruction',
  'Einblendung': 'instruction',
  'Technik': 'technical',
  'Licht': 'lighting',
  'Ton': 'audio',
  'Requisite': 'props',
  'Mikrofon': 'microphone',
};

export function getCategoryFilter(kategorie: string): CategoryFilter {
  return categoryMap[kategorie] || 'instruction';
}

export function getCategoryClass(kategorie: string): string {
  const filter = getCategoryFilter(kategorie);
  return `category-${filter}`;
}

export function isLineVisible(
  row: ScriptRow,
  filters: Record<CategoryFilter, { enabled: boolean }>,
  selectedActor: string | null
): boolean {
  const category = getCategoryFilter(row.Kategorie);
  if (!filters[category]?.enabled) return false;
  if (selectedActor && category === 'actor') {
    return row.Charakter === selectedActor;
  }
  return true;
}

export function formatLineNumber(index: number): string {
  return String(index + 1).padStart(3, '0');
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T, delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T, limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error('Failed to save to localStorage:', e); }
  },
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};
