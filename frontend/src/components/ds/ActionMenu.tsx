import { useEffect, useRef, type ReactNode } from 'react';
import { IconMore } from './Icons';

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  onClick?: () => void;
  href?: string;
};

export function ActionMenu({
  items,
  open,
  onToggle,
  onClose,
}: {
  items: ActionMenuItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  return (
    <div className="ds-action-menu" ref={ref}>
      <button type="button" className="ds-icon-btn ds-icon-btn-muted" onClick={onToggle} aria-label="إجراءات">
        <IconMore />
      </button>
      {open ? (
        <div className="ds-action-menu-panel">
          {items.map((item) => {
            const cls = `ds-action-menu-item ${item.tone === 'danger' ? 'ds-action-menu-danger' : ''}`;
            if (item.href) {
              return (
                <a key={item.key} className={cls} href={item.href} target="_blank" rel="noreferrer" onClick={onClose}>
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              );
            }
            return (
              <button key={item.key} type="button" className={cls} onClick={() => { item.onClick?.(); onClose(); }}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function IconButton({
  label,
  tone = 'muted',
  onClick,
  href,
  children,
}: {
  label: string;
  tone?: 'primary' | 'wa' | 'report' | 'edit' | 'alert' | 'delete' | 'muted';
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls = `ds-icon-btn ds-icon-btn-${tone}`;
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer" title={label} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  );
}
