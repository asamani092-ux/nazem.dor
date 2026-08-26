import { useEffect, useState } from 'react';
import { api, waLink } from '../lib/api';
import { useAuth } from '../auth';
import { LEVELS_BY_CURRICULUM } from '../lib/reports';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { Field, Input, Select, Button, Modal, Banner, AppShell, Badge, Card, SectionTitle, StatCard, RingStat, ProgressBar, ExportBar, NotificationCard, IconButton, IconEdit, IconWhatsApp, IconChart, IconReport, IconSuspend, IconDelete, CalendarMonth, BottomSheet, FileUpload } from '../components/ds';
import { downloadXlsx, downloadTemplateXlsx, parseXlsxFile } from '../lib/export';
import { printReport, tableHtml } from '../lib/print';
import { monthStart, monthRangeParams, type CalendarEvent } from '../lib/calendar';

type Cls = {
  id: string;
  name: string;
  level: string;
  teacherName: string;
  teacherPhone: string;
  status: string;
  studentCount: number;
};

type Student = { id: string; name: string; classId: string; phone: string; status: string };
type AlertItem = { id: string; type: string; date: string; title: string; content?: string; link?: string; isRead: boolean };
type Meta = { darName: string; curriculum: string; allowedLevels: string[] };
type ReportSummary = {
  totalStudents: number;
  activeStudents: number;
  classesCount: number;
  attendanceRate: number;
  completionRate: number;
  homeworkRate: number;
  overallRate: number;
  examAvg?: number;
};
type ReportClass = {
  id: string;
  name: string;
  level: string;
  teacherName: string;
  studentCount: number;
  attendanceRate: number;
  completionRate: number;
  homeworkRate: number;
  overallRate: number;
  examAvg?: number;
  [key: string]: unknown;
};
type ReportStudent = {
  id?: string;
  name?: string;
  classId?: string;
  className?: string;
  examAvg?: number;
  examsCount?: number;
  [key: string]: unknown;
};
type Report = {
  dar: { name: string; curriculum: string; allowedLevels: string[] };
  summary: ReportSummary;
  classBreakdown: ReportClass[];
  students: ReportStudent[];
};
type ClassReport = {
  summary: ReportClass;
  students: ReportStudent[];
  examAvg?: number;
};

export function ManagerPage() {
  const { user, logout } = useAuth();
  const { banner, notify, clearBanner } = usePageFeedback();
  const [tab, setTab] = useState<'classes' | 'students' | 'alerts' | 'reports' | 'calendar'>('classes');
  const [classes, setClasses] = useState<Cls[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [classReport, setClassReport] = useState<ClassReport | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [showClass, setShowClass] = useState(false);
  const [editClass, setEditClass] = useState<Cls | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [showStudents, setShowStudents] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', level: '', teacherName: '', teacherPhone: '' });
  const [stuClassId, setStuClassId] = useState('');
  const [stuRows, setStuRows] = useState([{ name: '', phone: '' }]);
  const [forward, setForward] = useState<{ title: string; content: string; targetClassId: string } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarDetail, setCalendarDetail] = useState<CalendarEvent | null>(null);
  const [importPreview, setImportPreview] = useState<Array<{ name: string; phone: string }>>([]);
  const [classStats, setClassStats] = useState<{
    id: string;
    name: string;
    studentCount: number;
    attendanceRate: number;
    completionRate: number;
    homeworkRate: number;
    overallRate: number;
    examAvg?: number;
  } | null>(null);

  const levels = meta?.allowedLevels || LEVELS_BY_CURRICULUM.BOTH;

  async function load() {
    const [c, a, m] = await Promise.all([
      api<{ data: Cls[] }>('/api/manager/classes'),
      api<{ data: AlertItem[] }>('/api/manager/alerts'),
      api<{ data: Meta }>('/api/manager/meta'),
    ]);
    setClasses(c.data);
    setAlerts(a.data);
    setMeta(m.data);
    if (!classForm.level && m.data.allowedLevels[0]) {
      setClassForm((f) => ({ ...f, level: m.data.allowedLevels[0] }));
    }
  }

  useEffect(() => {
    void load().catch((e) => notify(e.message, 'error'));
  }, []);

  useEffect(() => {
    if (tab === 'calendar') {
      void loadCalendar().catch((e) => notify(e.message, 'error'));
    }
  }, [tab, calendarMonth]);

  async function loadCalendar() {
    const { from, to } = monthRangeParams(calendarMonth);
    const res = await api<{ data: CalendarEvent[] }>(`/api/manager/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    setCalendarEvents(res.data);
  }

  async function importExcel(file: File) {
    const rows = await parseXlsxFile(file);
    const parsed = rows
      .map((r) => ({
        name: String(r['اسم الطالبة'] ?? r.name ?? '').trim(),
        phone: String(r['جوال ولي الأمر'] ?? r.phone ?? '').trim(),
      }))
      .filter((r) => r.name && r.phone);
    setImportPreview(parsed);
    notify(`تم قراءة ${parsed.length} صف`);
  }

  async function confirmImport() {
    if (!stuClassId) return notify('اختاري الفصل', 'error');
    if (!importPreview.length) return notify('لا توجد بيانات للاستيراد', 'error');
    const count = importPreview.length;
    const chunk = 100;
    for (let i = 0; i < importPreview.length; i += chunk) {
      await api('/api/manager/students', {
        method: 'POST',
        json: { classId: stuClassId, students: importPreview.slice(i, i + chunk) },
      });
    }
    setImportPreview([]);
    setShowStudents(false);
    notify(`تم تسجيل ${count} طالبة`);
    if (filterClass === stuClassId) await loadStudents(stuClassId);
  }

  async function loadStudents(classId: string) {
    setFilterClass(classId);
    const res = await api<{ data: Student[] }>(`/api/manager/students?classId=${classId}`);
    setStudents(res.data);
  }

  async function loadReport() {
    const res = await api<{ data: Report }>('/api/manager/report');
    setReport(res.data);
  }

  async function saveClass() {
    const res = await api<{ message?: string }>('/api/manager/classes', { method: 'POST', json: classForm });
    notify(res.message || 'تمت الإضافة');
    setShowClass(false);
    await load();
  }

  async function saveEditClass() {
    if (!editClass) return;
    await api(`/api/manager/classes/${editClass.id}`, {
      method: 'PUT',
      json: {
        name: editClass.name,
        level: editClass.level,
        teacherName: editClass.teacherName,
        teacherPhone: editClass.teacherPhone,
      },
    });
    setEditClass(null);
    notify('تم تعديل الفصل');
    await load();
  }

  async function saveEditStudent() {
    if (!editStudent) return;
    await api(`/api/manager/students/${editStudent.id}`, {
      method: 'PUT',
      json: {
        classId: editStudent.classId,
        name: editStudent.name,
        phone: editStudent.phone,
      },
    });
    setEditStudent(null);
    notify('تم تعديل الطالبة');
    if (filterClass) await loadStudents(filterClass);
  }

  async function showClassStats(cls: Cls) {
    const res = await api<{
      data: {
        studentCount: number;
        attendanceRate: number;
        completionRate: number;
        homeworkRate: number;
        overallRate: number;
        examAvg?: number;
      };
    }>(`/api/manager/classes/${cls.id}/stats`);
    setClassStats({
      id: cls.id,
      name: cls.name,
      ...res.data,
    });
  }

  async function openClassReport(cls: Cls) {
    const res = await api<{ data: Report }>('/api/manager/report');
    const summary = res.data.classBreakdown.find((item) => item.id === cls.id);
    if (!summary) throw new Error('تعذر العثور على تقرير الفصل');

    const classStudents = res.data.students.filter(
      (student) => student.classId === cls.id || (!student.classId && student.className === cls.name),
    );
    const examRows = classStudents.filter(
      (student) => typeof student.examAvg === 'number' && (student.examsCount === undefined || student.examsCount > 0),
    );
    const derivedExamAvg = examRows.length
      ? Math.round(examRows.reduce((sum, student) => sum + Number(student.examAvg), 0) / examRows.length)
      : undefined;

    setClassReport({
      summary,
      students: classStudents,
      examAvg: typeof summary.examAvg === 'number' ? summary.examAvg : derivedExamAvg,
    });
  }

  function printClassReport() {
    if (!classReport) return;
    const { summary, examAvg } = classReport;
    const rows = [
      ['طالبات', String(summary.studentCount)],
      ['حضور', `${summary.attendanceRate}%`],
      ['إنجاز', `${summary.completionRate}%`],
      ['واجب', `${summary.homeworkRate}%`],
      ['عام', `${summary.overallRate}%`],
    ];
    if (examAvg !== undefined) rows.push(['متوسط الاختبارات', `${examAvg}%`]);
    printReport(
      `تقرير الفصل — ${summary.name}`,
      tableHtml(['المؤشر', 'القيمة'], rows),
    );
  }

  async function saveStudents() {
    const studentsPayload = stuRows.filter((s) => s.name && s.phone);
    await api('/api/manager/students', {
      method: 'POST',
      json: { classId: stuClassId, students: studentsPayload },
    });
    setShowStudents(false);
    setStuRows([{ name: '', phone: '' }]);
    notify('تم تسجيل الطالبات');
    if (filterClass === stuClassId) await loadStudents(stuClassId);
  }

  const unread = alerts.filter((a) => !a.isRead).length;

  return (
    <AppShell
      title="ناظم الصغار"
      subtitle={meta?.darName || user?.darName || 'دار التحفيظ'}
      userName={user?.name || ''}
      userRole={user?.role || ''}
      contextLine={meta?.curriculum || user?.darName}
      nav={[
        { key: 'classes', label: 'الفصول' },
        { key: 'students', label: 'الطالبات' },
        { key: 'alerts', label: unread ? `التنبيهات (${unread})` : 'التنبيهات' },
        { key: 'calendar', label: 'التقويم' },
        { key: 'reports', label: 'التقارير' },
      ]}
      active={tab}
      onNav={(k) => {
        setTab(k as typeof tab);
        if (k === 'reports') void loadReport().catch((e) => notify(e.message, 'error'));
      }}
      onLogout={logout}
    >
      {banner ? <Banner tone={banner.tone} onClose={clearBanner}>{banner.text}</Banner> : null}
        {tab === 'classes' ? (
          <>
            <Button variant="primary" onClick={() => setShowClass(true)}>
              إضافة فصل جديد
            </Button>
            {classes.map((c) => (
              <Card key={c.id} className={`ds-dar-card ${c.status === 'موقوف' ? 'suspended-card' : ''}`}>
                <div className="ds-dar-badges">
                  <Badge tone="primary">{c.level}</Badge>
                  <Badge tone={c.status === 'موقوف' ? 'warning' : 'success'}>{c.status === 'موقوف' ? 'موقوف' : 'نشط'}</Badge>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg font-extrabold text-primary">ف</div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-extrabold">{c.name}</h4>
                    <p className="mt-1 text-[15px] font-extrabold text-ios-text">المعلمة: {c.teacherName}</p>
                    <p className="mt-1 text-sm font-semibold text-ios-muted">طالبات: {c.studentCount}</p>
                  </div>
                </div>
                <div className="ds-dar-action-grid">
                  <button type="button" className="ds-dar-action-tile" onClick={() => void showClassStats(c).catch((e) => notify(e.message, 'error'))}>
                    <span className="ds-dar-action-label">مؤشرات</span>
                    <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-primary"><IconChart className="h-6 w-6" /></span>
                  </button>
                  <button
                    type="button"
                    className="ds-dar-action-tile"
                    onClick={() => void openClassReport(c).catch((e) => notify(e.message, 'error'))}
                  >
                    <span className="ds-dar-action-label">تقرير</span>
                    <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-report"><IconReport className="h-6 w-6" /></span>
                  </button>
                  <button type="button" className="ds-dar-action-tile" onClick={() => setEditClass({ ...c })}>
                    <span className="ds-dar-action-label">تعديل</span>
                    <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-edit"><IconEdit className="h-6 w-6" /></span>
                  </button>
                  <a className="ds-dar-action-tile" href={waLink(c.teacherPhone)} target="_blank" rel="noreferrer">
                    <span className="ds-dar-action-label">واتساب</span>
                    <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-wa"><IconWhatsApp className="h-6 w-6" /></span>
                  </a>
                  <button
                    type="button"
                    className="ds-dar-action-tile"
                    onClick={() => {
                      setTab('students');
                      setFilterClass(c.id);
                      void loadStudents(c.id);
                    }}
                  >
                    <span className="ds-dar-action-label">طالبات</span>
                    <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-report text-sm font-extrabold">{c.studentCount}</span>
                  </button>
                  <button
                    type="button"
                    className="ds-dar-action-tile"
                    data-activate={c.status === 'موقوف' ? '1' : undefined}
                    onClick={async () => {
                      await api(`/api/manager/classes/${c.id}/${c.status === 'موقوف' ? 'activate' : 'suspend'}`, { method: 'POST' });
                      notify(c.status === 'موقوف' ? 'تم تنشيط الفصل' : 'تم تعطيل الفصل');
                      await load();
                    }}
                  >
                    <span className="ds-dar-action-label">{c.status === 'موقوف' ? 'تنشيط' : 'تعطيل'}</span>
                    <span className={`ds-dar-action-btn ds-icon-btn ${c.status === 'موقوف' ? 'ds-icon-btn-wa ds-activate-pulse' : 'ds-icon-btn-alert'}`}><IconSuspend className="h-6 w-6" /></span>
                  </button>
                  {c.status === 'موقوف' ? (
                    <button
                      type="button"
                      className="ds-dar-action-tile"
                      onClick={async () => {
                        if (!confirm('حذف الفصل؟')) return;
                        await api(`/api/manager/classes/${c.id}`, { method: 'DELETE' });
                        notify('تم حذف الفصل');
                        await load();
                      }}
                    >
                      <span className="ds-dar-action-label">حذف</span>
                      <span className="ds-dar-action-btn ds-icon-btn ds-icon-btn-delete"><IconDelete className="h-6 w-6" /></span>
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </>
        ) : null}

        {tab === 'students' ? (
          <>
            <button className="ds-btn ds-btn-primary" onClick={() => setShowStudents(true)}>
              تسجيل طالبات
            </button>
            <Field label="الفصل">
              <select className="ds-input font-bold text-primary" value={filterClass} onChange={(e) => void loadStudents(e.target.value)}>
                <option value="">اختاري الفصل...</option>
                {classes
                  .filter((c) => c.status !== 'موقوف')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (أ. {c.teacherName})
                    </option>
                  ))}
              </select>
            </Field>
            {students.map((s) => (
              <Card key={s.id} className="flex items-center justify-between !py-3">
                <div>
                  <p className="text-sm font-extrabold">{s.name}</p>
                  <p className="text-[10px] text-ios-muted">{s.phone}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <IconButton label="تعديل" tone="edit" onClick={() => setEditStudent({ ...s })}><IconEdit /></IconButton>
                  <IconButton
                    label={s.status === 'موقوف' ? 'تنشيط' : 'إيقاف'}
                    tone="alert"
                    onClick={async () => {
                      await api(`/api/manager/students/${s.id}/status`, {
                        method: 'POST',
                        json: { status: s.status === 'موقوف' ? 'نشط' : 'موقوف' },
                      });
                      await loadStudents(filterClass);
                    }}
                  >
                    <IconSuspend />
                  </IconButton>
                  {s.status === 'موقوف' ? (
                    <IconButton
                      label="حذف"
                      tone="delete"
                      onClick={async () => {
                        await api(`/api/manager/students/${s.id}`, { method: 'DELETE' });
                        await loadStudents(filterClass);
                      }}
                    >
                      <IconDelete />
                    </IconButton>
                  ) : null}
                </div>
              </Card>
            ))}
          </>
        ) : null}

        {tab === 'alerts' ? (
          <div className="space-y-3">
            {alerts.map((a) => (
              <NotificationCard
                key={a.id}
                title={a.title}
                date={a.date}
                isRead={a.isRead}
                content={a.content || (a.link ? 'رابط مرفق' : undefined)}
                actions={
                  <>
                    {!a.isRead ? (
                      <button
                        className="ds-chip ds-chip-primary"
                        onClick={async () => {
                          await api(`/api/manager/alerts/${a.id}/read`, { method: 'POST' });
                          await load();
                        }}
                      >
                        مقروء
                      </button>
                    ) : null}
                    {a.link ? (
                      <a className="ds-chip" style={{ background: '#eff6ff', color: '#1d4ed8' }} href={a.link} target="_blank" rel="noreferrer">
                        فتح الرابط
                      </a>
                    ) : null}
                    <button
                      className="ds-chip ds-chip-wa"
                      onClick={() => setForward({ title: a.title, content: a.content || a.link || '', targetClassId: 'الكل' })}
                    >
                      توجيه للمعلمات
                    </button>
                  </>
                }
              />
            ))}
          </div>
        ) : null}

        {tab === 'calendar' ? (
          <div className="space-y-4">
            <SectionTitle>تقويم الدار</SectionTitle>
            <CalendarMonth
              events={calendarEvents}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelectEvent={(e) => setCalendarDetail(e)}
            />
          </div>
        ) : null}

        {tab === 'reports' && report ? (
          <div className="space-y-4">
            <SectionTitle
              action={
                <ExportBar
                  onExcel={() => {
                    if (!report) return;
                    downloadXlsx(`dar-${report.dar.name}.xlsx`, [
                      { name: 'ملخص', rows: [report.summary as Record<string, unknown>] },
                      { name: 'فصول', rows: report.classBreakdown as Array<Record<string, unknown>> },
                      { name: 'طالبات', rows: report.students as Array<Record<string, unknown>> },
                    ]);
                  }}
                  onPrint={() => {
                    if (!report) return;
                    const summary = tableHtml(
                      ['البيان', 'القيمة'],
                      [
                        ['طالبات', String(report.summary.totalStudents)],
                        ['نشطات', String(report.summary.activeStudents)],
                        ['فصول', String(report.summary.classesCount)],
                        ['عام %', String(report.summary.overallRate)],
                      ],
                    );
                    const classes = tableHtml(
                      ['الفصل', 'المستوى', 'المعلمة', 'طالبات', 'عام %'],
                      report.classBreakdown.map((c) => [
                        String(c.name ?? ''),
                        String(c.level ?? ''),
                        String(c.teacherName ?? ''),
                        String(c.studentCount ?? ''),
                        String(c.overallRate ?? ''),
                      ]),
                    );
                    printReport(`تقرير ${report.dar.name}`, `${summary}<h2>الفصول</h2>${classes}`);
                  }}
                  excelLabel="تصدير Excel"
                />
              }
            >
              التقارير
            </SectionTitle>
            <Card className="space-y-3">
              <p className="text-xs text-ios-muted">
                {report.dar.name} | {report.dar.curriculum}
              </p>
              <div className="ds-kpi-grid">
                <StatCard label="طالبات" value={report.summary.totalStudents} />
                <StatCard label="نشطات" value={report.summary.activeStudents} />
                <StatCard label="فصول" value={report.summary.classesCount} />
                <StatCard label="عام %" value={report.summary.overallRate} />
                {report.summary.examAvg !== undefined ? <StatCard label="متوسط الاختبارات %" value={report.summary.examAvg} /> : null}
              </div>
              <div className="flex flex-wrap justify-around gap-4 py-2">
                <RingStat label="حضور" pct={report.summary.attendanceRate} />
                <RingStat label="إنجاز" pct={report.summary.completionRate} />
                <RingStat label="واجب" pct={report.summary.homeworkRate} />
              </div>
              <div className="space-y-3">
                <ProgressBar label="حضور" pct={report.summary.attendanceRate} color="#16a34a" />
                <ProgressBar label="إنجاز" pct={report.summary.completionRate} />
                <ProgressBar label="واجب" pct={report.summary.homeworkRate} color="#f59e0b" />
              </div>
              <p className="text-[10px] text-ios-muted">مستويات المنهج: {report.dar.allowedLevels.join('، ')}</p>
            </Card>
            {report.classBreakdown.map((c) => (
              <Card key={String(c.id)} className="text-[11px]">
                <p className="font-bold">
                  {String(c.name)} — {String(c.level)} (أ. {String(c.teacherName)})
                </p>
                <p>
                  طالبات {String(c.studentCount)} | حضور %{String(c.attendanceRate)} | إنجاز %{String(c.completionRate)} | عام %
                  {String(c.overallRate)}
                  {c.examAvg !== undefined ? ` | اختبارات %${c.examAvg}` : ''}
                </p>
              </Card>
            ))}
          </div>
        ) : null}

      {showClass ? (
        <Modal title="إضافة فصل" onClose={() => setShowClass(false)}>
          <div className="space-y-3">
            <Field label="اسم الفصل">
              <input className="ds-input" placeholder="مثال: تمهيدي 1 أ" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            </Field>
            <Field label="المستوى">
              <select className="ds-input" value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}>
                {levels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="اسم المعلمة">
              <input className="ds-input" placeholder="اسم المعلمة" value={classForm.teacherName} onChange={(e) => setClassForm({ ...classForm, teacherName: e.target.value })} />
            </Field>
            <Field label="جوال المعلمة">
              <input className="ds-input text-left" dir="ltr" placeholder="05XXXXXXXX" value={classForm.teacherPhone} onChange={(e) => setClassForm({ ...classForm, teacherPhone: e.target.value })} />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void saveClass().catch((e) => notify(e.message, 'error'))}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {editClass ? (
        <Modal title="تعديل الفصل" onClose={() => setEditClass(null)}>
          <div className="space-y-3">
            <Field label="اسم الفصل">
              <input className="ds-input" value={editClass.name} onChange={(e) => setEditClass({ ...editClass, name: e.target.value })} />
            </Field>
            <Field label="المستوى">
              <select className="ds-input" value={editClass.level} onChange={(e) => setEditClass({ ...editClass, level: e.target.value })}>
                {levels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="اسم المعلمة">
              <input className="ds-input" value={editClass.teacherName} onChange={(e) => setEditClass({ ...editClass, teacherName: e.target.value })} />
            </Field>
            <Field label="جوال المعلمة">
              <input className="ds-input text-left" dir="ltr" value={editClass.teacherPhone} onChange={(e) => setEditClass({ ...editClass, teacherPhone: e.target.value })} />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void saveEditClass().catch((e) => notify(e.message, 'error'))}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {editStudent ? (
        <Modal title="تعديل الطالبة" onClose={() => setEditStudent(null)}>
          <div className="space-y-3">
            <Field label="اسم الطالبة">
              <input className="ds-input" value={editStudent.name} onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })} />
            </Field>
            <Field label="الفصل">
              <select className="ds-input" value={editStudent.classId} onChange={(e) => setEditStudent({ ...editStudent, classId: e.target.value })}>
                {classes
                  .filter((c) => c.status !== 'موقوف')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="جوال ولي الأمر">
              <input className="ds-input text-left" dir="ltr" value={editStudent.phone} onChange={(e) => setEditStudent({ ...editStudent, phone: e.target.value })} />
            </Field>
            <button className="ds-btn ds-btn-primary" onClick={() => void saveEditStudent().catch((e) => notify(e.message, 'error'))}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {showStudents ? (
        <Modal title="تسجيل طالبات" onClose={() => { setShowStudents(false); setImportPreview([]); }}>
          <div className="space-y-3">
            <Field label="الفصل">
              <select className="ds-input" value={stuClassId} onChange={(e) => setStuClassId(e.target.value)}>
                <option value="">اختر الفصل</option>
                {classes
                  .filter((c) => c.status !== 'موقوف')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="!w-auto" onClick={() => downloadTemplateXlsx('نموذج-طالبات.xlsx', ['اسم الطالبة', 'جوال ولي الأمر'])}>
                تحميل نموذج
              </Button>
              <FileUpload
                label="رفع Excel"
                accept=".xlsx,.xls"
                onChange={(f) => { if (f) void importExcel(f).catch((e) => notify(e.message, 'error')); }}
              />
            </div>
            {importPreview.length ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-primary">معاينة ({importPreview.length})</p>
                <div className="max-h-40 overflow-auto rounded-lg bg-shell p-2 text-[11px]">
                  {importPreview.slice(0, 20).map((r, i) => (
                    <p key={i}>{r.name} — {r.phone}</p>
                  ))}
                  {importPreview.length > 20 ? <p className="text-ios-muted">… و{importPreview.length - 20} أكثر</p> : null}
                </div>
                <button className="ds-btn ds-btn-primary" onClick={() => void confirmImport().catch((e) => notify(e.message, 'error'))}>
                  تأكيد الاستيراد
                </button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-gray-400">
              <span>اسم الطالبة</span>
              <span>جوال ولي الأمر</span>
            </div>
            {stuRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="ds-input"
                  placeholder="الاسم"
                  aria-label={`اسم الطالبة ${i + 1}`}
                  value={row.name}
                  onChange={(e) => {
                    const next = [...stuRows];
                    next[i] = { ...next[i], name: e.target.value };
                    setStuRows(next);
                  }}
                />
                <input
                  className="ds-input text-left"
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                  aria-label={`جوال ولي الأمر ${i + 1}`}
                  value={row.phone}
                  onChange={(e) => {
                    const next = [...stuRows];
                    next[i] = { ...next[i], phone: e.target.value };
                    setStuRows(next);
                  }}
                />
              </div>
            ))}
            {stuRows.length < 50 ? (
              <button className="w-full rounded-xl bg-blue-50 py-2 text-xs font-bold text-blue-600" onClick={() => setStuRows([...stuRows, { name: '', phone: '' }])}>
                + طالبة أخرى
              </button>
            ) : null}
            <button className="ds-btn ds-btn-primary" onClick={() => void saveStudents()}>
              تسجيل
            </button>
          </div>
        </Modal>
      ) : null}

      {calendarDetail ? (
        <BottomSheet title={calendarDetail.title} onClose={() => setCalendarDetail(null)}>
          <p className="text-xs text-ios-muted">{new Date(calendarDetail.scheduledAt).toLocaleDateString('ar-SA')}</p>
          <p className="mt-2 text-sm font-bold">
            {calendarDetail.type === 'visit' ? 'زيارة ميدانية' : calendarDetail.type === 'exam' ? 'اختبار' : 'تنبيه'}
          </p>
          {calendarDetail.content ? <p className="mt-2 text-sm">{calendarDetail.content}</p> : null}
          {calendarDetail.link ? (
            <a className="mt-2 inline-block text-sm font-bold text-primary" href={calendarDetail.link} target="_blank" rel="noreferrer">فتح الرابط</a>
          ) : null}
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => {
              setForward({
                title: calendarDetail.title,
                content: calendarDetail.content || calendarDetail.link || calendarDetail.title,
                targetClassId: 'الكل',
              });
              setCalendarDetail(null);
            }}
          >
            تذكير المعلمات
          </Button>
        </BottomSheet>
      ) : null}

      {classStats ? (
        <Modal title={`مؤشرات: ${classStats.name}`} onClose={() => setClassStats(null)} wide>
          <div className="space-y-4">
            <div className="ds-kpi-grid">
              <StatCard label="طالبات" value={classStats.studentCount} />
              <StatCard label="حضور" value={`${classStats.attendanceRate}%`} />
              <StatCard label="إنجاز" value={`${classStats.completionRate}%`} />
              <StatCard label="واجب" value={`${classStats.homeworkRate}%`} />
              <StatCard label="عام" value={`${classStats.overallRate}%`} />
              {classStats.examAvg !== undefined ? <StatCard label="متوسط الاختبارات" value={`${classStats.examAvg}%`} /> : null}
            </div>
            <div className="flex flex-wrap justify-around gap-4">
              <RingStat label="حضور" pct={classStats.attendanceRate} />
              <RingStat label="إنجاز" pct={classStats.completionRate} />
              <RingStat label="واجب" pct={classStats.homeworkRate} />
            </div>
          </div>
        </Modal>
      ) : null}

      {classReport ? (
        <Modal title={`تقرير الفصل: ${classReport.summary.name}`} onClose={() => setClassReport(null)} wide>
          <div className="space-y-4">
            <ExportBar
              onExcel={() => {
                const summary = {
                  ...classReport.summary,
                  ...(classReport.examAvg !== undefined ? { examAvg: classReport.examAvg } : {}),
                };
                downloadXlsx(`class-${classReport.summary.name}.xlsx`, [
                  { name: 'ملخص', rows: [summary] },
                  { name: 'طالبات', rows: classReport.students as Array<Record<string, unknown>> },
                ]);
              }}
              onPrint={printClassReport}
              excelLabel="تصدير Excel"
            />
            <div className="ds-kpi-grid">
              <StatCard label="طالبات" value={classReport.summary.studentCount} />
              <StatCard label="حضور" value={`${classReport.summary.attendanceRate}%`} />
              <StatCard label="إنجاز" value={`${classReport.summary.completionRate}%`} />
              <StatCard label="واجب" value={`${classReport.summary.homeworkRate}%`} />
              <StatCard label="عام" value={`${classReport.summary.overallRate}%`} />
              {classReport.examAvg !== undefined ? <StatCard label="متوسط الاختبارات" value={`${classReport.examAvg}%`} /> : null}
            </div>
            <div className="flex flex-wrap justify-around gap-4">
              <RingStat label="حضور" pct={classReport.summary.attendanceRate} />
              <RingStat label="إنجاز" pct={classReport.summary.completionRate} />
              <RingStat label="واجب" pct={classReport.summary.homeworkRate} />
            </div>
          </div>
        </Modal>
      ) : null}

      {forward ? (
        <Modal title="تمرير للمعلمات" onClose={() => setForward(null)}>
          <div className="space-y-3">
            <Field label="الفصل المستهدف">
              <select className="ds-input" value={forward.targetClassId} onChange={(e) => setForward({ ...forward, targetClassId: e.target.value })}>
                <option value="الكل">جميع الفصول</option>
                {classes
                  .filter((c) => c.status !== 'موقوف')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              className="ds-btn ds-btn-primary"
              onClick={async () => {
                await api('/api/manager/alerts/forward', { method: 'POST', json: forward });
                setForward(null);
                notify('تم تمرير الإشعار');
              }}
            >
              اعتماد التوجيه
            </button>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
