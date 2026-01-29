'use client';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/stores/settings-store';

const ThemeContext = createContext<{
  theme: 'light' | 'dark' | 'pink';
  setTheme: (theme: 'light' | 'dark' | 'pink') => void;
}>({ theme: 'dark', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-pink');
    if (theme !== 'dark') root.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
