import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconMore } from './Icons';

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  onClick?: () => void;
  href?: string;
};

function placePanel(btn: DOMRect, panelWidth: number, panelHeight: number) {
  const margin = 6;
  let top = btn.bottom + margin;
  let left = btn.left;

  if (left + panelWidth > window.innerWidth - margin) {
    left = btn.right - panelWidth;
  }
  if (left < margin) left = margin;

  if (top + panelHeight > window.innerHeight - margin) {
    top = btn.top - panelHeight - margin;
  }
  if (top < margin) top = margin;

  return { top, left };
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setCoords(null);
      return;
    }

    function update() {
      if (!btnRef.current) return;
      const btn = btnRef.current.getBoundingClientRect();
      const measured = panelRef.current?.getBoundingClientRect();
      const panelWidth = measured?.width || 160;
      const panelHeight = measured?.height || items.length * 40 + 8;
      setCoords(placePanel(btn, panelWidth, panelHeight));
    }

    const btn = btnRef.current.getBoundingClientRect();
    setCoords(placePanel(btn, 160, items.length * 40 + 8));

    requestAnimationFrame(() => update());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  const panel =
    open && coords
      ? createPortal(
          <div
            ref={panelRef}
            className="ds-action-menu-panel ds-action-menu-panel-fixed"
            style={{ top: coords.top, left: coords.left }}
          >
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
                <button
                  key={item.key}
                  type="button"
                  className={cls}
                  onClick={() => {
                    item.onClick?.();
                    onClose();
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="ds-action-menu" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="ds-icon-btn ds-icon-btn-muted"
        onClick={onToggle}
        aria-label="إجراءات"
        aria-expanded={open}
      >
        <IconMore />
      </button>
      {panel}
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
