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
      <div className="min-w-0 text-right">
        {subtitle ? <div className="ds-chrome-sub">{subtitle}</div> : null}
        <div className="ds-chrome-title">{title}</div>
      </div>
      <Button variant="logout" onClick={onLogout}>خروج</Button>
      {children ? <div className="hidden">{children}</div> : null}
    </header>
  );
}

export function AppChromeBody({ children }: { children: ReactNode }) {
  return <div className="page-pad space-y-4 pb-10">{children}</div>;
}
