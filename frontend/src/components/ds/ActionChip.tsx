/** أزرار إجراءات ملوّنة حسب نظام تصميم ناظم (Cloud Design) */
export function ActionChip({
  label,
  tone,
  onClick,
  href,
}: {
  label: string;
  tone: 'edit' | 'wa' | 'report' | 'alert' | 'primary' | 'delete' | 'suspend' | 'info';
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    tone === 'edit'
      ? 'ds-chip ds-chip-edit'
      : tone === 'wa'
        ? 'ds-chip ds-chip-wa'
        : tone === 'report'
          ? 'ds-chip ds-chip-report'
          : tone === 'alert' || tone === 'suspend'
            ? 'ds-chip ds-chip-alert'
            : tone === 'delete'
              ? 'ds-chip ds-chip-delete'
              : tone === 'info'
                ? 'ds-chip'
                : 'ds-chip ds-chip-primary';

  const style =
    tone === 'info'
      ? { background: '#eff6ff', color: '#1d4ed8' }
      : undefined;

  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer" style={style}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} style={style}>
      {label}
    </button>
  );
}
