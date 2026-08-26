import { useEffect, useMemo, useState } from 'react';
import { Button, Card, SectionTitle } from '../components/ds';
import { useAuth } from '../auth';

const STORAGE_KEY = 'nazem_tools_audit_v3';

type ToolDef = { id: string; name: string; category: string };
type AuditEntry = { rating: number; notes: string };

const TOOLS: ToolDef[] = [
  { id: 'shell', name: 'AppShell / BrandBar / Sidebar', category: 'هيكل' },
  { id: 'theme', name: 'تبديل الثيم (ألوان)', category: 'هيكل' },
  { id: 'login', name: 'شاشة الدخول', category: 'هيكل' },
  { id: 'toast', name: 'Toast عائم', category: 'إشعارات' },
  { id: 'banner', name: 'Banner لافتة', category: 'إشعارات' },
  { id: 'notify-card', name: 'بطاقة إشعار', category: 'إشعارات' },
  { id: 'buttons', name: 'الأزرار', category: 'مكوّنات' },
  { id: 'badges', name: 'الشارات Badge', category: 'مكوّنات' },
  { id: 'cards', name: 'البطاقات Card', category: 'مكوّنات' },
  { id: 'table', name: 'الجداول DataTable', category: 'مكوّنات' },
  { id: 'icon-actions', name: 'إجراءات بالأيقونات', category: 'مكوّنات' },
  { id: 'action-menu', name: 'قائمة إجراءات ⋮', category: 'مكوّنات' },
  { id: 'modal', name: 'Modal / BottomSheet', category: 'مكوّنات' },
  { id: 'fields', name: 'الحقول والنماذج', category: 'مكوّنات' },
  { id: 'search', name: 'بحث ذكي + Pagination', category: 'مكوّنات' },
  { id: 'kpi', name: 'StatCard / KPI', category: 'مؤشرات' },
  { id: 'rings', name: 'RingStat', category: 'مؤشرات' },
  { id: 'progress', name: 'ProgressBar', category: 'مؤشرات' },
  { id: 'bars', name: 'BarChart / Sparkline', category: 'مؤشرات' },
  { id: 'export', name: 'تصدير Excel متعدد الأوراق', category: 'تقارير' },
  { id: 'print', name: 'طباعة RTL', category: 'تقارير' },
  { id: 'master-dars', name: 'صفحة الدور (Master)', category: 'صفحات' },
  { id: 'master-indicators', name: 'المؤشرات (Master)', category: 'صفحات' },
  { id: 'master-curriculum', name: 'المناهج (Master)', category: 'صفحات' },
  { id: 'master-accounts', name: 'الحسابات (Master)', category: 'صفحات' },
  { id: 'manager', name: 'صفحة المديرة', category: 'صفحات' },
  { id: 'teacher', name: 'صفحة المعلمة', category: 'صفحات' },
  { id: 'perms', name: 'الصلاحيات وتدفق البيانات', category: 'نظام' },
  { id: 'tracking', name: 'رصد الطالبات', category: 'صفحات' },
  { id: 'calendar', name: 'تقويم الزيارات والاختبارات', category: 'صفحات' },
  { id: 'excel-import', name: 'استيراد Excel للطالبات', category: 'صفحات' },
  { id: 'file-upload', name: 'رفع ملف DS', category: 'مكوّنات' },
  { id: 'exams', name: 'مركز الاختبارات', category: 'صفحات' },
];

const TOOL_HELP: Partial<Record<string, string>> = {
  banner: 'جرّبي إجراء حفظ أو تعديل؛ تظهر اللافتة أعلى الصفحة بعد نجاح الإجراء أو فشله.',
  'notify-card': 'تظهر بطاقة الإشعار في تبويب التنبيهات لدى المديرة والمعلمة.',
  'file-upload': 'جرّبي رفع مرفق في رصد المعلمة، أو ملف الطالبات في الاستيراد لدى المديرة.',
};

function parseStored(raw: string | null): Record<string, AuditEntry> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, AuditEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadStored(): Record<string, AuditEntry> {
  const current = parseStored(localStorage.getItem(STORAGE_KEY));
  if (Object.keys(current).length) return current;
  const legacy = {
    ...parseStored(localStorage.getItem('nazem_tools_audit_v2')),
    ...parseStored(localStorage.getItem('nazem_tools_audit_v1')),
  };
  if (Object.keys(legacy).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
  }
  return legacy;
}

function mergeAudit(stored: Record<string, AuditEntry>): Record<string, AuditEntry> {
  const next: Record<string, AuditEntry> = { ...stored };
  for (const t of TOOLS) {
    if (!next[t.id]) next[t.id] = { rating: 0, notes: '' };
  }
  return next;
}

export function ToolsAuditPanel() {
  const { user } = useAuth();
  const [audit, setAudit] = useState<Record<string, AuditEntry>>(() => mergeAudit(loadStored()));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(audit));
  }, [audit]);

  const report = useMemo(() => {
    const lines = ['# تقرير تقييم أدوات ناظم الصغار', `التاريخ: ${new Date().toLocaleString('ar-SA')}`, `المقيّم: ${user?.name || ''}`, ''];
    const byCat = new Map<string, ToolDef[]>();
    for (const t of TOOLS) {
      const list = byCat.get(t.category) || [];
      list.push(t);
      byCat.set(t.category, list);
    }
    for (const [cat, list] of byCat) {
      lines.push(`## ${cat}`);
      for (const t of list) {
        const e = audit[t.id];
        lines.push(`- **${t.name}**: ${e?.rating ? `${e.rating}/5` : '—'}${e?.notes ? ` — ${e.notes}` : ''}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }, [audit, user?.name]);

  function setRating(id: string, rating: number) {
    setAudit((prev) => ({ ...prev, [id]: { ...prev[id], rating } }));
  }

  function setNotes(id: string, notes: string) {
    setAudit((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));
  }

  async function copyReport() {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function resetAudit() {
    if (!confirm('مسح كل التقييم والبدء من جديد؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('nazem_tools_audit_v2');
    localStorage.removeItem('nazem_tools_audit_v1');
    setAudit(mergeAudit({}));
    setCopied(false);
  }

  const categories = [...new Set(TOOLS.map((t) => t.category))];

  return (
    <>
      <SectionTitle
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="!w-auto" onClick={resetAudit}>
              مسح التقييم
            </Button>
            <Button variant="primary" className="!w-auto" onClick={() => void copyReport()}>
              {copied ? 'تم النسخ' : 'نسخ التقرير'}
            </Button>
          </div>
        }
      >
        تقييم الأدوات
      </SectionTitle>
      <Card className="space-y-2 text-sm text-ios-muted">
        <p className="font-bold text-ios-text">ما هذا التبويب؟</p>
        <p>
          قائمة مراجعة داخلية لمكوّنات الواجهة (أزرار، جداول، صفحات…) — ليس أدوات خارجية.
          اختبري كل عنصر وقيّميه من 1–5 ثم انسخي التقرير. يُحذف هذا التبويب قبل النشر.
        </p>
      </Card>
      {categories.map((cat) => (
        <Card key={cat} className="space-y-3">
          <h3 className="font-extrabold text-primary">{cat}</h3>
          {TOOLS.filter((t) => t.category === cat).map((t) => {
            const e = audit[t.id];
            return (
              <div key={t.id} className="rounded-xl bg-shell p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold">{t.name}</span>
                    {TOOL_HELP[t.id] ? <p className="mt-1 text-xs text-ios-muted">{TOOL_HELP[t.id]}</p> : null}
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`ds-rate-btn ${e.rating >= n ? 'ds-rate-active' : ''}`}
                        onClick={() => setRating(t.id, n)}
                        aria-label={`${n} من 5`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="ds-input min-h-[60px] text-sm"
                  placeholder="ملاحظات..."
                  value={e.notes}
                  onChange={(ev) => setNotes(t.id, ev.target.value)}
                />
              </div>
            );
          })}
        </Card>
      ))}
      <Card className="text-xs text-ios-muted whitespace-pre-wrap font-mono">{report}</Card>
    </>
  );
}
