import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'success'
  | 'danger-soft'
  | 'chip-edit'
  | 'chip-wa'
  | 'chip-report'
  | 'chip-alert'
  | 'chip-primary'
  | 'chip-delete'
  | 'logout';

const map: Record<Variant, string> = {
  primary: 'ds-btn ds-btn-primary',
  secondary: 'ds-btn ds-btn-secondary',
  outline: 'ds-btn ds-btn-outline',
  ghost: 'ds-btn ds-btn-ghost',
  success: 'ds-btn ds-btn-success',
  'danger-soft': 'ds-btn ds-btn-danger-soft',
  'chip-edit': 'ds-chip ds-chip-edit',
  'chip-wa': 'ds-chip ds-chip-wa',
  'chip-report': 'ds-chip ds-chip-report',
  'chip-alert': 'ds-chip ds-chip-alert',
  'chip-primary': 'ds-chip ds-chip-primary',
  'chip-delete': 'ds-chip ds-chip-delete',
  logout: 'ds-btn ds-btn-pill-logout',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button type="button" className={`${map[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
