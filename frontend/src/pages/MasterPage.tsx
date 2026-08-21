import { useEffect, useMemo, useState } from 'react';
import { api, waLink } from '../lib/api';
import { useAuth } from '../auth';
import { downloadCsv } from '../lib/reports';

type Dar = {
  id: string;
  name: string;
  curriculum: string;
  managerName: string;
  managerPhone: string;
  location: string;
  status: string;
};

type Supervisor = { id: string; name: string; phone: string; status: string };
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

type Tab = 'dars' | 'indicators' | 'curriculum';

export function MasterPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('dars');
  const [dars, setDars] = useState<Dar[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editDar, setEditDar] = useState<Dar | null>(null);
  const [showAdmins, setShowAdmins] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [report, setReport] = useState<DarReport | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);
  const [currFilter, setCurrFilter] = useState('');
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [form, setForm] = useState({
    name: '',
    curriculum: 'منهج تبيان',
    managerName: '',
    managerPhone: '',
    location: '',
  });
  const [exam, setExam] = useState({ targetDarId: 'الكل', date: '', link: '', title: '' });
  const [adminForm, setAdminForm] = useState({ name: '', phone: '' });
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
  const filteredPlans = useMemo(() => {
    if (!currFilter) return curriculum.slice(0, 80);
    return curriculum.filter((p) => p.level === currFilter).slice(0, 80);
  }, [curriculum, currFilter]);

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

  async function loadIndicators() {
    const res = await api<{ data: Indicators }>('/api/master/indicators');
    setIndicators(res.data);
  }

  async function loadCurriculum() {
    const res = await api<{ data: CurriculumRow[] }>('/api/master/curriculum');
    setCurriculum(res.data);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab === 'indicators') void loadIndicators().catch((e) => setMsg(e.message));
    if (tab === 'curriculum') void loadCurriculum().catch((e) => setMsg(e.message));
  }, [tab]);

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

  async function loadSupervisors() {
    const res = await api<{ data: Supervisor[] }>('/api/master/supervisors');
    setSupervisors(res.data);
    setShowAdmins(true);
  }

  async function addSupervisor() {
    const res = await api<{ message: string }>('/api/master/supervisors', { method: 'POST', json: adminForm });
    setMsg(res.message || 'تمت الإضافة');
    setAdminForm({ name: '', phone: '' });
    await loadSupervisors();
  }

  async function toggleSupervisor(s: Supervisor, status: string) {
    await api(`/api/master/supervisors/${s.id}`, {
      method: 'PUT',
      json: { name: s.name, phone: s.phone, status },
    });
    await loadSupervisors();
  }

  async function savePlan() {
    await api('/api/master/curriculum', { method: 'POST', json: { ...planForm, week: Number(planForm.week) } });
    setMsg('تم حفظ خطة المنهج');
    await loadCurriculum();
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b bg-white/90 p-4 pt-10 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#7A1F3D]">الإشراف العام</h1>
          <button onClick={logout} className="rounded-full bg-red-50 px-3 py-2 text-sm font-bold text-red-500">
            خروج
          </button>
        </div>
        <div className="mb-3 flex rounded-xl bg-gray-200 p-1">
          {(
            [
              ['dars', 'الدور'],
              ['indicators', 'المؤشرات'],
              ['curriculum', 'المناهج'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg py-2 text-[11px] font-bold ${tab === k ? 'bg-white text-[#7A1F3D] shadow-sm' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'dars' ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white" onClick={() => setShowAdd(true)}>
                إضافة دار
              </button>
              {user?.role === 'SUPER_MASTER' ? (
                <button className="rounded-xl bg-gray-500 px-3 py-2 text-xs font-bold text-white" onClick={() => void loadSupervisors()}>
                  المشرفات
                </button>
              ) : null}
              <button className="rounded-xl bg-[#7A1F3D] px-3 py-2 text-xs font-bold text-white" onClick={() => setShowExam(true)}>
                اختبار مركزي
              </button>
            </div>
            <input className="ios-input text-sm" placeholder="ابحث عن دار..." value={q} onChange={(e) => setQ(e.target.value)} />
          </>
        ) : null}
      </header>

      {msg ? (
        <div className="m-4 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm font-bold text-[#7A1F3D] shadow">
          {msg}
          <button className="mr-3 text-xs text-gray-400" onClick={() => setMsg('')}>
            إغلاق
          </button>
        </div>
      ) : null}

      {tab === 'indicators' && indicators ? (
        <div className="space-y-4 p-4">
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
                <p className="text-xl font-black text-[#7A1F3D]">{val}</p>
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
              <button className="mt-2 text-[10px] font-bold text-[#7A1F3D]" onClick={() => void openReport(d.id)}>
                تقرير الدار الكامل
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'curriculum' ? (
        <div className="space-y-4 p-4">
          <div className="ios-card space-y-2 p-4">
            <h3 className="font-bold text-[#7A1F3D]">إضافة / تحديث خطة يوم</h3>
            <select className="ios-input" value={planForm.level} onChange={(e) => setPlanForm({ ...planForm, level: e.target.value })}>
              {['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <input className="ios-input" type="number" min={1} value={planForm.week} onChange={(e) => setPlanForm({ ...planForm, week: Number(e.target.value) })} />
            <select className="ios-input" value={planForm.day} onChange={(e) => setPlanForm({ ...planForm, day: e.target.value })}>
              {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <input className="ios-input" placeholder="الدرس التعليمي" value={planForm.educational} onChange={(e) => setPlanForm({ ...planForm, educational: e.target.value })} />
            <input className="ios-input" placeholder="الواجب" value={planForm.homework} onChange={(e) => setPlanForm({ ...planForm, homework: e.target.value })} />
            <input className="ios-input" placeholder="التربوي" value={planForm.tarbawi} onChange={(e) => setPlanForm({ ...planForm, tarbawi: e.target.value })} />
            <button className="btn-primary" onClick={() => void savePlan()}>
              حفظ الخطة
            </button>
          </div>
          <p className="text-[10px] font-bold text-gray-500">
            الربط: منهج تبيان ← تمهيدي | منهج قارئ ← صفوف أولية | كلاهما ← الكل
          </p>
          <select className="ios-input" value={currFilter} onChange={(e) => setCurrFilter(e.target.value)}>
            <option value="">كل المستويات</option>
            {['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          {filteredPlans.map((p) => (
            <div key={p.id} className="ios-card p-3 text-[11px]">
              <p className="font-bold">
                {p.level} | أسبوع {p.week} | {p.day}
              </p>
              <p>تعليمي: {p.educational}</p>
              <p>واجب: {p.homework}</p>
              {user?.role === 'SUPER_MASTER' ? (
                <button
                  className="mt-1 text-red-500"
                  onClick={async () => {
                    await api(`/api/master/curriculum/${p.id}`, { method: 'DELETE' });
                    await loadCurriculum();
                  }}
                >
                  حذف
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'dars' ? (
        <div className="space-y-4 p-4">
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
          <div className="space-y-2">
            <input className="ios-input" placeholder="اسم الدار" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="ios-input" value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })}>
              <option>منهج تبيان</option>
              <option>منهج قارئ</option>
              <option>كلاهما</option>
            </select>
            <input className="ios-input" placeholder="اسم المديرة" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} />
            <input className="ios-input text-left" dir="ltr" placeholder="جوال المديرة" value={form.managerPhone} onChange={(e) => setForm({ ...form, managerPhone: e.target.value })} />
            <input className="ios-input" placeholder="رابط الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <button className="btn-primary" onClick={() => void addDar()}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {editDar ? (
        <Modal title="تعديل الدار" onClose={() => setEditDar(null)}>
          <div className="space-y-2">
            <input className="ios-input" value={editDar.name} onChange={(e) => setEditDar({ ...editDar, name: e.target.value })} />
            <select className="ios-input" value={editDar.curriculum} onChange={(e) => setEditDar({ ...editDar, curriculum: e.target.value })}>
              <option>منهج تبيان</option>
              <option>منهج قارئ</option>
              <option>كلاهما</option>
            </select>
            <input className="ios-input" value={editDar.managerName} onChange={(e) => setEditDar({ ...editDar, managerName: e.target.value })} />
            <input className="ios-input text-left" dir="ltr" value={editDar.managerPhone} onChange={(e) => setEditDar({ ...editDar, managerPhone: e.target.value })} />
            <input className="ios-input" value={editDar.location} onChange={(e) => setEditDar({ ...editDar, location: e.target.value })} />
            <select className="ios-input" value={editDar.status === 'معلق' ? 'معلق' : 'نشط'} onChange={(e) => setEditDar({ ...editDar, status: e.target.value })}>
              <option value="نشط">نشط</option>
              <option value="معلق">معلق</option>
            </select>
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
            <p className="font-bold text-[#7A1F3D]">
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

      {showExam ? (
        <Modal title="إرسال اختبار" onClose={() => setShowExam(false)}>
          <div className="space-y-2">
            <select className="ios-input" value={exam.targetDarId} onChange={(e) => setExam({ ...exam, targetDarId: e.target.value })}>
              <option value="الكل">مركزي لجميع الدور</option>
              {dars.filter((d) => d.status !== 'معلق').map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input className="ios-input" placeholder="عنوان الاختبار" value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} />
            <input className="ios-input" type="date" value={exam.date} onChange={(e) => setExam({ ...exam, date: e.target.value })} />
            <input className="ios-input text-left" dir="ltr" placeholder="رابط الاختبار" value={exam.link} onChange={(e) => setExam({ ...exam, link: e.target.value })} />
            <button className="btn-primary" onClick={() => void saveExam()}>
              إرسال
            </button>
          </div>
        </Modal>
      ) : null}

      {alertForm.darId ? (
        <Modal title="إشعار للدار" onClose={() => setAlertForm({ darId: '', title: '', content: '', kind: 'NOTICE' })}>
          <div className="space-y-2">
            <select className="ios-input" value={alertForm.kind} onChange={(e) => setAlertForm({ ...alertForm, kind: e.target.value })}>
              <option value="NOTICE">تنبيه عام</option>
              <option value="VISIT">زيارة ميدانية</option>
            </select>
            <input className="ios-input" placeholder="العنوان" value={alertForm.title} onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })} />
            <textarea className="ios-input h-24" placeholder="التفاصيل" value={alertForm.content} onChange={(e) => setAlertForm({ ...alertForm, content: e.target.value })} />
            <button className="btn-primary" onClick={() => void sendAlert()}>
              إرسال
            </button>
          </div>
        </Modal>
      ) : null}

      {showAdmins ? (
        <Modal title="إدارة المشرفات" onClose={() => setShowAdmins(false)}>
          <div className="mb-4 space-y-2 rounded-2xl bg-gray-50 p-3">
            <input className="ios-input" placeholder="اسم المشرفة" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
            <input className="ios-input text-left" dir="ltr" placeholder="الجوال" value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} />
            <button className="btn-primary" onClick={() => void addSupervisor()}>
              إضافة
            </button>
          </div>
          <div className="space-y-2">
            {supervisors.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.phone}</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  <button onClick={() => void toggleSupervisor(s, s.status === 'نشط' ? 'معلق' : 'نشط')}>
                    {s.status === 'نشط' ? 'تعليق' : 'تنشيط'}
                  </button>
                  <button className="text-red-500" onClick={() => void toggleSupervisor(s, 'محذوف')}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#7A1F3D]">{title}</h3>
          <button onClick={onClose} className="text-2xl text-gray-400">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
