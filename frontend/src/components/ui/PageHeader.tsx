import type { ReactNode } from 'react';
import { Button } from './Button';

export function PageHeader({
  title,
  subtitle,
  meta,
  onLogout,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onLogout: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-ios-border bg-white/95 backdrop-blur-md">
      <div className="page-pad pt-8 sm:pt-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-right">
            {subtitle ? <p className="mb-1 text-[10px] font-bold text-ios-muted">{subtitle}</p> : null}
            <h1 className="text-xl font-extrabold text-primary sm:text-2xl">{title}</h1>
            {meta ? <p className="mt-1 text-[9px] font-bold text-gray-400 sm:text-[10px]">{meta}</p> : null}
          </div>
          <Button variant="danger" size="sm" onClick={onLogout} className="shrink-0 rounded-full">
            خروج
          </Button>
        </div>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
      </div>
    </header>
  );
}
