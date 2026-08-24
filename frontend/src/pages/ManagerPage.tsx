import { useEffect, useState } from 'react';
import { api, waLink } from '../lib/api';
import { useAuth } from '../auth';
import { downloadCsv, LEVELS_BY_CURRICULUM } from '../lib/reports';
import { Field, Input, Select, Button, Modal, TabBar, Banner, AppChrome, Badge, Card, ActionChip } from '../components/ds';

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
type Report = {
  dar: { name: string; curriculum: string; allowedLevels: string[] };
  summary: {
    totalStudents: number;
    activeStudents: number;
    classesCount: number;
    attendanceRate: number;
    completionRate: number;
    homeworkRate: number;
    overallRate: number;
  };
  classBreakdown: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
};

export function ManagerPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'classes' | 'students' | 'alerts' | 'reports'>('classes');
  const [classes, setClasses] = useState<Cls[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [msg, setMsg] = useState('');
  const [showClass, setShowClass] = useState(false);
  const [editClass, setEditClass] = useState<Cls | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [showStudents, setShowStudents] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', level: '', teacherName: '', teacherPhone: '' });
  const [stuClassId, setStuClassId] = useState('');
  const [stuRows, setStuRows] = useState([{ name: '', phone: '' }]);
  const [forward, setForward] = useState<{ title: string; content: string; targetClassId: string } | null>(null);

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
    void load().catch((e) => setMsg(e.message));
  }, []);

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
    setMsg(res.message || 'تمت الإضافة');
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
    setMsg('تم تعديل الفصل');
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
    setMsg('تم تعديل الطالبة');
    if (filterClass) await loadStudents(filterClass);
  }

  async function showClassStats(id: string) {
    const res = await api<{
      data: {
        studentCount: number;
        attendanceRate: number;
        completionRate: number;
        homeworkRate: number;
        overallRate: number;
      };
    }>(`/api/manager/classes/${id}/stats`);
    const d = res.data;
    setMsg(
      `طالبات: ${d.studentCount}\nحضور %${d.attendanceRate} | إنجاز %${d.completionRate} | واجب %${d.homeworkRate} | عام %${d.overallRate}`,
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
    setMsg('تم تسجيل الطالبات');
    if (filterClass === stuClassId) await loadStudents(stuClassId);
  }

  const unread = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="min-h-screen">
      <AppChrome
        title={meta?.darName || user?.darName || 'دار التحفيظ'}
        subtitle={
          meta
            ? `مرحباً بك، أ. ${user?.name} — ${meta.curriculum}`
            : `مرحباً بك، أ. ${user?.name}`
        }
        onLogout={logout}
      />
      <div className="page-pad space-y-4 pb-10">
        <TabBar
          tabs={[
            { key: 'classes', label: 'الفصول' },
            { key: 'students', label: 'الطالبات' },
            { key: 'alerts', label: `التنبيهات${unread ? ` (${unread})` : ''}` },
            { key: 'reports', label: 'التقارير' },
          ]}
          active={tab}
          onChange={(k) => {
            setTab(k);
            if (k === 'reports') void loadReport().catch((e) => setMsg(e.message));
          }}
        />

      {msg ? <Banner tone="success" onClose={() => setMsg('')}>{msg}</Banner> : null}
        {tab === 'classes' ? (
          <>
            <Button variant="primary" onClick={() => setShowClass(true)}>
              إضافة فصل جديد
            </Button>
            {classes.map((c) => (
              <Card key={c.id} className={c.status === 'موقوف' ? 'suspended-card' : ''}>
                <div className="mb-3 flex justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold">أ. {c.teacherName}</h4>
                    <p className="text-[13px] text-ios-muted">
                      {c.name} | {c.level}
                    </p>
                    <div className="mt-2">
                      <Badge tone={c.status === 'موقوف' ? 'danger' : 'success'}>{c.status === 'موقوف' ? 'موقوف' : 'نشط'}</Badge>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft font-black text-primary">
                      {c.studentCount}
                    </div>
                    <span className="text-[7px] font-bold text-ios-muted">طالبات</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionChip label="مؤشرات" tone="primary" onClick={() => void showClassStats(c.id)} />
                  <ActionChip label="تعديل" tone="edit" onClick={() => setEditClass({ ...c })} />
                  <ActionChip label="واتساب" tone="wa" href={waLink(c.teacherPhone)} />
                  <ActionChip
                    label={c.status === 'موقوف' ? 'تنشيط' : 'تعطيل'}
                    tone="suspend"
                    onClick={async () => {
                      await api(`/api/manager/classes/${c.id}/${c.status === 'موقوف' ? 'activate' : 'suspend'}`, { method: 'POST' });
                      await load();
                    }}
                  />
                  {c.status === 'موقوف' ? (
                    <ActionChip
                      label="حذف"
                      tone="delete"
                      onClick={async () => {
                        if (!confirm('حذف الفصل؟')) return;
                        await api(`/api/manager/classes/${c.id}`, { method: 'DELETE' });
                        await load();
                      }}
                    />
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
                <div className="flex flex-wrap gap-2">
                  <ActionChip label="تعديل" tone="edit" onClick={() => setEditStudent({ ...s })} />
                  <ActionChip
                    label={s.status === 'موقوف' ? 'تنشيط' : 'إيقاف'}
                    tone="suspend"
                    onClick={async () => {
                      await api(`/api/manager/students/${s.id}/status`, {
                        method: 'POST',
                        json: { status: s.status === 'موقوف' ? 'نشط' : 'موقوف' },
                      });
                      await loadStudents(filterClass);
                    }}
                  />
                  {s.status === 'موقوف' ? (
                    <ActionChip
                      label="حذف"
                      tone="delete"
                      onClick={async () => {
                        await api(`/api/manager/students/${s.id}`, { method: 'DELETE' });
                        await loadStudents(filterClass);
                      }}
                    />
                  ) : null}
                </div>
              </Card>
            ))}
          </>
        ) : null}

        {tab === 'alerts' ? (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className={`ds-card ds-card-pad p-4 ${a.isRead ? 'opacity-60' : ''}`}>
                <div className="mb-1 flex justify-between">
                  <h4 className="text-xs font-bold text-primary">{a.title}</h4>
                  <span className="text-[8px] text-gray-400">{a.date}</span>
                </div>
                <p className="mb-3 text-[10px] text-gray-500">{a.content || 'رابط مرفق'}</p>
                <div className="flex flex-wrap gap-2">
                  {!a.isRead ? (
                    <button
                      className="rounded-full bg-gray-100 px-3 py-1 text-[9px] font-bold"
                      onClick={async () => {
                        await api(`/api/manager/alerts/${a.id}/read`, { method: 'POST' });
                        await load();
                      }}
                    >
                      مقروء
                    </button>
                  ) : null}
                  {a.link ? (
                    <a className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-bold text-blue-600" href={a.link} target="_blank" rel="noreferrer">
                      فتح الرابط
                    </a>
                  ) : null}
                  <button
                    className="rounded-full bg-green-50 px-3 py-1 text-[9px] font-bold text-green-700"
                    onClick={() => setForward({ title: a.title, content: a.content || a.link || '', targetClassId: 'الكل' })}
                  >
                    توجيه للمعلمات
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'reports' && report ? (
          <div className="space-y-4">
            <div className="ds-card ds-card-pad space-y-2 p-4">
              <h3 className="font-bold text-primary">تقرير الدار</h3>
              <p className="text-xs text-gray-500">
                {report.dar.name} | {report.dar.curriculum}
              </p>
              <p className="text-sm font-bold">
                طالبات {report.summary.totalStudents} | نشطات {report.summary.activeStudents} | فصول {report.summary.classesCount}
              </p>
              <p className="text-xs">
                حضور %{report.summary.attendanceRate} | إنجاز %{report.summary.completionRate} | واجب %{report.summary.homeworkRate} |
                عام %{report.summary.overallRate}
              </p>
              <p className="text-[10px] text-gray-500">مستويات المنهج: {report.dar.allowedLevels.join('، ')}</p>
              <button
                className="ds-btn ds-btn-primary"
                onClick={() =>
                  downloadCsv(
                    `dar-report.csv`,
                    report.students.map((s) => ({
                      الطالبة: s.name,
                      الفصل: s.className,
                      المستوى: s.level,
                      حضور: s.attendanceRate,
                      إنجاز: s.completionRate,
                      واجب: s.homeworkRate,
                      اختبارات: s.examAvg,
                    })),
                  )
                }
              >
                تصدير CSV
              </button>
            </div>
            {report.classBreakdown.map((c) => (
              <div key={String(c.id)} className="ds-card ds-card-pad p-3 text-[11px]">
                <p className="font-bold">
                  {String(c.name)} — {String(c.level)} (أ. {String(c.teacherName)})
                </p>
                <p>
                  طالبات {String(c.studentCount)} | حضور %{String(c.attendanceRate)} | إنجاز %{String(c.completionRate)} | عام %
                  {String(c.overallRate)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

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
            <button className="ds-btn ds-btn-primary" onClick={() => void saveClass().catch((e) => setMsg(e.message))}>
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
            <button className="ds-btn ds-btn-primary" onClick={() => void saveEditClass().catch((e) => setMsg(e.message))}>
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
            <button className="ds-btn ds-btn-primary" onClick={() => void saveEditStudent().catch((e) => setMsg(e.message))}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {showStudents ? (
        <Modal title="تسجيل طالبات" onClose={() => setShowStudents(false)}>
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
            {stuRows.length < 10 ? (
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
                setMsg('تم تمرير الإشعار');
              }}
            >
              اعتماد التوجيه
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
