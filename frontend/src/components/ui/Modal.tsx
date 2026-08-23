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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-lg' : 'sm:max-w-sm'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ios-bg text-xl text-ios-muted"
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
