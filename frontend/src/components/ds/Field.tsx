import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="ds-field-label">{label}</label>
      {children}
      {error ? <p className="ds-field-error">{error}</p> : null}
    </div>
  );
}

export function Input({ className = '', error, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={`ds-input ${error ? 'ds-input-error' : ''} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`ds-select ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ds-textarea ${className}`} {...props} />;
}
