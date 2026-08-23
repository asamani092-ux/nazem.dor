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
}: {
  mode: 'table' | 'cards';
  onTable: () => void;
  onCards: () => void;
}) {
  return (
    <div className="ds-view-toggle">
      <button type="button" className={`ds-view-btn ${mode === 'table' ? 'ds-view-btn-active' : ''}`} onClick={onTable}>
        جدول
      </button>
      <button type="button" className={`ds-view-btn ${mode === 'cards' ? 'ds-view-btn-active' : ''}`} onClick={onCards}>
        بطاقات
      </button>
    </div>
  );
}
