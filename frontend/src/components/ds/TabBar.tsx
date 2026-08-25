import type { ReactNode } from 'react';

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: Array<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={`ds-tabs w-full ${className}`}>
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`ds-tab ${active === key ? 'ds-tab-active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({
  mode,
  onTable,
  onCards,
  onStats,
}: {
  mode: 'table' | 'cards' | 'stats';
  onTable: () => void;
  onCards: () => void;
  onStats?: () => void;
}) {
  return (
    <div className="ds-view-toggle">
      <button type="button" className={`ds-view-btn ${mode === 'table' ? 'ds-view-btn-active' : ''}`} onClick={onTable}>
        جدول
      </button>
      <button type="button" className={`ds-view-btn ${mode === 'cards' ? 'ds-view-btn-active' : ''}`} onClick={onCards}>
        بطاقات
      </button>
      {onStats ? (
        <button type="button" className={`ds-view-btn ${mode === 'stats' ? 'ds-view-btn-active' : ''}`} onClick={onStats}>
          مؤشرات
        </button>
      ) : null}
    </div>
  );
}
