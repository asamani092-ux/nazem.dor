type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const toneClass: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  muted: 'bg-gray-100 text-gray-600',
};

export function Badge({
  children,
  tone = 'muted',
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold sm:text-[10px] ${toneClass[tone]} ${className}`}>
      {children}
    </span>
  );
}
