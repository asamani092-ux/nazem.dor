import type { ReactNode } from 'react';

/** تسمية حقل ظاهرة فوق المدخل — لا تعتمد على placeholder وحدها */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold text-gray-500">{label}</label>
      {children}
    </div>
  );
}
