import { useEffect, useRef, useState } from 'react';
import { THEME_COLORS, useTheme } from './theme';

export function ThemeSwitcher({ compact = false, corner = false }: { compact?: boolean; corner?: boolean }) {
  const { accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = THEME_COLORS.find((c) => c.hex.toLowerCase() === accent.toLowerCase());

  return (
    <div className={`ds-theme-switcher ${compact ? 'ds-theme-compact' : ''} ${corner ? 'ds-theme-corner' : ''}`} ref={ref}>
      <button
        type="button"
        className="ds-theme-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="تغيير اللون"
      >
        <span className="ds-theme-trigger-dot" style={{ background: accent }} />
        <span className="ds-theme-trigger-label">{compact ? 'اللون' : current?.label || 'اللون'}</span>
      </button>
      {open ? (
        <div className="ds-theme-popover">
          <p className="ds-theme-popover-title">اللون الأساسي</p>
          <div className="ds-theme-swatches ds-theme-swatches-popover">
            {THEME_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ds-theme-swatch ds-theme-swatch-popover ${accent.toLowerCase() === c.hex.toLowerCase() ? 'ds-theme-swatch-active' : ''}`}
                style={{ background: c.hex }}
                title={c.label}
                aria-label={c.label}
                onClick={() => {
                  setAccent(c.hex);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
