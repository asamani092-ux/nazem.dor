import type { ReactNode } from 'react';
import { Button } from './Button';

export function AppChrome({
  title,
  subtitle,
  onLogout,
  children,
}: {
  title: string;
  subtitle?: string;
  onLogout: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="ds-chrome">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ds-brand-mark text-center text-[10px] font-extrabold leading-tight">
          ناظم
        </div>
        <div className="min-w-0 text-right">
          {subtitle ? <div className="ds-chrome-sub truncate">{subtitle}</div> : null}
          <div className="ds-chrome-title truncate">{title}</div>
        </div>
      </div>
      <Button variant="logout" onClick={onLogout}>
        خروج
      </Button>
      {children}
    </header>
  );
}

export function AppChromeBody({ children }: { children: ReactNode }) {
  return <div className="page-pad space-y-4 pb-10">{children}</div>;
}
