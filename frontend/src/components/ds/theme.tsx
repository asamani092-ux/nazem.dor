import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const THEME_COLORS = [
  { id: 'purple', hex: '#7F4BA9', label: 'بنفسجي' },
  { id: 'burgundy', hex: '#7A1F3D', label: 'نبيذي' },
  { id: 'navy', hex: '#1a365d', label: 'كحلي' },
  { id: 'green', hex: '#065f46', label: 'أخضر' },
  { id: 'amber', hex: '#b45309', label: 'نحاسي' },
] as const;

const STORAGE_KEY = 'nazem_theme_accent';

function applyAccent(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', hex);
  root.style.setProperty('--color-primary-light', `color-mix(in srgb, ${hex} 55%, white)`);
  root.style.setProperty('--color-primary-dark', `color-mix(in srgb, ${hex} 75%, black)`);
  root.style.setProperty('--color-primary-soft', `color-mix(in srgb, ${hex} 12%, white)`);
  root.style.setProperty('--color-primary-ring', `color-mix(in srgb, ${hex} 12%, transparent)`);
}

type ThemeCtx = { accent: string; setAccent: (hex: string) => void };

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEME_COLORS.some((c) => c.hex.toLowerCase() === saved.toLowerCase())) return saved;
    return THEME_COLORS[0].hex;
  });

  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem(STORAGE_KEY, accent);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ accent, setAccent: setAccentState }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
