import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean; children: ReactNode }) {
  return (
    <div className={`ds-card ${padded ? 'ds-card-pad' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}
