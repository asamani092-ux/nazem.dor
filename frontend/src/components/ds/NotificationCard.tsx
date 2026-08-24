import type { ReactNode } from 'react';

export function NotificationCard({
  title,
  date,
  content,
  isRead,
  actions,
  borderTone = 'primary',
}: {
  title: string;
  date?: string;
  content?: ReactNode;
  isRead?: boolean;
  borderTone?: 'primary' | 'info';
  actions?: ReactNode;
}) {
  return (
    <div className={`ds-notify-card ${isRead ? 'ds-notify-read' : ''} ds-notify-${borderTone}`}>
      <div className="flex justify-between items-center gap-2">
        <span className="font-extrabold text-sm">{title}</span>
        {date ? <span className="text-[11px] text-ios-muted">{date}</span> : null}
      </div>
      {content ? <div className="mt-1.5 text-[13px] text-ios-text leading-relaxed">{content}</div> : null}
      {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
