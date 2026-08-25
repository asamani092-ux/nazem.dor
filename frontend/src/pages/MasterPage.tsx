import { useEffect, useMemo, useState } from 'react';
import { api, waLink } from '../lib/api';
import { formatHomework } from '../lib/format';
import { useAuth } from '../auth';
import { downloadXlsx } from '../lib/export';
import { printReport, tableHtml } from '../lib/print';
import { matchQuery } from '../lib/search';
import { monthStart, monthRangeParams, type CalendarEvent } from '../lib/calendar';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { ToolsAuditPanel } from './ToolsAuditPage';
import {
  Field,
  Input,
  Select,
  Button,
  Modal,
  ViewToggle,
  Banner,
  AppShell,
  StatCard,
  Badge,
  Card,
  DataTable,
  RingStat,
  ProgressBar,
  BarChart,
  Sparkline,
  LineTrend,
  SearchInput,
  SectionTitle,
  ExportBar,
  IconButton,
  ActionMenu,
  PaginatedList,
  CalendarMonth,
  BottomSheet,
  IconChart,
  IconReport,
  IconWhatsApp,
  IconBell,
  IconExam,
  IconEdit,
  IconSuspend,
  IconDelete,
} from '../components/ds';

type Dar = {
  id: string;
  name: string;
  curriculum: string;
  managerName: string;
  managerPhone: string;
  location: string;
  status: string;
  lastVisit?: string;
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

type Tab = 'dars' | 'indicators' | 'curriculum' | 'accounts' | 'calendar' | 'tools-audit';
type DarViewMode = 'cards' | 'table' | 'stats';
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
  const { banner, notify, clearBanner } = usePageFeedback();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/tools-audit') return 'tools-audit';
    return 'dars';
  });
  const [dars, setDars] = useState<Dar[]>([]);
  const [q, setQ] = useState('');
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
  const [extraLevels, setExtraLevels] = useState<string[]>([]);
  const [planViewWeek, setPlanViewWeek] = useState(1);
  const [planViewMode, setPlanViewMode] = useState<PlanViewMode>('table');
  const [planMenuDay, setPlanMenuDay] = useState<string | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planEditorMode, setPlanEditorMode] = useState<'add' | 'edit'>('add');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('ALL');
  const [accountSearch, setAccountSearch] = useState('');
  const [usersMeta, setUsersMeta] = useState<UsersMeta | null>(null);
  const [darViewMode, setDarViewMode] = useState<DarViewMode>('cards');
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarDarFilter, setCalendarDarFilter] = useState('الكل');
  const [calendarDetail, setCalendarDetail] = useState<CalendarEvent | null>(null);
  const [calendarDayEvents, setCalendarDayEvents] = useState<CalendarEvent[]>([]);
  const [accountMenuRow, setAccountMenuRow] = useState<string | null>(null);
  const [darStats, setDarStats] = useState<{
    id: string;
    name: string;
    totalStudents: number;
    activeStudents: number;
    classesCount: number;
    attendanceRate: number;
    completionRate: number;
    homeworkRate: number;
    overallRate: number;
    classBreakdown: Array<{ name: string; level: string; studentCount: number; overallRate: number }>;
  } | null>(null);
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
  const [alertForm, setAlertForm] = useState({ darId: '', title: '', content: '', kind: 'NOTICE', scheduledAt: '' });
  const [planForm, setPlanForm] = useState({
    level: 'تمهيدي 1',
    week: 1,
    day: 'الأحد',
    educational: '',
    homework: '',
    tarbawi: '',
  });

  const filtered = useMemo(
    () =>
      dars.filter((d) =>
        matchQuery(q, [d.name, d.managerName, d.managerPhone, d.curriculum, d.status, d.location]),
      ),
    [dars, q],
  );
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
      notify(e instanceof Error ? e.message : 'خطأ', 'error');
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
    if (tab === 'indicators') void loadIndicators().catch((e) => notify(e.message, 'error'));
    if (tab === 'curriculum') void loadCurriculum().catch((e) => notify(e.message, 'error'));
    if (tab === 'accounts' && user?.role === 'SUPER_MASTER') {
      void loadUsersMeta().catch((e) => notify(e.message, 'error'));
    }
  }, [tab, user?.role]);

  useEffect(() => {
    if (tab !== 'accounts' || user?.role !== 'SUPER_MASTER') return;
    const t = setTimeout(() => {
      void loadAccounts().catch((e) => notify(e.message, 'error'));
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
      notify(res.message || 'تمت الإضافة');
      setShowAdd(false);
      setForm({ name: '', curriculum: 'منهج تبيان', managerName: '', managerPhone: '', location: '' });
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'خطأ', 'error');
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
    notify('تم تحديث الدار');
    await load();
  }

  async function deleteDar(id: string) {
    if (!confirm('حذف الدار؟')) return;
    await api(`/api/master/dars/${id}`, { method: 'DELETE' });
    await load();
  }

  async function suspendToggle(dar: Dar) {
    const next = dar.status === 'معلق' ? 'نشط' : 'معلق';
    await api(`/api/master/dars/${dar.id}`, {
      method: 'PUT',
      json: {
        name: dar.name,
        curriculum: dar.curriculum,
        managerName: dar.managerName,
        managerPhone: dar.managerPhone,
        location: dar.location,
        status: next,
      },
    });
    notify(next === 'معلق' ? 'تم تعليق الدار' : 'تم تنشيط الدار');
    await load();
  }

  async function openReport(id: string) {
    const res = await api<{ data: DarReport }>(`/api/master/dars/${id}/report`);
    setReport(res.data);
  }

  async function showStats(id: string) {
    const dar = dars.find((d) => d.id === id);
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
    setDarStats({
      id,
      name: dar?.name || 'الدار',
      ...d,
    });
  }

  async function saveExam() {
    if (!exam.title.trim() || exam.title.trim().length < 2) return notify('عنوان الاختبار مطلوب', 'error');
    if (!exam.date || !exam.link) return notify('أكمل التاريخ والرابط', 'error');
    await api('/api/master/exams', { method: 'POST', json: exam });
    setShowExam(false);
    setExam({ targetDarId: 'الكل', date: '', link: '', title: '' });
    notify('تم نشر الاختبار');
    if (tab === 'calendar') void loadCalendar().catch(() => undefined);
  }

  useEffect(() => {
    if (tab === 'calendar') {
      void loadCalendar().catch((e) => notify(e.message, 'error'));
    }
  }, [tab, calendarMonth, calendarDarFilter]);

  async function loadCalendar() {
    const { from, to } = monthRangeParams(calendarMonth);
    const params = new URLSearchParams({ from, to });
    if (calendarDarFilter && calendarDarFilter !== 'الكل') params.set('darId', calendarDarFilter);
    const res = await api<{ data: CalendarEvent[] }>(`/api/master/calendar?${params}`);
    setCalendarEvents(res.data);
  }

  function openDarAlertSheet(dar: Dar) {
    setAlertForm({
      darId: dar.id,
      title: '',
      content: '',
      kind: 'NOTICE',
      scheduledAt: new Date().toISOString().slice(0, 10),
    });
  }

  function openDarExam(dar: Dar) {
    setExam({ targetDarId: dar.id, date: '', link: '', title: '' });
    setShowExam(true);
  }

  async function sendAlert() {
    if (alertForm.kind === 'VISIT' && !alertForm.scheduledAt) {
      notify('تاريخ الزيارة مطلوب', 'error');
      return;
    }
    if (!alertForm.title.trim() || alertForm.title.trim().length < 2) {
      notify('العنوان مطلوب', 'error');
      return;
    }
    const content =
      alertForm.content.trim() ||
      (alertForm.kind === 'VISIT' ? 'زيارة مجدولة' : 'تنبيه عام');
    await api('/api/master/alerts', {
      method: 'POST',
      json: {
        darId: alertForm.darId,
        title: alertForm.title,
        content,
        kind: alertForm.kind,
        scheduledAt: alertForm.kind === 'VISIT' ? alertForm.scheduledAt : undefined,
      },
    });
    setAlertForm({ darId: '', title: '', content: '', kind: 'NOTICE', scheduledAt: '' });
    notify('تم إرسال الإشعار');
    if (tab === 'calendar') await loadCalendar();
    await load();
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
    setAccountMenuRow(null);
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
    setAccountMenuRow(null);
    setShowAccountEditor(true);
  }

  async function saveAccount() {
    if (!accountForm.name.trim() || !accountForm.phone.trim()) {
      notify('الاسم والجوال مطلوبان', 'error');
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
      notify(res.message || 'تمت الإضافة');
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
      notify('تم تحديث الحساب');
    }
    setShowAccountEditor(false);
    await loadAccounts();
  }

  async function setAccountStatus(row: AccountRow, status: 'نشط' | 'معلق') {
    await api(`/api/master/users/${row.id}/status`, {
      method: 'POST',
      json: { kind: row.kind, status },
    });
    setAccountMenuRow(null);
    await loadAccounts();
  }

  async function deleteAccount(row: AccountRow) {
    if (row.type === 'SUPER_MASTER') return notify('لا يمكن حذف مدير النظام', 'error');
    if (!confirm(`حذف ${row.typeLabel}: ${row.name}؟`)) return;
    await api(`/api/master/users/${row.id}?kind=${row.kind}`, {
      method: 'DELETE',
      json: { kind: row.kind },
    });
    setAccountMenuRow(null);
    notify('تم الحذف');
    await loadAccounts();
  }

  const allClasses = useMemo(
    () => usersMeta?.dars.flatMap((d) => d.classes.map((c) => ({ ...c, darName: d.name }))) || [],
    [usersMeta],
  );

  async function savePlan() {
    if (!planForm.educational.trim()) {
      notify('الدرس التعليمي مطلوب', 'error');
      return;
    }
    const existed = curriculum.some(
      (p) => p.level === planForm.level && p.week === Number(planForm.week) && p.day === planForm.day,
    );
    if (planEditorMode === 'add' && existed) {
      notify('يوجد خطة لهذا اليوم — التعديل فقط، لا يمكن الإضافة فوق يوم ممتلئ', 'error');
      return;
    }
    await api('/api/master/curriculum', {
      method: 'POST',
      json: { ...planForm, week: Number(planForm.week), homework: formatHomework(planForm.homework) },
    });
    notify(planEditorMode === 'edit' || existed ? 'تم تحديث الخطة' : 'تمت إضافة الخطة');
    setShowPlanEditor(false);
    setPlanMenuDay(null);
    setPlanViewLevel(planForm.level);
    setPlanViewWeek(Number(planForm.week));
    setCurriculumLoaded(false);
    await loadCurriculum(true);
  }

  /** Time O(1) over 5 slots. Space O(1). */
  function firstEmptyDay(): string | null {
    const empty = weekSlots.find((s) => !s.plan);
    return empty?.day || null;
  }

  function openAddPlan(day?: string) {
    const target = day || firstEmptyDay();
    if (!target) {
      notify('جميع أيام هذا الأسبوع ممتلئة — عدّلي يوماً موجوداً فقط', 'error');
      return;
    }
    const filled = weekSlots.some((s) => s.day === target && s.plan);
    if (filled) {
      notify('يوجد خطة لهذا اليوم — استخدمي التعديل فقط', 'error');
      return;
    }
    setPlanEditorMode('add');
    setPlanForm({
      level: planViewLevel,
      week: planViewWeek,
      day: target,
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
    notify('تم حذف الخطة');
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

  const masterNav = [
    { key: 'dars', label: 'الدور' },
    { key: 'calendar', label: 'التقويم' },
    { key: 'indicators', label: 'المؤشرات' },
    { key: 'curriculum', label: 'المناهج' },
    ...(user?.role === 'SUPER_MASTER' ? [{ key: 'accounts' as Tab, label: 'الحسابات' }] : []),
    ...(user?.role === 'SUPER_MASTER' ? [{ key: 'tools-audit' as Tab, label: 'تقييم الأدوات' }] : []),
  ];

  function exportIndicatorsXlsx() {
    if (!indicators) return;
    downloadXlsx('indicators.xlsx', [
      {
        name: 'ملخص',
        rows: [
          {
            'دور نشطة': indicators.darsActive,
            فصول: indicators.classesCount,
            معلمات: indicators.teachersCount,
            طالبات: indicators.studentsActive,
            'حضور %': indicators.attendanceRate,
            'إنجاز %': indicators.completionRate,
            'واجب %': indicators.homeworkRate,
            'عام %': indicators.overallRate,
            اختبارات: indicators.examsCount,
          },
        ],
      },
      {
        name: 'أداء الدور',
        rows: indicators.perDar.map((d) => ({
          الدار: d.name,
          المنهج: d.curriculum,
          الحالة: d.status,
          طالبات: d.activeStudents,
          فصول: d.classesCount,
          'حضور %': d.attendanceRate,
          'إنجاز %': d.completionRate,
          'واجب %': d.homeworkRate,
          'عام %': d.overallRate,
        })),
      },
    ]);
  }

  function printIndicators() {
    if (!indicators) return;
    const html =
      tableHtml(
        ['المؤشر', 'القيمة'],
        [
          ['دور نشطة', String(indicators.darsActive)],
          ['فصول', String(indicators.classesCount)],
          ['معلمات', String(indicators.teachersCount)],
          ['طالبات', String(indicators.studentsActive)],
          ['حضور %', String(indicators.attendanceRate)],
          ['إنجاز %', String(indicators.completionRate)],
          ['واجب %', String(indicators.homeworkRate)],
          ['عام %', String(indicators.overallRate)],
        ],
      ) +
      tableHtml(
        ['الدار', 'المنهج', 'طالبات', 'فصول', 'عام %'],
        indicators.perDar.map((d) => [
          d.name,
          d.curriculum,
          String(d.activeStudents),
          String(d.classesCount),
          String(d.overallRate),
        ]),
      );
    printReport('مؤشرات الإشراف العام', html);
  }

  function exportCurriculumXlsx() {
    downloadXlsx('curriculum-plans.xlsx', CURRICULUM_LEVELS.map((level) => ({
      name: level,
      rows: curriculum
        .filter((p) => p.level === level)
        .map((p) => ({
          أسبوع: p.week,
          يوم: p.day,
          تعليمي: p.educational,
          واجب: formatHomework(p.homework),
          تربوي: p.tarbawi || '',
        })),
    })));
  }

  function printCurriculumWeek() {
    const html = tableHtml(
      ['اليوم', 'التعليمي', 'الواجب', 'التربوي'],
      weekSlots.map((s) => [
        s.day,
        s.plan?.educational || '—',
        s.plan ? formatHomework(s.plan.homework) : '—',
        s.plan?.tarbawi || '—',
      ]),
    );
    printReport(`خطة ${planViewLevel} — أسبوع ${planViewWeek}`, html);
  }

  function exportDarReportXlsx(r: DarReport) {
    downloadXlsx(`report-${r.dar.name}.xlsx`, [
      {
        name: 'ملخص',
        rows: [
          {
            الدار: r.dar.name,
            المنهج: r.dar.curriculum,
            طالبات: r.summary.totalStudents,
            نشطات: r.summary.activeStudents,
            فصول: r.summary.classesCount,
            حضور: r.summary.attendanceRate,
            إنجاز: r.summary.completionRate,
            واجب: r.summary.homeworkRate,
            عام: r.summary.overallRate,
          },
        ],
      },
      { name: 'طالبات', rows: r.students },
      { name: 'اختبارات', rows: r.examGrades },
    ]);
  }

  function printDarReport(r: DarReport) {
    const summary = tableHtml(
      ['البيان', 'القيمة'],
      [
        ['الدار', r.dar.name],
        ['المنهج', r.dar.curriculum],
        ['طالبات', String(r.summary.totalStudents)],
        ['نشطات', String(r.summary.activeStudents)],
        ['فصول', String(r.summary.classesCount)],
        ['حضور %', String(r.summary.attendanceRate)],
        ['إنجاز %', String(r.summary.completionRate)],
        ['واجب %', String(r.summary.homeworkRate)],
        ['عام %', String(r.summary.overallRate)],
      ],
    );
    const students = tableHtml(
      ['الطالبة', 'الفصل', 'المستوى', 'حضور %', 'إنجاز %', 'اختبارات %'],
      r.students.map((s) => [
        String(s.name ?? ''),
        String(s.className ?? ''),
        String(s.level ?? ''),
        String(s.attendanceRate ?? ''),
        String(s.completionRate ?? ''),
        String(s.examAvg ?? ''),
      ]),
    );
    printReport(`تقرير ${r.dar.name}`, `${summary}<h2>الطالبات</h2>${students}`);
  }

  const emptyDays = weekSlots.filter((s) => !s.plan).map((s) => s.day);

  return (
    <AppShell
      title="ناظم الصغار"
      subtitle="الإشراف العام"
      userName={user?.name || ''}
      userRole={user?.role || ''}
      nav={masterNav}
      active={tab}
      onNav={(k) => setTab(k as Tab)}
      onLogout={logout}
    >
        {tab === 'dars' ? (
          <>
            <SectionTitle
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <ViewToggle
                    mode={darViewMode}
                    onTable={() => setDarViewMode('table')}
                    onCards={() => setDarViewMode('cards')}
                    onStats={() => {
                      setDarViewMode('stats');
                      void loadIndicators().catch((e) => notify(e.message, 'error'));
                    }}
                  />
                  <Button variant="success" className="!w-auto" onClick={() => setShowAdd(true)}>إضافة دار</Button>
                  <Button variant="primary" className="!w-auto" onClick={() => setShowExam(true)}>اختبار مركزي</Button>
                </div>
              }
            >
              الدور
            </SectionTitle>
            <SearchInput value={q} onChange={setQ} placeholder="ابحث عن دار..." aria-label="بحث عن دار" />
          </>
        ) : null}

      {banner ? <Banner tone={banner.tone} onClose={clearBanner}>{banner.text}</Banner> : null}

      {tab === 'indicators' && indicators ? (
        <div className="space-y-4">
          <SectionTitle
            action={
              <ExportBar onExcel={() => exportIndicatorsXlsx()} onPrint={() => printIndicators()} excelLabel="تصدير Excel" />
            }
          >
            المؤشرات
          </SectionTitle>

          <div className="ds-kpi-grid">
            {[
              ['دور نشطة', indicators.darsActive],
              ['فصول', indicators.classesCount],
              ['معلمات', indicators.teachersCount],
              ['طالبات', indicators.studentsActive],
              ['حضور', `${indicators.attendanceRate}%`],
              ['إنجاز', `${indicators.completionRate}%`],
              ['واجب', `${indicators.homeworkRate}%`],
              ['عام', `${indicators.overallRate}%`],
              ['اختبارات', indicators.examsCount],
            ].map(([label, val]) => (
              <StatCard key={String(label)} label={String(label)} value={val as string | number} />
            ))}
          </div>

          <div className="ds-chart-grid">
            <Card>
              <div className="ds-chart-card-title">حلقات النسبة Ring %</div>
              <div className="flex flex-wrap justify-around gap-5">
                <RingStat label="حضور" pct={indicators.attendanceRate} />
                <RingStat label="إنجاز" pct={indicators.completionRate} />
                <RingStat label="واجب" pct={indicators.homeworkRate} />
              </div>
            </Card>
            <Card>
              <div className="ds-chart-card-title">أشرطة تقدم Progress</div>
              <div className="flex flex-col gap-3.5">
                <ProgressBar label="حضور" pct={indicators.attendanceRate} color="#16a34a" />
                <ProgressBar label="إنجاز" pct={indicators.completionRate} />
                <ProgressBar label="واجب" pct={indicators.homeworkRate} color="#f59e0b" />
                <ProgressBar label="عام" pct={indicators.overallRate} color="#3b82f6" />
              </div>
            </Card>
          </div>

          <Card>
            <div className="ds-chart-card-title">رسم أعمدة — أداء الدور</div>
            <BarChart
              items={indicators.perDar.slice(0, 6).map((d) => ({
                label: d.name.replace(/^دار\s*/, '').slice(0, 8),
                pct: d.overallRate,
              }))}
            />
          </Card>

          <div className="ds-chart-grid">
            <Card>
              <div className="ds-chart-card-title">اتجاه عام</div>
              <LineTrend
                points={[
                  Math.max(40, indicators.overallRate - 20),
                  Math.max(45, indicators.overallRate - 12),
                  Math.max(50, indicators.overallRate - 8),
                  Math.max(55, indicators.overallRate - 4),
                  indicators.attendanceRate,
                  indicators.completionRate,
                  indicators.overallRate,
                ]}
              />
            </Card>
            <Card>
              <div className="ds-chart-card-title">خطوط مصغّرة Sparklines</div>
              <div className="flex flex-col gap-3.5">
                {[
                  { label: 'حضور', value: indicators.attendanceRate, pts: [70, 75, 80, 78, 85, 90, indicators.attendanceRate] },
                  { label: 'إنجاز', value: indicators.completionRate, pts: [65, 70, 72, 80, 82, 85, indicators.completionRate] },
                  { label: 'واجب', value: indicators.homeworkRate, pts: [60, 68, 70, 74, 78, 80, indicators.homeworkRate] },
                ].map((s) => (
                  <div key={s.label} className="ds-spark-row">
                    <span className="w-[60px] text-[13px] font-bold">{s.label}</span>
                    <div className="min-w-0 flex-1">
                      <Sparkline points={s.pts} />
                    </div>
                    <span className="text-[13px] font-extrabold text-primary">{s.value}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <p className="text-xs font-bold text-ios-muted">
            مناهج: تبيان {indicators.byCurriculum.tibyan} | قارئ {indicators.byCurriculum.qari} | كلاهما{' '}
            {indicators.byCurriculum.both}
          </p>

          {indicators.perDar.map((d) => (
            <Card key={d.id}>
              <div className="mb-2 flex justify-between gap-2">
                <h3 className="font-bold">{d.name}</h3>
                <Badge tone="primary">{d.curriculum}</Badge>
              </div>
              <p className="text-[11px] text-ios-muted">
                طالبات {d.activeStudents} | فصول {d.classesCount} | حضور %{d.attendanceRate} | إنجاز %{d.completionRate} |
                واجب %{d.homeworkRate} | عام %{d.overallRate}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <IconButton label="تقرير الدار" tone="report" onClick={() => void openReport(d.id).then(() => undefined)}><IconReport /></IconButton>
                <Button variant="secondary" className="!w-auto !px-3 !py-1.5 !text-xs" onClick={() => void openReport(d.id)}>
                  فتح التقرير
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'curriculum' ? (
        <div className="space-y-4">
          <div className="ds-card ds-card-pad space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold text-primary">خطط المنهج</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ViewToggle
                  mode={planViewMode}
                  onTable={() => {
                    setPlanViewMode('table');
                    setPlanMenuDay(null);
                  }}
                  onCards={() => {
                    setPlanViewMode('cards');
                    setPlanMenuDay(null);
                  }}
                />
                <ExportBar
                  onExcel={() => exportCurriculumXlsx()}
                  onPrint={() => printCurriculumWeek()}
                  excelLabel="تصدير Excel"
                />
                {emptyDays.length > 0 ? (
                  <Button variant="primary" className="!w-auto !px-3 !py-2 !text-xs" onClick={() => openAddPlan()}>
                    إضافة خطة
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className="!w-auto !px-3 !py-2 !text-xs"
                  onClick={() => {
                    const next = prompt('اسم المستوى الجديد (مثال: تمهيدي 3)');
                    if (!next?.trim()) return;
                    const name = next.trim();
                    setExtraLevels((prev) => (prev.includes(name) ? prev : [...prev, name]));
                    setPlanViewLevel(name);
                    notify(`تم إضافة المستوى: ${name} — أضيفي خططاً له`);
                  }}
                >
                  إضافة مستوى
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[9px] font-bold text-gray-400">المستوى</label>
                <select
                  className="ds-input py-2 text-sm"
                  value={planViewLevel}
                  onChange={(e) => {
                    setPlanViewLevel(e.target.value);
                    setPlanMenuDay(null);
                  }}
                >
                  {[...CURRICULUM_LEVELS, ...extraLevels].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold text-gray-400">الأسبوع</label>
                <select
                  className="ds-input py-2 text-sm"
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
            <p className="text-[10px] font-bold text-ios-muted">
              {planViewLevel} — أسبوع {planViewWeek}: {weekFilled} من {WEEK_DAYS.length} أيام
            </p>
            <p className="text-[9px] text-ios-muted">الربط: تبيان ← تمهيدي | قارئ ← صفوف أولية | كلاهما ← الكل</p>
          </div>

          {planViewMode === 'table' ? (
            <DataTable
              head={
                <tr>
                  <th>اليوم</th>
                  <th>التعليمي</th>
                  <th>الواجب</th>
                  <th>التربوي</th>
                  <th>إجراءات</th>
                </tr>
              }
            >
              {weekSlots.map((slot) => (
                <tr key={slot.day}>
                  <td className="font-extrabold text-primary">{slot.day}</td>
                  {slot.plan ? (
                    <>
                      <td className="font-bold text-ios-text">{slot.plan.educational}</td>
                      <td>{formatHomework(slot.plan.homework) || '—'}</td>
                      <td>{slot.plan.tarbawi || '—'}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="text-ios-muted">
                      فارغ — لم تُسجَّل خطة
                    </td>
                  )}
                  <td>
                    <PlanActions slot={slot} />
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <div className="space-y-3">
              {weekSlots.map((slot) => (
                <div key={slot.day} className={`ds-card ds-card-pad p-3 ${slot.plan ? '' : 'border border-dashed border-gray-300 bg-gray-50/80'}`}>
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
                    <div className="space-y-1 text-sm">
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
        <div className="space-y-4">
          <SectionTitle
            action={
              <Button variant="primary" className="!w-auto !px-4 !py-2" onClick={() => openAddAccount('MASTER')}>
                إضافة حساب
              </Button>
            }
          >
            إدارة الحسابات
          </SectionTitle>
          <div className="ds-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-ios-border p-3">
              <select
                className="ds-input !w-auto min-w-[120px] py-2 text-sm"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
                aria-label="فلتر النوع"
              >
                <option value="ALL">الكل</option>
                <option value="MASTER">مشرفة</option>
                <option value="MANAGER">مديرة</option>
                <option value="TEACHER">معلمة</option>
                <option value="STUDENT">طالبة</option>
              </select>
              <input
                className="ds-input min-w-[160px] flex-1 py-2 text-sm"
                placeholder="بحث: اسم أو جوال"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
              />
              <span className="text-[11px] font-bold text-gray-500">{accounts.length} نتيجة</span>
            </div>
          {accounts.length ? (
            <DataTable
              head={
                <tr>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>النوع</th>
                  <th>الدار</th>
                  <th>الفصل</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              }
            >
              {accounts.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className={row.status === 'معلق' ? 'opacity-70' : ''}>
                  <td className="font-bold whitespace-nowrap">{row.name}</td>
                  <td dir="ltr" className="text-left whitespace-nowrap font-semibold tracking-wide">{row.phone}</td>
                  <td className="whitespace-nowrap">{row.typeLabel}</td>
                  <td className="text-[12px]">{row.darName || '—'}</td>
                  <td className="text-[12px]">{row.className || '—'}</td>
                  <td>
                    <Badge tone={row.status === 'معلق' ? 'warning' : 'success'}>
                      {row.status === 'معلق' ? 'معلق' : 'نشط'}
                    </Badge>
                  </td>
                  <td>
                    <ActionMenu
                      open={accountMenuRow === row.id}
                      onToggle={() => setAccountMenuRow(accountMenuRow === row.id ? null : row.id)}
                      onClose={() => setAccountMenuRow(null)}
                      items={[
                        { key: 'edit', label: 'تعديل', onClick: () => openEditAccount(row) },
                        ...(row.type !== 'SUPER_MASTER'
                          ? [
                              {
                                key: 'status',
                                label: row.status === 'معلق' ? 'تنشيط' : 'تعليق',
                                onClick: () => void setAccountStatus(row, row.status === 'معلق' ? 'نشط' : 'معلق'),
                              },
                              {
                                key: 'delete',
                                label: 'حذف',
                                tone: 'danger' as const,
                                onClick: () => void deleteAccount(row),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">لا توجد نتائج</p>
          )}
          </div>
        </div>
      ) : null}

      {tab === 'tools-audit' && user?.role === 'SUPER_MASTER' ? (
        <div className="space-y-4">
          <SectionTitle>تقييم الأدوات</SectionTitle>
          <ToolsAuditPanel />
        </div>
      ) : null}

      {tab === 'calendar' ? (
        <div className="space-y-4">
          <SectionTitle>تقويم الزيارات والاختبارات</SectionTitle>
          <Field label="فلتر الدار">
            <select className="ds-input" value={calendarDarFilter} onChange={(e) => setCalendarDarFilter(e.target.value)}>
              <option value="الكل">كل الدور</option>
              {dars.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <CalendarMonth
            events={calendarEvents}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectDay={(_, evs) => {
              if (evs.length === 1) setCalendarDetail(evs[0]);
              else setCalendarDayEvents(evs);
            }}
            onSelectEvent={(e) => setCalendarDetail(e)}
          />
          <div className="flex flex-wrap gap-2 text-[10px] font-bold text-gray-500">
            <span className="flex items-center gap-1"><span className="ds-calendar-dot ds-calendar-dot-visit" /> زيارة</span>
            <span className="flex items-center gap-1"><span className="ds-calendar-dot ds-calendar-dot-exam" /> اختبار</span>
            <span className="flex items-center gap-1"><span className="ds-calendar-dot ds-calendar-dot-notice" /> تنبيه</span>
          </div>
        </div>
      ) : null}

      {tab === 'dars' ? (
        <div className="space-y-4">
          {busy && !dars.length ? <p className="text-center text-sm text-ios-muted">جاري التحميل...</p> : null}
          {!busy && !filtered.length ? (
            <Card className="ds-empty">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-shell text-xl font-extrabold text-ios-muted">؟</div>
              <div className="font-bold">لا توجد نتائج</div>
              <div className="mt-1 text-xs text-ios-muted">لم يتم العثور على دار مطابقة.</div>
            </Card>
          ) : null}
          {filtered.length && darViewMode === 'cards' ? (
            <PaginatedList key={q} items={filtered} pageSize={12} renderItem={(dar) => (
            <Card key={dar.id} className={`ds-dar-card ${dar.status === 'معلق' ? 'suspended-card' : ''}`}>
              <div className="ds-dar-badges">
                <Badge tone={dar.curriculum.includes('قارئ') ? 'info' : 'primary'}>{dar.curriculum.replace('منهج ', '')}</Badge>
                <Badge tone={dar.status === 'معلق' ? 'warning' : 'success'}>{dar.status === 'معلق' ? 'معلّق' : 'نشط'}</Badge>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg font-extrabold text-primary">د</div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-extrabold">{dar.name}</h2>
                  <p className="mt-1 text-[15px] font-extrabold text-ios-text">المديرة: {dar.managerName}</p>
                  {dar.location ? <p className="mt-1 text-sm font-semibold text-ios-muted">الحي: {dar.location}</p> : null}
                  {dar.lastVisit ? <p className="mt-1 text-[11px] text-ios-muted">آخر زيارة: {dar.lastVisit}</p> : null}
                </div>
              </div>
              <div className="ds-dar-action-grid">
                <button type="button" className="ds-dar-action-tile" onClick={() => void showStats(dar.id)}>
                  <span className="ds-dar-action-label">مؤشرات</span>
                  <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-primary"><IconChart className="h-6 w-6" /></span>
                </button>
                <button type="button" className="ds-dar-action-tile" onClick={() => void openReport(dar.id)}>
                  <span className="ds-dar-action-label">تقرير</span>
                  <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-report"><IconReport className="h-6 w-6" /></span>
                </button>
                <a className="ds-dar-action-tile" href={waLink(dar.managerPhone)} target="_blank" rel="noreferrer">
                  <span className="ds-dar-action-label">واتساب</span>
                  <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-wa"><IconWhatsApp className="h-6 w-6" /></span>
                </a>
                <button type="button" className="ds-dar-action-tile" onClick={() => openDarAlertSheet(dar)}>
                  <span className="ds-dar-action-label">إشعار</span>
                  <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-alert"><IconBell className="h-6 w-6" /></span>
                </button>
                <button type="button" className="ds-dar-action-tile" onClick={() => openDarExam(dar)}>
                  <span className="ds-dar-action-label">اختبار</span>
                  <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-primary"><IconExam className="h-6 w-6" /></span>
                </button>
                <button type="button" className="ds-dar-action-tile" onClick={() => setEditDar({ ...dar })}>
                  <span className="ds-dar-action-label">تعديل</span>
                  <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-edit"><IconEdit className="h-6 w-6" /></span>
                </button>
                <button type="button" className="ds-dar-action-tile" data-activate={dar.status === 'معلق' ? '1' : undefined} onClick={() => void suspendToggle(dar)}>
                  <span className="ds-dar-action-label">{dar.status === 'معلق' ? 'تنشيط' : 'تعليق'}</span>
                  <span className={`ds-dar-action-btn ds-icon-btn ${dar.status === 'معلق' ? 'ds-icon-btn-wa ds-activate-pulse' : 'ds-icon-btn-alert'}`}><IconSuspend className="h-6 w-6" /></span>
                </button>
                {user?.role === 'SUPER_MASTER' ? (
                  <button type="button" className="ds-dar-action-tile" onClick={() => void deleteDar(dar.id)}>
                    <span className="ds-dar-action-label">حذف</span>
                    <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-delete"><IconDelete className="h-6 w-6" /></span>
                  </button>
                ) : null}
              </div>
            </Card>
            )} />
          ) : null}
          {filtered.length && darViewMode === 'table' ? (
            <DataTable
              head={
                <tr>
                  <th>الدار</th>
                  <th>المديرة</th>
                  <th>الجوال</th>
                  <th>المنهج</th>
                  <th>الحي</th>
                  <th>آخر زيارة</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              }
            >
              {filtered.map((dar) => (
                <tr key={dar.id}>
                  <td className="font-bold">{dar.name}</td>
                  <td>{dar.managerName}</td>
                  <td dir="ltr" className="text-left whitespace-nowrap">{dar.managerPhone}</td>
                  <td>{dar.curriculum.replace('منهج ', '')}</td>
                  <td className="text-[11px]">{dar.location || '—'}</td>
                  <td>{dar.lastVisit || '—'}</td>
                  <td>
                    <Badge tone={dar.status === 'معلق' ? 'warning' : 'success'}>
                      {dar.status === 'معلق' ? 'معلق' : 'نشط'}
                    </Badge>
                  </td>
                  <td>
                    <div className="ds-table-actions">
                      <IconButton label="مؤشرات" tone="primary" onClick={() => void showStats(dar.id)}><IconChart /></IconButton>
                      <IconButton label="تقرير" tone="report" onClick={() => void openReport(dar.id)}><IconReport /></IconButton>
                      <IconButton label="واتساب" tone="wa" href={waLink(dar.managerPhone)}><IconWhatsApp /></IconButton>
                      <IconButton label="إشعار" tone="alert" onClick={() => openDarAlertSheet(dar)}><IconBell /></IconButton>
                      <IconButton label="اختبار" tone="primary" onClick={() => openDarExam(dar)}><IconExam /></IconButton>
                      <IconButton label="تعديل" tone="edit" onClick={() => setEditDar({ ...dar })}><IconEdit /></IconButton>
                      <IconButton label={dar.status === 'معلق' ? 'تنشيط' : 'تعليق'} tone={dar.status === 'معلق' ? 'wa' : 'alert'} onClick={() => void suspendToggle(dar)}><IconSuspend /></IconButton>
                      {user?.role === 'SUPER_MASTER' ? (
                        <IconButton label="حذف" tone="delete" onClick={() => void deleteDar(dar.id)}><IconDelete /></IconButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : null}
          {filtered.length && darViewMode === 'stats' ? (
            <div className="space-y-3">
              {(indicators?.perDar || []).filter((d) => filtered.some((f) => f.id === d.id)).map((d) => (
                <Card key={d.id} className="ds-dar-card">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-extrabold">{d.name}</h3>
                    <Badge tone="primary">{d.curriculum.replace('منهج ', '')}</Badge>
                  </div>
                  <div className="ds-kpi-grid !gap-2">
                    <StatCard label="طالبات" value={d.activeStudents} />
                    <StatCard label="فصول" value={d.classesCount} />
                    <StatCard label="حضور" value={`${d.attendanceRate}%`} />
                    <StatCard label="إنجاز" value={`${d.completionRate}%`} />
                    <StatCard label="واجب" value={`${d.homeworkRate}%`} />
                    <StatCard label="عام" value={`${d.overallRate}%`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <IconButton label="تفاصيل" tone="primary" onClick={() => void showStats(d.id)}><IconChart /></IconButton>
                    <IconButton label="تقرير" tone="report" onClick={() => void openReport(d.id)}><IconReport /></IconButton>
                  </div>
                </Card>
              ))}
              {!indicators?.perDar?.length ? <p className="text-center text-sm text-ios-muted">جاري تحميل المؤشرات...</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showAdd ? (
        <Modal title="إضافة دار" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <Field label="اسم الدار">
              <input className="ds-input" placeholder="مثال: دار النور" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="المنهج">
              <select className="ds-input" value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })}>
                <option>منهج تبيان</option>
                <option>منهج قارئ</option>
                <option>كلاهما</option>
              </select>
            </Field>
            <Field label="اسم المديرة">
              <input className="ds-input" placeholder="اسم المديرة" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} />
            </Field>
            <Field label="جوال المديرة">
              <input className="ds-input text-left" dir="ltr" placeholder="05XXXXXXXX" value={form.managerPhone} onChange={(e) => setForm({ ...form, managerPhone: e.target.value })} />
            </Field>
            <Field label="الحي">
              <input className="ds-input" placeholder="اسم الحي" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void addDar()}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {editDar ? (
        <Modal title="تعديل الدار" onClose={() => setEditDar(null)}>
          <div className="space-y-3">
            <Field label="اسم الدار">
              <input className="ds-input" value={editDar.name} onChange={(e) => setEditDar({ ...editDar, name: e.target.value })} />
            </Field>
            <Field label="المنهج">
              <select className="ds-input" value={editDar.curriculum} onChange={(e) => setEditDar({ ...editDar, curriculum: e.target.value })}>
                <option>منهج تبيان</option>
                <option>منهج قارئ</option>
                <option>كلاهما</option>
              </select>
            </Field>
            <Field label="اسم المديرة">
              <input className="ds-input" value={editDar.managerName} onChange={(e) => setEditDar({ ...editDar, managerName: e.target.value })} />
            </Field>
            <Field label="جوال المديرة">
              <input className="ds-input text-left" dir="ltr" value={editDar.managerPhone} onChange={(e) => setEditDar({ ...editDar, managerPhone: e.target.value })} />
            </Field>
            <Field label="الحي">
              <input className="ds-input" placeholder="اسم الحي" value={editDar.location} onChange={(e) => setEditDar({ ...editDar, location: e.target.value })} />
            </Field>
            <Field label="الحالة">
              <select className="ds-input" value={editDar.status === 'معلق' ? 'معلق' : 'نشط'} onChange={(e) => setEditDar({ ...editDar, status: e.target.value })}>
                <option value="نشط">نشط</option>
                <option value="معلق">معلق</option>
              </select>
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void saveEditDar()}>
              حفظ التعديلات
            </button>
          </div>
        </Modal>
      ) : null}

      {report ? (
        <Modal title={`تقرير: ${report.dar.name}`} onClose={() => setReport(null)}>
          <div className="space-y-3 text-sm">
            <ExportBar
              onExcel={() => exportDarReportXlsx(report)}
              onPrint={() => printDarReport(report)}
              excelLabel="تصدير Excel"
            />
            <p className="text-xs text-ios-muted">
              {report.dar.curriculum} | المديرة {report.dar.managerName}
            </p>
            <p className="font-bold text-primary">
              طالبات {report.summary.totalStudents} | نشطات {report.summary.activeStudents} | فصول {report.summary.classesCount}
            </p>
            <p className="text-xs">
              حضور %{report.summary.attendanceRate} | إنجاز %{report.summary.completionRate} | واجب %{report.summary.homeworkRate} |
              عام %{report.summary.overallRate}
            </p>
            <PaginatedList
              items={report.students}
              pageSize={15}
              renderItem={(s) => (
                <div key={String(s.id)} className="rounded-xl border border-ios-border p-2 text-[11px]">
                  <p className="font-bold">
                    {String(s.name)} — {String(s.className)}
                  </p>
                  <p>
                    حضور %{String(s.attendanceRate)} | إنجاز %{String(s.completionRate)} | اختبارات %{String(s.examAvg)}
                  </p>
                </div>
              )}
            />
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
                className="ds-input"
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
                className="ds-input"
                type="number"
                min={1}
                value={planForm.week}
                onChange={(e) => setPlanForm({ ...planForm, week: Number(e.target.value) })}
                disabled={planEditorMode === 'edit'}
              />
            </Field>
            <Field label="اليوم">
              <select
                className="ds-input"
                value={planForm.day}
                onChange={(e) => {
                  const day = e.target.value;
                  if (planEditorMode === 'add') {
                    const clash = curriculum.some(
                      (p) => p.level === planForm.level && p.week === Number(planForm.week) && p.day === day,
                    );
                    if (clash) {
                      notify('يوجد خطة لهذا اليوم — استخدمي التعديل فقط', 'error');
                      return;
                    }
                  }
                  setPlanForm({ ...planForm, day });
                }}
                disabled={planEditorMode === 'edit'}
              >
                {(planEditorMode === 'edit' ? WEEK_DAYS : emptyDays.length ? emptyDays : WEEK_DAYS).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="الدرس التعليمي">
              <input
                className="ds-input"
                placeholder="نص الدرس"
                value={planForm.educational}
                onChange={(e) => setPlanForm({ ...planForm, educational: e.target.value })}
              />
            </Field>
            <Field label="الواجب">
              <input
                className="ds-input"
                placeholder="نص الواجب"
                value={planForm.homework}
                onChange={(e) => setPlanForm({ ...planForm, homework: e.target.value })}
              />
            </Field>
            <Field label="التربوي">
              <input
                className="ds-input"
                placeholder="اختياري"
                value={planForm.tarbawi}
                onChange={(e) => setPlanForm({ ...planForm, tarbawi: e.target.value })}
              />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void savePlan()}>
              {planEditorMode === 'edit' ? 'تحديث الخطة' : 'إضافة الخطة'}
            </button>
          </div>
        </Modal>
      ) : null}

      {darStats ? (
        <Modal title={`مؤشرات: ${darStats.name}`} onClose={() => setDarStats(null)} wide>
          <div className="space-y-4">
            <div className="ds-kpi-grid">
              <StatCard label="طالبات" value={darStats.activeStudents} />
              <StatCard label="فصول" value={darStats.classesCount} />
              <StatCard label="حضور" value={`${darStats.attendanceRate}%`} />
              <StatCard label="إنجاز" value={`${darStats.completionRate}%`} />
              <StatCard label="واجب" value={`${darStats.homeworkRate}%`} />
              <StatCard label="عام" value={`${darStats.overallRate}%`} />
            </div>
            <div className="flex flex-wrap justify-around gap-4">
              <RingStat label="حضور" pct={darStats.attendanceRate} />
              <RingStat label="إنجاز" pct={darStats.completionRate} />
              <RingStat label="واجب" pct={darStats.homeworkRate} />
            </div>
            {darStats.classBreakdown?.length ? (
              <div className="space-y-2">
                <h4 className="text-sm font-extrabold text-primary">تفصيل الفصول</h4>
                {darStats.classBreakdown.map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-xl bg-shell px-3 py-2 text-sm">
                    <span className="font-bold">{c.name} <span className="text-ios-muted">({c.level})</span></span>
                    <span className="text-xs font-bold text-ios-muted">{c.studentCount} طالبة · عام %{c.overallRate}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" className="!w-auto" onClick={() => { void openReport(darStats.id); setDarStats(null); }}>
                فتح التقرير
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showExam ? (
        <Modal title="إرسال اختبار" onClose={() => setShowExam(false)}>
          <div className="space-y-3">
            <Field label="الدار المستهدفة">
              <select className="ds-input" value={exam.targetDarId} onChange={(e) => setExam({ ...exam, targetDarId: e.target.value })}>
                <option value="الكل">مركزي لجميع الدور</option>
                {dars.filter((d) => d.status !== 'معلق').map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="عنوان الاختبار">
              <input className="ds-input" placeholder="عنوان واضح" value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} />
            </Field>
            <Field label="تاريخ الاختبار">
              <input className="ds-input" type="date" value={exam.date} onChange={(e) => setExam({ ...exam, date: e.target.value })} />
            </Field>
            <Field label="رابط الاختبار">
              <input className="ds-input text-left" dir="ltr" placeholder="https://..." value={exam.link} onChange={(e) => setExam({ ...exam, link: e.target.value })} />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void saveExam()}>
              إرسال
            </button>
          </div>
        </Modal>
      ) : null}

      {alertForm.darId ? (
        <BottomSheet title="إشعار الدار" onClose={() => setAlertForm({ darId: '', title: '', content: '', kind: 'NOTICE', scheduledAt: '' })}>
          <div className="space-y-3">
            <Field label="نوع الإشعار">
              <select
                className="ds-input"
                value={alertForm.kind}
                onChange={(e) => {
                  const kind = e.target.value;
                  const dar = dars.find((d) => d.id === alertForm.darId);
                  setAlertForm({
                    ...alertForm,
                    kind,
                    title: kind === 'VISIT' && dar ? `زيارة ميدانية: ${dar.name}` : alertForm.title,
                  });
                }}
              >
                <option value="NOTICE">تنبيه عام</option>
                <option value="VISIT">زيارة ميدانية</option>
              </select>
            </Field>
            {alertForm.kind === 'VISIT' ? (
              <Field label="تاريخ الزيارة">
                <input type="date" className="ds-input" value={alertForm.scheduledAt} onChange={(e) => setAlertForm({ ...alertForm, scheduledAt: e.target.value })} required />
              </Field>
            ) : null}
            <Field label="العنوان">
              <input className="ds-input" placeholder="عنوان الإشعار" value={alertForm.title} onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })} />
            </Field>
            <Field label="التفاصيل">
              <textarea className="ds-input h-24" placeholder="نص الإشعار (اختياري)" value={alertForm.content} onChange={(e) => setAlertForm({ ...alertForm, content: e.target.value })} />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void sendAlert().catch((e) => notify(e.message, 'error'))}>
              إرسال
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {calendarDetail ? (
        <BottomSheet title={calendarDetail.title} onClose={() => setCalendarDetail(null)}>
          <p className="text-xs text-ios-muted">{new Date(calendarDetail.scheduledAt).toLocaleDateString('ar-SA')}</p>
          {calendarDetail.darName ? <p className="mt-2 text-sm font-bold">{calendarDetail.darName}</p> : null}
          {calendarDetail.content ? <p className="mt-2 text-sm">{calendarDetail.content}</p> : null}
          {calendarDetail.link ? (
            <a className="mt-3 inline-block text-sm font-bold text-primary" href={calendarDetail.link} target="_blank" rel="noreferrer">فتح الرابط</a>
          ) : null}
        </BottomSheet>
      ) : null}

      {calendarDayEvents.length ? (
        <BottomSheet title="أحداث اليوم" onClose={() => setCalendarDayEvents([])}>
          <div className="space-y-2">
            {calendarDayEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                className="w-full rounded-xl bg-shell p-3 text-right"
                onClick={() => {
                  setCalendarDayEvents([]);
                  setCalendarDetail(e);
                }}
              >
                <p className="text-sm font-bold">{e.title}</p>
                <p className="text-[10px] text-ios-muted">{e.type === 'visit' ? 'زيارة' : e.type === 'exam' ? 'اختبار' : 'تنبيه'}</p>
              </button>
            ))}
          </div>
        </BottomSheet>
      ) : null}

      {showAccountEditor ? (
        <Modal title={accountEditorMode === 'edit' ? 'تعديل حساب' : 'إضافة حساب'} onClose={() => setShowAccountEditor(false)}>
          <div className="space-y-3">
            {accountEditorMode === 'add' ? (
              <Field label="النوع">
                <select
                  className="ds-input"
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
              <input className="ds-input" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
            </Field>
            <Field label={accountForm.type === 'STUDENT' ? 'جوال ولي الأمر' : 'الجوال'}>
              <input
                className="ds-input text-left"
                dir="ltr"
                placeholder="05XXXXXXXX"
                value={accountForm.phone}
                onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
              />
            </Field>
            {accountForm.type === 'MANAGER' ? (
              <Field label="الدار">
                <select className="ds-input" value={accountForm.darId} onChange={(e) => setAccountForm({ ...accountForm, darId: e.target.value })}>
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
                <select className="ds-input" value={accountForm.classId} onChange={(e) => setAccountForm({ ...accountForm, classId: e.target.value })}>
                  <option value="">اختاري الفصل</option>
                  {allClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.darName} — {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <button className="ds-btn ds-btn-primary" onClick={() => void saveAccount().catch((e) => notify(e.message, 'error'))}>
              {accountEditorMode === 'edit' ? 'حفظ التعديل' : 'إضافة'}
            </button>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
