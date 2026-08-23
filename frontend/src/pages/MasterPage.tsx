import { useEffect, useMemo, useState } from 'react';
import { api, waLink } from '../lib/api';
import { formatHomework } from '../lib/format';
import { useAuth } from '../auth';
import { downloadCsv } from '../lib/reports';
import { Field } from '../components/Field';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

type Dar = {
  id: string;
  name: string;
  curriculum: string;
  managerName: string;
  managerPhone: string;
  location: string;
  status: string;
};

type Indicators = {
  darsTotal: number;
  darsActive: number;
  classesCount: number;
  teachersCount: number;
  studentsActive: number;
  studentsTotal: number;
  examsCount: number;
  attendanceRate: number;
  completionRate: number;
  homeworkRate: number;
  overallRate: number;
  byCurriculum: { tibyan: number; qari: number; both: number };
  perDar: Array<{
    id: string;
    name: string;
    curriculum: string;
    status: string;
    activeStudents: number;
    classesCount: number;
    attendanceRate: number;
    completionRate: number;
    homeworkRate: number;
    overallRate: number;
  }>;
};

type DarReport = {
  dar: { name: string; curriculum: string; managerName: string; allowedLevels: string[] };
  summary: {
    totalStudents: number;
    activeStudents: number;
    classesCount: number;
    attendanceRate: number;
    completionRate: number;
    homeworkRate: number;
    overallRate: number;
  };
  students: Array<Record<string, unknown>>;
  examGrades: Array<Record<string, unknown>>;
};

type CurriculumRow = {
  id: string;
  level: string;
  week: number;
  day: string;
  educational: string;
  homework: string;
  tarbawi: string;
};

type WeekSlot = {
  day: string;
  plan: CurriculumRow | null;
};

type Tab = 'dars' | 'indicators' | 'curriculum' | 'accounts';
type PlanViewMode = 'table' | 'cards';
type AccountFilter = 'ALL' | 'MASTER' | 'MANAGER' | 'TEACHER' | 'STUDENT';

type AccountRow = {
  id: string;
  kind: 'USER' | 'STUDENT';
  type: string;
  typeLabel: string;
  name: string;
  phone: string;
  status: string;
  darId: string | null;
  darName: string;
  classId: string | null;
  className: string;
};

type UsersMeta = {
  dars: Array<{ id: string; name: string; classes: Array<{ id: string; name: string; level: string; darId: string }> }>;
};

const CURRICULUM_LEVELS = ['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'] as const;
const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as const;

/** Time O(n) scan plans + O(1) build 5 day slots. Space O(1) for slots. */
function buildWeekSlots(plans: CurriculumRow[], level: string, week: number): WeekSlot[] {
  const byDay = new Map<string, CurriculumRow>();
  for (const p of plans) {
    if (p.level === level && p.week === week) byDay.set(p.day, p);
  }
  return WEEK_DAYS.map((day) => ({ day, plan: byDay.get(day) || null }));
}

export function MasterPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('dars');
  const [dars, setDars] = useState<Dar[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editDar, setEditDar] = useState<Dar | null>(null);
  const [showExam, setShowExam] = useState(false);
  const [report, setReport] = useState<DarReport | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);
  const [curriculumLoaded, setCurriculumLoaded] = useState(false);
  const [indicatorsLoaded, setIndicatorsLoaded] = useState(false);
  const [planViewLevel, setPlanViewLevel] = useState<string>('تمهيدي 1');
  const [planViewWeek, setPlanViewWeek] = useState(1);
  const [planViewMode, setPlanViewMode] = useState<PlanViewMode>('table');
  const [planMenuDay, setPlanMenuDay] = useState<string | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planEditorMode, setPlanEditorMode] = useState<'add' | 'edit'>('add');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('ALL');
  const [accountSearch, setAccountSearch] = useState('');
  const [usersMeta, setUsersMeta] = useState<UsersMeta | null>(null);
  const [accountMenuId, setAccountMenuId] = useState<string | null>(null);
  const [showAccountEditor, setShowAccountEditor] = useState(false);
  const [accountEditorMode, setAccountEditorMode] = useState<'add' | 'edit'>('add');
  const [accountForm, setAccountForm] = useState({
    kind: 'USER' as 'USER' | 'STUDENT',
    type: 'MASTER' as 'MASTER' | 'MANAGER' | 'TEACHER' | 'STUDENT',
    id: '',
    name: '',
    phone: '',
    darId: '',
    classId: '',
  });
  const [form, setForm] = useState({
    name: '',
    curriculum: 'منهج تبيان',
    managerName: '',
    managerPhone: '',
    location: '',
  });
  const [exam, setExam] = useState({ targetDarId: 'الكل', date: '', link: '', title: '' });
  const [alertForm, setAlertForm] = useState({ darId: '', title: '', content: '', kind: 'NOTICE' });
  const [planForm, setPlanForm] = useState({
    level: 'تمهيدي 1',
    week: 1,
    day: 'الأحد',
    educational: '',
    homework: '',
    tarbawi: '',
  });

  const filtered = useMemo(() => dars.filter((d) => d.name.includes(q.trim())), [dars, q]);
  const maxWeek = useMemo(() => {
    let m = 1;
    for (const p of curriculum) {
      if (p.level === planViewLevel && p.week > m) m = p.week;
    }
    return Math.max(m, 1);
  }, [curriculum, planViewLevel]);
  const weekSlots = useMemo(
    () => buildWeekSlots(curriculum, planViewLevel, planViewWeek),
    [curriculum, planViewLevel, planViewWeek],
  );
  const weekFilled = useMemo(() => weekSlots.filter((s) => s.plan).length, [weekSlots]);

  async function load() {
    setBusy(true);
    try {
      const res = await api<{ data: Dar[] }>('/api/master/dars');
      setDars(res.data);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  }

  async function loadIndicators(force = false) {
    if (indicatorsLoaded && !force) return;
    const res = await api<{ data: Indicators }>('/api/master/indicators');
    setIndicators(res.data);
    setIndicatorsLoaded(true);
  }

  async function loadCurriculum(force = false) {
    if (curriculumLoaded && !force) return;
    const res = await api<{ data: CurriculumRow[] }>('/api/master/curriculum');
    setCurriculum(res.data);
    setCurriculumLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab === 'indicators') void loadIndicators().catch((e) => setMsg(e.message));
    if (tab === 'curriculum') void loadCurriculum().catch((e) => setMsg(e.message));
    if (tab === 'accounts' && user?.role === 'SUPER_MASTER') {
      void loadUsersMeta().catch((e) => setMsg(e.message));
    }
  }, [tab, user?.role]);

  useEffect(() => {
    if (tab !== 'accounts' || user?.role !== 'SUPER_MASTER') return;
    const t = setTimeout(() => {
      void loadAccounts().catch((e) => setMsg(e.message));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- بحث مؤجّل فقط
  }, [tab, accountFilter, accountSearch, user?.role]);

  async function loadAccounts() {
    const params = new URLSearchParams({ type: accountFilter });
    if (accountSearch.trim()) params.set('search', accountSearch.trim());
    const res = await api<{ data: AccountRow[] }>(`/api/master/users?${params}`);
    setAccounts(res.data);
  }

  async function loadUsersMeta() {
    const res = await api<{ data: UsersMeta }>('/api/master/users/meta');
    setUsersMeta(res.data);
  }

  async function addDar() {
    setBusy(true);
    try {
      const res = await api<{ message: string }>('/api/master/dars', { method: 'POST', json: form });
      setMsg(res.message || 'تمت الإضافة');
      setShowAdd(false);
      setForm({ name: '', curriculum: 'منهج تبيان', managerName: '', managerPhone: '', location: '' });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  }

  async function saveEditDar() {
    if (!editDar) return;
    await api(`/api/master/dars/${editDar.id}`, {
      method: 'PUT',
      json: {
        name: editDar.name,
        curriculum: editDar.curriculum,
        managerName: editDar.managerName,
        managerPhone: editDar.managerPhone,
        location: editDar.location,
        status: editDar.status === 'معلق' ? 'معلق' : 'نشط',
      },
    });
    setEditDar(null);
    setMsg('تم تحديث الدار');
    await load();
  }

  async function deleteDar(id: string) {
    if (!confirm('حذف الدار؟')) return;
    await api(`/api/master/dars/${id}`, { method: 'DELETE' });
    await load();
  }

  async function suspendToggle(dar: Dar) {
    await api(`/api/master/dars/${dar.id}`, {
      method: 'PUT',
      json: {
        name: dar.name,
        curriculum: dar.curriculum,
        managerName: dar.managerName,
        managerPhone: dar.managerPhone,
        location: dar.location,
        status: dar.status === 'معلق' ? 'نشط' : 'معلق',
      },
    });
    await load();
  }

  async function openReport(id: string) {
    const res = await api<{ data: DarReport }>(`/api/master/dars/${id}/report`);
    setReport(res.data);
  }

  async function showStats(id: string) {
    const res = await api<{
      data: {
        totalStudents: number;
        activeStudents: number;
        classesCount: number;
        attendanceRate: number;
        completionRate: number;
        homeworkRate: number;
        overallRate: number;
        classBreakdown: Array<{ name: string; level: string; studentCount: number; overallRate: number }>;
      };
    }>(`/api/master/dars/${id}/stats`);
    const d = res.data;
    const lines = (d.classBreakdown || [])
      .slice(0, 8)
      .map((c) => `• ${c.name} (${c.level}): ${c.studentCount} طالبة | عام %${c.overallRate}`)
      .join('\n');
    setMsg(
      `طالبات: ${d.totalStudents} | نشطات: ${d.activeStudents} | فصول: ${d.classesCount}\n` +
        `حضور %${d.attendanceRate} | إنجاز %${d.completionRate} | واجب %${d.homeworkRate} | عام %${d.overallRate}\n` +
        (lines ? `\nتفصيل الفصول:\n${lines}` : ''),
    );
  }

  async function saveExam() {
    if (!exam.title.trim() || exam.title.trim().length < 2) return setMsg('عنوان الاختبار مطلوب');
    if (!exam.date || !exam.link) return setMsg('أكمل التاريخ والرابط');
    await api('/api/master/exams', { method: 'POST', json: exam });
    setShowExam(false);
    setExam({ targetDarId: 'الكل', date: '', link: '', title: '' });
    setMsg('تم نشر الاختبار');
  }

  async function sendAlert() {
    await api('/api/master/alerts', { method: 'POST', json: alertForm });
    setAlertForm({ darId: '', title: '', content: '', kind: 'NOTICE' });
    setMsg('تم إرسال الإشعار');
  }

  function openAddAccount(type: 'MASTER' | 'MANAGER' | 'TEACHER' | 'STUDENT' = 'MASTER') {
    setAccountEditorMode('add');
    setAccountForm({
      kind: type === 'STUDENT' ? 'STUDENT' : 'USER',
      type,
      id: '',
      name: '',
      phone: '',
      darId: usersMeta?.dars[0]?.id || '',
      classId: usersMeta?.dars[0]?.classes[0]?.id || '',
    });
    setAccountMenuId(null);
    setShowAccountEditor(true);
  }

  function openEditAccount(row: AccountRow) {
    setAccountEditorMode('edit');
    setAccountForm({
      kind: row.kind,
      type: (row.type === 'STUDENT' ? 'STUDENT' : row.type) as 'MASTER' | 'MANAGER' | 'TEACHER' | 'STUDENT',
      id: row.id,
      name: row.name,
      phone: row.phone,
      darId: row.darId || '',
      classId: row.classId || '',
    });
    setAccountMenuId(null);
    setShowAccountEditor(true);
  }

  async function saveAccount() {
    if (!accountForm.name.trim() || !accountForm.phone.trim()) {
      setMsg('الاسم والجوال مطلوبان');
      return;
    }
    if (accountEditorMode === 'add') {
      const res = await api<{ message: string }>('/api/master/users', {
        method: 'POST',
        json: {
          type: accountForm.type,
          name: accountForm.name,
          phone: accountForm.phone,
          darId: accountForm.darId || undefined,
          classId: accountForm.classId || undefined,
        },
      });
      setMsg(res.message || 'تمت الإضافة');
    } else {
      await api(`/api/master/users/${accountForm.id}`, {
        method: 'PUT',
        json: {
          kind: accountForm.kind,
          name: accountForm.name,
          phone: accountForm.phone,
          darId: accountForm.darId || undefined,
          classId: accountForm.classId || undefined,
        },
      });
      setMsg('تم تحديث الحساب');
    }
    setShowAccountEditor(false);
    await loadAccounts();
  }

  async function setAccountStatus(row: AccountRow, status: 'نشط' | 'معلق') {
    await api(`/api/master/users/${row.id}/status`, {
      method: 'POST',
      json: { kind: row.kind, status },
    });
    setAccountMenuId(null);
    await loadAccounts();
  }

  async function deleteAccount(row: AccountRow) {
    if (row.type === 'SUPER_MASTER') return setMsg('لا يمكن حذف مدير النظام');
    if (!confirm(`حذف ${row.typeLabel}: ${row.name}؟`)) return;
    await api(`/api/master/users/${row.id}?kind=${row.kind}`, {
      method: 'DELETE',
      json: { kind: row.kind },
    });
    setAccountMenuId(null);
    setMsg('تم الحذف');
    await loadAccounts();
  }

  const allClasses = useMemo(
    () => usersMeta?.dars.flatMap((d) => d.classes.map((c) => ({ ...c, darName: d.name }))) || [],
    [usersMeta],
  );

  async function savePlan() {
    if (!planForm.educational.trim()) {
      setMsg('الدرس التعليمي مطلوب');
      return;
    }
    const existed = curriculum.some(
      (p) => p.level === planForm.level && p.week === Number(planForm.week) && p.day === planForm.day,
    );
    await api('/api/master/curriculum', {
      method: 'POST',
      json: { ...planForm, week: Number(planForm.week), homework: formatHomework(planForm.homework) },
    });
    setMsg(existed || planEditorMode === 'edit' ? 'تم تحديث الخطة' : 'تمت إضافة الخطة');
    setShowPlanEditor(false);
    setPlanMenuDay(null);
    setPlanViewLevel(planForm.level);
    setPlanViewWeek(Number(planForm.week));
    setCurriculumLoaded(false);
    await loadCurriculum(true);
  }

  function openAddPlan(day?: string) {
    setPlanEditorMode('add');
    setPlanForm({
      level: planViewLevel,
      week: planViewWeek,
      day: day || 'الأحد',
      educational: '',
      homework: '',
      tarbawi: '',
    });
    setPlanMenuDay(null);
    setShowPlanEditor(true);
  }

  function openEditPlan(plan: CurriculumRow) {
    setPlanEditorMode('edit');
    setPlanForm({
      level: plan.level,
      week: plan.week,
      day: plan.day,
      educational: plan.educational,
      homework: formatHomework(plan.homework),
      tarbawi: plan.tarbawi || '',
    });
    setPlanMenuDay(null);
    setShowPlanEditor(true);
  }

  async function deletePlan(plan: CurriculumRow) {
    if (!confirm(`حذف خطة ${plan.day} — أسبوع ${plan.week}؟`)) return;
    await api(`/api/master/curriculum/${plan.id}`, { method: 'DELETE' });
    setMsg('تم حذف الخطة');
    setPlanMenuDay(null);
    setCurriculumLoaded(false);
    await loadCurriculum(true);
  }

  function PlanActions({ slot }: { slot: WeekSlot }) {
    const open = planMenuDay === slot.day;
    return (
      <div className="relative">
        <button
          type="button"
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-primary"
          onClick={() => setPlanMenuDay(open ? null : slot.day)}
        >
          إجراءات
        </button>
        {open ? (
          <div className="absolute left-0 z-20 mt-1 min-w-[7.5rem] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
            {slot.plan ? (
              <>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-right text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                  onClick={() => openEditPlan(slot.plan!)}
                >
                  تعديل
                </button>
                {user?.role === 'SUPER_MASTER' ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-right text-[11px] font-bold text-red-600 hover:bg-red-50"
                    onClick={() => void deletePlan(slot.plan!)}
                  >
                    حذف
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                className="block w-full px-3 py-2 text-right text-[11px] font-bold text-primary hover:bg-gray-50"
                onClick={() => openAddPlan(slot.day)}
              >
                إضافة
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-ios-border bg-white/95 backdrop-blur-md">
        <div className="page-pad pt-8 sm:pt-10">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">الإشراف العام</h1>
          <button onClick={logout} className="rounded-full bg-red-50 px-3 py-2 text-sm font-bold text-red-500">
            خروج
          </button>
        </div>
        <div className="mb-3 flex rounded-xl bg-gray-200 p-1 tab-scroll">
          {(
            [
              ['dars', 'الدور'],
              ['indicators', 'المؤشرات'],
              ['curriculum', 'المناهج'],
              ...(user?.role === 'SUPER_MASTER' ? ([['accounts', 'الحسابات']] as const) : []),
            ] as Array<readonly [Tab, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`min-w-0 flex-1 shrink-0 rounded-lg px-2 py-2 text-[10px] font-bold sm:text-[11px] ${tab === k ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'dars' ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="success" size="md" onClick={() => setShowAdd(true)}>
                إضافة دار
              </Button>
              <Button size="md" onClick={() => setShowExam(true)}>
                اختبار مركزي
              </Button>
            </div>
            <input className="ios-input text-sm" placeholder="ابحث عن دار..." aria-label="بحث عن دار" value={q} onChange={(e) => setQ(e.target.value)} />
          </>
        ) : null}
        </div>
      </header>

      {msg ? <AlertBanner message={msg} onClose={() => setMsg('')} /> : null}

      {tab === 'indicators' && indicators ? (
        <div className="page-pad space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['دور نشطة', indicators.darsActive],
              ['فصول', indicators.classesCount],
              ['معلمات', indicators.teachersCount],
              ['طالبات نشطات', indicators.studentsActive],
              ['حضور %', indicators.attendanceRate],
              ['إنجاز %', indicators.completionRate],
              ['واجب %', indicators.homeworkRate],
              ['عام %', indicators.overallRate],
              ['اختبارات', indicators.examsCount],
            ].map(([label, val]) => (
              <div key={String(label)} className="ios-card p-3 text-center">
                <p className="text-xl font-black text-primary">{val}</p>
                <p className="text-[10px] font-bold text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-bold text-gray-500">
            مناهج: تبيان {indicators.byCurriculum.tibyan} | قارئ {indicators.byCurriculum.qari} | كلاهما{' '}
            {indicators.byCurriculum.both}
          </p>
          <button
            className="btn-primary"
            onClick={() =>
              downloadCsv(
                'indicators-dars.csv',
                indicators.perDar.map((d) => ({
                  الدار: d.name,
                  المنهج: d.curriculum,
                  الحالة: d.status,
                  طالبات: d.activeStudents,
                  فصول: d.classesCount,
                  حضور: d.attendanceRate,
                  إنجاز: d.completionRate,
                  واجب: d.homeworkRate,
                  عام: d.overallRate,
                })),
              )
            }
          >
            تصدير مؤشرات الدور CSV
          </button>
          {indicators.perDar.map((d) => (
            <div key={d.id} className="ios-card p-4">
              <div className="mb-2 flex justify-between">
                <h3 className="font-bold">{d.name}</h3>
                <span className="text-[10px] font-bold">{d.curriculum}</span>
              </div>
              <p className="text-[11px] text-gray-600">
                طالبات {d.activeStudents} | فصول {d.classesCount} | حضور %{d.attendanceRate} | إنجاز %{d.completionRate} |
                واجب %{d.homeworkRate} | عام %{d.overallRate}
              </p>
              <button className="mt-2 text-[10px] font-bold text-primary" onClick={() => void openReport(d.id)}>
                تقرير الدار الكامل
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'curriculum' ? (
        <div className="page-pad space-y-4">
          <div className="ios-card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-primary">خطط المنهج</h3>
              <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-white" onClick={() => openAddPlan()}>
                إضافة يوم
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[9px] font-bold text-gray-400">المستوى</label>
                <select
                  className="ios-input py-2 text-sm"
                  value={planViewLevel}
                  onChange={(e) => {
                    setPlanViewLevel(e.target.value);
                    setPlanMenuDay(null);
                  }}
                >
                  {CURRICULUM_LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold text-gray-400">الأسبوع</label>
                <select
                  className="ios-input py-2 text-sm"
                  value={planViewWeek}
                  onChange={(e) => {
                    setPlanViewWeek(Number(e.target.value));
                    setPlanMenuDay(null);
                  }}
                >
                  {Array.from({ length: Math.max(maxWeek, planViewWeek) + 2 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      أسبوع {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex rounded-xl bg-gray-200 p-1">
              {(
                [
                  ['table', 'جدول'],
                  ['cards', 'بطاقات'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPlanViewMode(mode);
                    setPlanMenuDay(null);
                  }}
                  className={`flex-1 rounded-lg py-2 text-[11px] font-bold ${planViewMode === mode ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold text-gray-500">
              {planViewLevel} — أسبوع {planViewWeek}: {weekFilled} من {WEEK_DAYS.length} أيام
            </p>
            <p className="text-[9px] text-gray-400">الربط: تبيان ← تمهيدي | قارئ ← صفوف أولية | كلاهما ← الكل</p>
          </div>

          {planViewMode === 'table' ? (
            <div className="ios-card overflow-hidden">
              <div className="table-wrap">
                <table className="w-full min-w-[28rem] text-right text-[11px]">
                  <thead className="bg-gray-50 text-[10px] text-gray-500">
                    <tr>
                      <th className="p-2 font-bold">اليوم</th>
                      <th className="p-2 font-bold">التعليمي</th>
                      <th className="p-2 font-bold">الواجب</th>
                      <th className="p-2 font-bold">التربوي</th>
                      <th className="p-2 font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekSlots.map((slot) => (
                      <tr key={slot.day} className="border-t border-gray-100 align-top">
                        <td className="p-2 font-extrabold text-primary">{slot.day}</td>
                        {slot.plan ? (
                          <>
                            <td className="p-2 font-bold text-gray-700">{slot.plan.educational}</td>
                            <td className="p-2 text-gray-600">{formatHomework(slot.plan.homework) || '—'}</td>
                            <td className="p-2 text-gray-600">{slot.plan.tarbawi || '—'}</td>
                          </>
                        ) : (
                          <td colSpan={3} className="p-2 text-gray-400">
                            فارغ — لم تُسجَّل خطة
                          </td>
                        )}
                        <td className="p-2">
                          <PlanActions slot={slot} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {weekSlots.map((slot) => (
                <div key={slot.day} className={`ios-card p-3 ${slot.plan ? '' : 'border border-dashed border-gray-300 bg-gray-50/80'}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-primary">{slot.day}</p>
                      <p className="text-[9px] font-bold text-gray-400">
                        {planViewLevel} · أسبوع {planViewWeek}
                      </p>
                    </div>
                    <PlanActions slot={slot} />
                  </div>
                  {slot.plan ? (
                    <div className="space-y-1 text-[11px]">
                      <p>
                        <span className="font-bold text-gray-500">تعليمي: </span>
                        {slot.plan.educational}
                      </p>
                      <p>
                        <span className="font-bold text-gray-500">واجب: </span>
                        {formatHomework(slot.plan.homework) || '—'}
                      </p>
                      <p>
                        <span className="font-bold text-gray-500">تربوي: </span>
                        {slot.plan.tarbawi || '—'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] font-bold text-gray-400">لا توجد خطة — اختاري إضافة من الإجراءات</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'accounts' && user?.role === 'SUPER_MASTER' ? (
        <div className="page-pad space-y-4">
          <div className="ios-card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-primary">إدارة الحسابات</h3>
              <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-white" onClick={() => openAddAccount('MASTER')}>
                إضافة
              </button>
            </div>
            <Field label="العرض">
              <select
                className="ios-input py-2 text-sm"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
              >
                <option value="ALL">الكل</option>
                <option value="MASTER">مشرفة</option>
                <option value="MANAGER">مديرة</option>
                <option value="TEACHER">معلمة</option>
                <option value="STUDENT">طالبة</option>
              </select>
            </Field>
            <Field label="بحث">
              <input
                className="ios-input py-2 text-sm"
                placeholder="اسم أو جوال"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
              />
            </Field>
            <p className="text-[10px] font-bold text-gray-500">{accounts.length} نتيجة</p>
          </div>

          <div className="space-y-2">
            {accounts.map((row) => (
              <div key={`${row.kind}-${row.id}`} className={`ios-card p-3 ${row.status === 'معلق' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold">{row.name}</p>
                    <p className="text-[10px] font-bold text-gray-500" dir="ltr">
                      {row.phone}
                    </p>
                    <p className="mt-1 text-[9px] font-bold text-gray-400">
                      {row.typeLabel}
                      {row.darName ? ` · ${row.darName}` : ''}
                      {row.className ? ` · ${row.className}` : ''}
                      {` · ${row.status}`}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[10px] font-bold text-primary"
                      onClick={() => setAccountMenuId(accountMenuId === row.id ? null : row.id)}
                    >
                      إجراءات
                    </button>
                    {accountMenuId === row.id ? (
                      <div className="absolute left-0 z-20 mt-1 min-w-[7.5rem] rounded-xl border bg-white py-1 shadow-lg">
                        <button type="button" className="block w-full px-3 py-2 text-right text-[11px] font-bold hover:bg-gray-50" onClick={() => openEditAccount(row)}>
                          تعديل
                        </button>
                        {row.type !== 'SUPER_MASTER' ? (
                          <>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-right text-[11px] font-bold hover:bg-gray-50"
                              onClick={() => void setAccountStatus(row, row.status === 'معلق' ? 'نشط' : 'معلق')}
                            >
                              {row.status === 'معلق' ? 'تنشيط' : 'تعليق'}
                            </button>
                            <button type="button" className="block w-full px-3 py-2 text-right text-[11px] font-bold text-red-600 hover:bg-red-50" onClick={() => void deleteAccount(row)}>
                              حذف
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!accounts.length ? <p className="py-8 text-center text-sm text-gray-400">لا توجد نتائج</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'dars' ? (
        <div className="page-pad space-y-4">
          {busy && !dars.length ? <p className="text-center text-sm text-gray-400">جاري التحميل...</p> : null}
          {filtered.map((dar) => (
            <div key={dar.id} className={`ios-card p-5 ${dar.status === 'معلق' ? 'opacity-70 grayscale' : ''}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold">{dar.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">المديرة: {dar.managerName}</p>
                </div>
                <span className="rounded-md border px-2 py-1 text-[10px] font-bold">{dar.curriculum}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-3">
                <button className="rounded-xl bg-gray-50 p-2" onClick={() => void showStats(dar.id)}>
                  مؤشرات
                </button>
                <button className="rounded-xl bg-indigo-50 p-2 text-indigo-700" onClick={() => void openReport(dar.id)}>
                  تقرير الدار
                </button>
                <a className="rounded-xl bg-green-50 p-2 text-center text-green-700" href={waLink(dar.managerPhone)} target="_blank" rel="noreferrer">
                  واتساب
                </a>
                <button className="rounded-xl bg-blue-50 p-2 text-blue-700" onClick={() => setAlertForm({ darId: dar.id, title: '', content: '', kind: 'NOTICE' })}>
                  إشعار
                </button>
                <button className="rounded-xl bg-purple-50 p-2 text-purple-700" onClick={() => setEditDar({ ...dar })}>
                  تعديل
                </button>
                <button className="rounded-xl bg-amber-50 p-2 text-amber-700" onClick={() => void suspendToggle(dar)}>
                  {dar.status === 'معلق' ? 'تنشيط' : 'تعليق'}
                </button>
                <button className="rounded-xl bg-red-50 p-2 text-red-600 sm:col-span-3" onClick={() => void deleteDar(dar.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showAdd ? (
        <Modal title="إضافة دار" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <Field label="اسم الدار">
              <input className="ios-input" placeholder="مثال: دار النور" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="المنهج">
              <select className="ios-input" value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })}>
                <option>منهج تبيان</option>
                <option>منهج قارئ</option>
                <option>كلاهما</option>
              </select>
            </Field>
            <Field label="اسم المديرة">
              <input className="ios-input" placeholder="اسم المديرة" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} />
            </Field>
            <Field label="جوال المديرة">
              <input className="ios-input text-left" dir="ltr" placeholder="05XXXXXXXX" value={form.managerPhone} onChange={(e) => setForm({ ...form, managerPhone: e.target.value })} />
            </Field>
            <Field label="الموقع / الرابط">
              <input className="ios-input" placeholder="رابط أو وصف الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <button className="btn-primary" onClick={() => void addDar()}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {editDar ? (
        <Modal title="تعديل الدار" onClose={() => setEditDar(null)}>
          <div className="space-y-3">
            <Field label="اسم الدار">
              <input className="ios-input" value={editDar.name} onChange={(e) => setEditDar({ ...editDar, name: e.target.value })} />
            </Field>
            <Field label="المنهج">
              <select className="ios-input" value={editDar.curriculum} onChange={(e) => setEditDar({ ...editDar, curriculum: e.target.value })}>
                <option>منهج تبيان</option>
                <option>منهج قارئ</option>
                <option>كلاهما</option>
              </select>
            </Field>
            <Field label="اسم المديرة">
              <input className="ios-input" value={editDar.managerName} onChange={(e) => setEditDar({ ...editDar, managerName: e.target.value })} />
            </Field>
            <Field label="جوال المديرة">
              <input className="ios-input text-left" dir="ltr" value={editDar.managerPhone} onChange={(e) => setEditDar({ ...editDar, managerPhone: e.target.value })} />
            </Field>
            <Field label="الموقع / الرابط">
              <input className="ios-input" value={editDar.location} onChange={(e) => setEditDar({ ...editDar, location: e.target.value })} />
            </Field>
            <Field label="الحالة">
              <select className="ios-input" value={editDar.status === 'معلق' ? 'معلق' : 'نشط'} onChange={(e) => setEditDar({ ...editDar, status: e.target.value })}>
                <option value="نشط">نشط</option>
                <option value="معلق">معلق</option>
              </select>
            </Field>
            <button className="btn-primary" onClick={() => void saveEditDar()}>
              حفظ التعديلات
            </button>
          </div>
        </Modal>
      ) : null}

      {report ? (
        <Modal title={`تقرير: ${report.dar.name}`} onClose={() => setReport(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-gray-500">
              {report.dar.curriculum} | المديرة {report.dar.managerName}
            </p>
            <p className="font-bold text-primary">
              طالبات {report.summary.totalStudents} | نشطات {report.summary.activeStudents} | فصول {report.summary.classesCount}
            </p>
            <p className="text-xs">
              حضور %{report.summary.attendanceRate} | إنجاز %{report.summary.completionRate} | واجب %{report.summary.homeworkRate} |
              عام %{report.summary.overallRate}
            </p>
            <p className="text-[10px] text-gray-500">مستويات مسموحة: {report.dar.allowedLevels.join('، ')}</p>
            <button
              className="btn-primary"
              onClick={() =>
                downloadCsv(
                  `report-${report.dar.name}.csv`,
                  report.students.map((s) => ({
                    الطالبة: s.name,
                    الفصل: s.className,
                    المستوى: s.level,
                    الحالة: s.status,
                    حضور: s.attendanceRate,
                    إنجاز: s.completionRate,
                    واجب: s.homeworkRate,
                    متوسط_اختبارات: s.examAvg,
                  })),
                )
              }
            >
              تصدير CSV للطالبات
            </button>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {report.students.slice(0, 30).map((s) => (
                <div key={String(s.id)} className="rounded-xl border p-2 text-[10px]">
                  <p className="font-bold">
                    {String(s.name)} — {String(s.className)}
                  </p>
                  <p>
                    حضور %{String(s.attendanceRate)} | إنجاز %{String(s.completionRate)} | اختبارات %{String(s.examAvg)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}

      {showPlanEditor ? (
        <Modal
          title={planEditorMode === 'edit' ? 'تحديث خطة يوم' : 'إضافة خطة يوم'}
          onClose={() => setShowPlanEditor(false)}
        >
          <div className="space-y-3">
            <Field label="المستوى">
              <select
                className="ios-input"
                value={planForm.level}
                onChange={(e) => setPlanForm({ ...planForm, level: e.target.value })}
                disabled={planEditorMode === 'edit'}
              >
                {CURRICULUM_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="الأسبوع">
              <input
                className="ios-input"
                type="number"
                min={1}
                value={planForm.week}
                onChange={(e) => setPlanForm({ ...planForm, week: Number(e.target.value) })}
                disabled={planEditorMode === 'edit'}
              />
            </Field>
            <Field label="اليوم">
              <select
                className="ios-input"
                value={planForm.day}
                onChange={(e) => setPlanForm({ ...planForm, day: e.target.value })}
                disabled={planEditorMode === 'edit'}
              >
                {WEEK_DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="الدرس التعليمي">
              <input
                className="ios-input"
                placeholder="نص الدرس"
                value={planForm.educational}
                onChange={(e) => setPlanForm({ ...planForm, educational: e.target.value })}
              />
            </Field>
            <Field label="الواجب">
              <input
                className="ios-input"
                placeholder="نص الواجب"
                value={planForm.homework}
                onChange={(e) => setPlanForm({ ...planForm, homework: e.target.value })}
              />
            </Field>
            <Field label="التربوي">
              <input
                className="ios-input"
                placeholder="اختياري"
                value={planForm.tarbawi}
                onChange={(e) => setPlanForm({ ...planForm, tarbawi: e.target.value })}
              />
            </Field>
            <button className="btn-primary" onClick={() => void savePlan()}>
              {planEditorMode === 'edit' ? 'تحديث الخطة' : 'إضافة الخطة'}
            </button>
          </div>
        </Modal>
      ) : null}

      {showExam ? (
        <Modal title="إرسال اختبار" onClose={() => setShowExam(false)}>
          <div className="space-y-3">
            <Field label="الدار المستهدفة">
              <select className="ios-input" value={exam.targetDarId} onChange={(e) => setExam({ ...exam, targetDarId: e.target.value })}>
                <option value="الكل">مركزي لجميع الدور</option>
                {dars.filter((d) => d.status !== 'معلق').map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="عنوان الاختبار">
              <input className="ios-input" placeholder="عنوان واضح" value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} />
            </Field>
            <Field label="تاريخ الاختبار">
              <input className="ios-input" type="date" value={exam.date} onChange={(e) => setExam({ ...exam, date: e.target.value })} />
            </Field>
            <Field label="رابط الاختبار">
              <input className="ios-input text-left" dir="ltr" placeholder="https://..." value={exam.link} onChange={(e) => setExam({ ...exam, link: e.target.value })} />
            </Field>
            <button className="btn-primary" onClick={() => void saveExam()}>
              إرسال
            </button>
          </div>
        </Modal>
      ) : null}

      {alertForm.darId ? (
        <Modal title="إشعار للدار" onClose={() => setAlertForm({ darId: '', title: '', content: '', kind: 'NOTICE' })}>
          <div className="space-y-3">
            <Field label="نوع الإشعار">
              <select className="ios-input" value={alertForm.kind} onChange={(e) => setAlertForm({ ...alertForm, kind: e.target.value })}>
                <option value="NOTICE">تنبيه عام</option>
                <option value="VISIT">زيارة ميدانية</option>
              </select>
            </Field>
            <Field label="العنوان">
              <input className="ios-input" placeholder="عنوان الإشعار" value={alertForm.title} onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })} />
            </Field>
            <Field label="التفاصيل">
              <textarea className="ios-input h-24" placeholder="نص الإشعار" value={alertForm.content} onChange={(e) => setAlertForm({ ...alertForm, content: e.target.value })} />
            </Field>
            <button className="btn-primary" onClick={() => void sendAlert()}>
              إرسال
            </button>
          </div>
        </Modal>
      ) : null}

      {showAccountEditor ? (
        <Modal title={accountEditorMode === 'edit' ? 'تعديل حساب' : 'إضافة حساب'} onClose={() => setShowAccountEditor(false)}>
          <div className="space-y-3">
            {accountEditorMode === 'add' ? (
              <Field label="النوع">
                <select
                  className="ios-input"
                  value={accountForm.type}
                  onChange={(e) => {
                    const type = e.target.value as typeof accountForm.type;
                    setAccountForm({
                      ...accountForm,
                      type,
                      kind: type === 'STUDENT' ? 'STUDENT' : 'USER',
                    });
                  }}
                >
                  <option value="MASTER">مشرفة</option>
                  <option value="MANAGER">مديرة</option>
                  <option value="TEACHER">معلمة</option>
                  <option value="STUDENT">طالبة</option>
                </select>
              </Field>
            ) : (
              <p className="text-[10px] font-bold text-gray-500">{accountForm.type === 'STUDENT' ? 'طالبة' : accountForm.type}</p>
            )}
            <Field label="الاسم">
              <input className="ios-input" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
            </Field>
            <Field label={accountForm.type === 'STUDENT' ? 'جوال ولي الأمر' : 'الجوال'}>
              <input
                className="ios-input text-left"
                dir="ltr"
                placeholder="05XXXXXXXX"
                value={accountForm.phone}
                onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
              />
            </Field>
            {accountForm.type === 'MANAGER' ? (
              <Field label="الدار">
                <select className="ios-input" value={accountForm.darId} onChange={(e) => setAccountForm({ ...accountForm, darId: e.target.value })}>
                  <option value="">اختاري الدار</option>
                  {(usersMeta?.dars || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {accountForm.type === 'TEACHER' || accountForm.type === 'STUDENT' ? (
              <Field label="الفصل">
                <select className="ios-input" value={accountForm.classId} onChange={(e) => setAccountForm({ ...accountForm, classId: e.target.value })}>
                  <option value="">اختاري الفصل</option>
                  {allClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.darName} — {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <button className="btn-primary" onClick={() => void saveAccount().catch((e) => setMsg(e.message))}>
              {accountEditorMode === 'edit' ? 'حفظ التعديل' : 'إضافة'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
