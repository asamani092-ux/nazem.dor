import type { ReactNode, SVGProps } from 'react';

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letter = (name || '?').trim().charAt(0) || '?';
  return (
    <div
      className="ds-avatar"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      aria-hidden
    >
      {letter}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'ابحث…',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  return (
    <div className="ds-search">
      <IconSearch className="ds-search-icon" />
      <input
        className="ds-input ds-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
      />
    </div>
  );
}

export function ProgressBar({ label, pct, color }: { label: string; pct: number; color?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px] font-bold">
        <span>{label}</span>
        <span className="text-ios-muted">{p}%</span>
      </div>
      <div className="ds-progress-track">
        <div className="ds-progress-fill" style={{ width: `${p}%`, background: color || 'var(--color-primary)' }} />
      </div>
    </div>
  );
}

export function RingStat({ label, pct }: { label: string; pct: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="text-center">
      <div
        className="ds-ring"
        style={{ background: `conic-gradient(var(--color-primary) ${p * 3.6}deg, #F2F2F7 0)` }}
      >
        <div className="ds-ring-inner">{p}%</div>
      </div>
      <div className="mt-2 text-xs text-ios-muted">{label}</div>
    </div>
  );
}

export function BarChart({
  items,
}: {
  items: Array<{ label: string; pct: number }>;
}) {
  return (
    <div className="ds-bars">
      {items.map((b) => {
        const p = Math.max(0, Math.min(100, Math.round(b.pct)));
        return (
          <div key={b.label} className="ds-bar-col">
            <span className="text-[12px] font-extrabold text-primary">{p}%</span>
            <div className="ds-bar-fill" style={{ height: `${Math.max(6, p)}%` }} />
            <span className="text-center text-[10px] text-ios-muted">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({ points, color = 'var(--color-primary)' }: { points: number[]; color?: string }) {
  const sw = 120;
  const sh = 32;
  const sp = 3;
  if (!points.length) return null;
  const mx = Math.max(...points);
  const mn = Math.min(...points);
  const rng = mx - mn || 1;
  const cs = points.map((v, i) => {
    const x = sp + (i * (sw - sp * 2)) / Math.max(1, points.length - 1);
    const y = sh - sp - ((v - mn) / rng) * (sh - sp * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${sw} ${sh}`} className="h-8 w-full" aria-hidden>
      <polyline points={cs.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function LineTrend({ points, color = 'var(--color-primary)' }: { points: number[]; color?: string }) {
  const w = 260;
  const h = 90;
  const pad = 6;
  if (!points.length) return null;
  const maxV = Math.max(100, ...points);
  const coords = points.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
    const y = h - pad - (v / maxV) * (h - pad * 2);
    return [x, y] as const;
  });
  const poly = coords.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const area = `M${coords[0][0].toFixed(1)},${h - pad} L${poly.split(' ').join(' L')} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" aria-hidden>
      <path d={area} fill={color} opacity={0.1} />
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r={3} fill="#fff" stroke={color} strokeWidth={2} />
      ))}
    </svg>
  );
}

export function EmptyState({ title = 'لا توجد نتائج', hint = 'لم يتم العثور على بيانات مطابقة.' }: { title?: string; hint?: string }) {
  return (
    <div className="ds-empty">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-shell text-xl font-extrabold text-ios-muted">؟</div>
      <div className="font-bold">{title}</div>
      <div className="mt-1 text-xs text-ios-muted">{hint}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-xl font-extrabold text-primary sm:text-2xl">{children}</h2>
      {action}
    </div>
  );
}
