import { THEME_COLORS, useTheme } from './theme';

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { accent, setAccent } = useTheme();
  return (
    <div className={`ds-theme-switcher ${compact ? 'ds-theme-compact' : ''}`}>
      {!compact ? <span className="ds-theme-label">اللون الأساسي</span> : null}
      <div className="ds-theme-swatches">
        {THEME_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ds-theme-swatch ${accent.toLowerCase() === c.hex.toLowerCase() ? 'ds-theme-swatch-active' : ''}`}
            style={{ background: c.hex }}
            title={c.label}
            aria-label={c.label}
            onClick={() => setAccent(c.hex)}
          />
        ))}
      </div>
    </div>
  );
}
