import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, IconLogout, IconMenu } from './Charts';

export type ShellNavItem = {
  key: string;
  label: string;
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_MASTER: 'مدير النظام',
  MASTER: 'مشرفة عامة',
  MANAGER: 'مديرة دار',
  TEACHER: 'معلمة',
};

export function AppShell({
  title,
  subtitle,
  userName,
  userRole,
  contextLine,
  nav,
  active,
  onNav,
  onLogout,
  children,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  userRole: string;
  contextLine?: string;
  nav: ShellNavItem[];
  active: string;
  onNav: (key: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const d = window.innerWidth >= 900;
      setDesktop(d);
      if (d) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function toggleMenu() {
    if (desktop) setCollapsed((c) => !c);
    else setOpen((o) => !o);
  }

  const showLabels = desktop ? !collapsed : true;
  const sidebarOpen = desktop || open;

  return (
    <div className="ds-app" dir="rtl">
      <header className="ds-brandbar">
        <button type="button" className="ds-brandbar-menu" onClick={toggleMenu} aria-label="القائمة">
          <IconMenu />
        </button>
        <img src="/logo.png" alt="" className="ds-brandbar-logo" />
        <div className="min-w-0 flex-1">
          <div className="ds-brandbar-title">{title}</div>
          {subtitle ? <div className="ds-brandbar-sub">{subtitle}</div> : null}
        </div>
      </header>

      {!desktop && open ? <div className="ds-backdrop" onClick={() => setOpen(false)} /> : null}

      <div className={`ds-layout ${desktop ? 'ds-layout-desktop' : ''}`}>
        <aside
          className={`ds-sidebar ${sidebarOpen ? 'ds-sidebar-open' : ''} ${desktop && collapsed ? 'ds-sidebar-collapsed' : ''} ${desktop ? 'ds-sidebar-desk' : 'ds-sidebar-mobile'}`}
        >
          <div className={`ds-sidebar-user ${!showLabels ? 'justify-center' : ''}`}>
            <Avatar name={userName} size={40} />
            {showLabels ? (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ios-text">{userName}</div>
                <div className="truncate text-[11px] text-ios-muted">
                  {ROLE_LABEL[userRole] || userRole}
                  {contextLine ? ` — ${contextLine}` : ''}
                </div>
              </div>
            ) : null}
          </div>
          <div className="ds-sidebar-divider" />
          <nav className="ds-sidebar-nav">
            {nav.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`ds-nav-item ${isActive ? 'ds-nav-item-active' : ''}`}
                  onClick={() => {
                    onNav(item.key);
                    if (!desktop) setOpen(false);
                  }}
                  title={item.label}
                >
                  <span className={`ds-nav-dot ${isActive ? 'ds-nav-dot-active' : ''}`} />
                  {showLabels ? <span className="truncate">{item.label}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="ds-sidebar-footer">
            <div className="ds-sidebar-divider" />
            <button type="button" className="ds-logout" onClick={onLogout} title="تسجيل خروج">
              <IconLogout />
              {showLabels ? <span>تسجيل خروج</span> : null}
            </button>
          </div>
        </aside>

        <main className="ds-main">
          <div className="ds-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
