import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-primary-soft text-primary hover:bg-primary/10',
  ghost: 'bg-white text-primary border border-ios-border hover:bg-primary-soft',
  danger: 'bg-danger-soft text-danger hover:bg-danger/10',
  success: 'bg-success-soft text-success hover:bg-success/10',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-[10px] rounded-lg',
  md: 'px-3 py-2 text-xs rounded-xl',
  lg: 'px-4 py-3 text-sm rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
