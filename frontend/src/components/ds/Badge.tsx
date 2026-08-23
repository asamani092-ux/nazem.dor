type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

const toneClass: Record<Tone, string> = {
  primary: 'ds-badge ds-badge-primary',
  success: 'ds-badge ds-badge-success',
  warning: 'ds-badge ds-badge-warning',
  danger: 'ds-badge ds-badge-danger',
  info: 'ds-badge ds-badge-info',
};

export function Badge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={toneClass[tone]}>{children}</span>;
}
