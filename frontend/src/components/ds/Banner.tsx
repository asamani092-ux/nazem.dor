export function Banner({
  tone,
  children,
  onClose,
}: {
  tone: 'success' | 'error' | 'info';
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const toneClass =
    tone === 'success' ? 'ds-banner ds-banner-success' : tone === 'error' ? 'ds-banner ds-banner-error' : 'ds-banner ds-banner-info';
  const dotColor =
    tone === 'success' ? '#16a34a' : tone === 'error' ? '#ef4444' : '#3b82f6';
  return (
    <div className={`${toneClass} whitespace-pre-wrap`}>
      <span className="ds-banner-dot" style={{ background: dotColor }} />
      <span className="flex-1">{children}</span>
      {onClose ? (
        <button type="button" className="text-xs opacity-70" onClick={onClose}>إغلاق</button>
      ) : null}
    </div>
  );
}
