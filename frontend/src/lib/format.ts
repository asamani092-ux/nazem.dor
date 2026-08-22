/** أرقام الواجب بدون كسر زائد (5.0 → 5). النصوص تبقى كما هي. O(1) زمن/مكان */
export function formatHomework(value: string): string {
  const t = String(value ?? '').trim();
  if (!t) return t;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return t;
  const n = Number(t);
  if (!Number.isFinite(n)) return t;
  return Number.isInteger(n) ? String(n) : String(n);
}
