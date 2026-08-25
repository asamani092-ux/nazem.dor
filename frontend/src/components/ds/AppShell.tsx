import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, IconClose, IconLogout, IconMenu } from './Charts';
import { ThemeSwitcher } from './ThemeSwitcher';
import logoDor from '../../assets/logoDor.png';

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

  useEffect(() => {
    if (!desktop && open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [desktop, open]);

  function toggleMenu() {
    if (desktop) setCollapsed((c) => !c);
    else setOpen((o) => !o);
  }

  function closeMobile() {
    if (!desktop) setOpen(false);
  }

  const showLabels = desktop ? !collapsed : true;
  const mobileVisible = !desktop && open;

  return (
    <div className="ds-app" dir="rtl">
      <header className="ds-brandbar">
        <div className="ds-brandbar-theme">
          <ThemeSwitcher compact corner />
        </div>
        <button type="button" className="ds-brandbar-menu" onClick={toggleMenu} aria-label={mobileVisible ? 'إغلاق القائمة' : 'القائمة'} aria-expanded={desktop ? !collapsed : open}>
          {mobileVisible ? <IconClose /> : <IconMenu />}
        </button>
        <span className="ds-logo-badge ds-logo-badge-header">
          <img src={logoDor} alt="الدور النسائية" className="ds-brandbar-logo" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="ds-brandbar-title">{title}</div>
          {subtitle ? <div className="ds-brandbar-sub">{subtitle}</div> : null}
        </div>
      </header>

      {mobileVisible ? <div className="ds-backdrop" onClick={closeMobile} aria-hidden /> : null}

      <div className={`ds-layout ${desktop ? 'ds-layout-desktop' : ''}`}>
        <aside
          className={`ds-sidebar ${mobileVisible ? 'ds-sidebar-open' : ''} ${desktop && collapsed ? 'ds-sidebar-collapsed' : ''} ${desktop ? 'ds-sidebar-desk' : 'ds-sidebar-mobile'}`}
          aria-hidden={!desktop && !open}
        >
          {!desktop ? (
            <div className="ds-sidebar-close-row">
              <button type="button" className="ds-sidebar-close" onClick={closeMobile} aria-label="إغلاق القائمة">
                <IconClose />
              </button>
            </div>
          ) : null}
          {mobileVisible || (desktop && !collapsed) ? (
            <div className="ds-sidebar-logo-wrap">
              <span className="ds-logo-badge ds-logo-badge-sidebar">
                <img src={logoDor} alt="الدور النسائية" className="ds-sidebar-logo" />
              </span>
            </div>
          ) : null}
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
                    closeMobile();
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
