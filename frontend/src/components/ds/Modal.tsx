import type { ReactNode } from 'react';

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="ds-overlay flex items-end justify-center p-0 sm:items-center sm:p-5" onClick={onClose}>
      <div
        className={`ds-modal ${wide ? 'sm:max-w-lg' : ''}`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-shell text-xl text-ios-muted"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="ds-overlay flex items-end justify-center" onClick={onClose}>
      <div className="ds-sheet" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="ds-sheet-handle" />
        <div className="mb-3 text-lg font-extrabold text-primary">{title}</div>
        {children}
      </div>
    </div>
  );
}
