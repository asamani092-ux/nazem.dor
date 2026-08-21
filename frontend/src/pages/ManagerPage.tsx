import { useEffect, useState } from 'react';
import { api, waLink } from '../lib/api';
import { useAuth } from '../auth';

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

export function ManagerPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'classes' | 'students' | 'alerts'>('classes');
  const [classes, setClasses] = useState<Cls[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [msg, setMsg] = useState('');
  const [showClass, setShowClass] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', level: 'تمهيدي 1', teacherName: '', teacherPhone: '' });
  const [stuClassId, setStuClassId] = useState('');
  const [stuRows, setStuRows] = useState([{ name: '', phone: '' }]);
  const [forward, setForward] = useState<{ title: string; content: string; targetClassId: string } | null>(null);

  async function load() {
    const [c, a] = await Promise.all([
      api<{ data: Cls[] }>('/api/manager/classes'),
      api<{ data: AlertItem[] }>('/api/manager/alerts'),
    ]);
    setClasses(c.data);
    setAlerts(a.data);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e.message));
  }, []);

  async function loadStudents(classId: string) {
    setFilterClass(classId);
    const res = await api<{ data: Student[] }>(`/api/manager/students?classId=${classId}`);
    setStudents(res.data);
  }

  async function saveClass() {
    const res = await api<{ message?: string }>('/api/manager/classes', { method: 'POST', json: classForm });
    setMsg(res.message || 'تمت الإضافة');
    setShowClass(false);
    await load();
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
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b bg-white p-4 pt-10 text-center">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <p className="mb-1 text-[10px] font-bold text-ios-muted">مرحباً بك، أ. {user?.name}</p>
            <h1 className="text-xl font-extrabold text-burgundy">{user?.darName}</h1>
          </div>
          <button onClick={logout} className="rounded-full bg-red-50 px-3 py-2 text-sm font-bold text-red-500">
            خروج
          </button>
        </div>
        <div className="mt-4 flex rounded-xl bg-gray-200 p-1">
          {(
            [
              ['classes', 'الفصول'],
              ['students', 'الطالبات'],
              ['alerts', `التنبيهات${unread ? ` (${unread})` : ''}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg py-2.5 text-[11px] font-bold ${tab === k ? 'bg-white text-burgundy shadow-sm' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {msg ? <p className="m-4 rounded-xl bg-white p-3 text-sm font-bold text-burgundy">{msg}</p> : null}

      <div className="space-y-4 p-4">
        {tab === 'classes' ? (
          <>
            <button className="btn-primary" onClick={() => setShowClass(true)}>
              إضافة فصل جديد
            </button>
            {classes.map((c) => (
              <div key={c.id} className={`ios-card p-4 ${c.status === 'موقوف' ? 'opacity-70' : ''}`}>
                <div className="mb-3 flex justify-between">
                  <div>
                    <h4 className="font-extrabold">أ. {c.teacherName}</h4>
                    <p className="text-[10px] font-bold text-gray-500">
                      {c.name} | {c.level}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 font-black text-burgundy">
                      {c.studentCount}
                    </div>
                    <span className="text-[7px] font-bold text-gray-400">طالبات</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                  <a className="rounded-full bg-green-50 px-3 py-1 text-green-700" href={waLink(c.teacherPhone)} target="_blank" rel="noreferrer">
                    واتساب
                  </a>
                  <button
                    className="rounded-full bg-amber-50 px-3 py-1 text-amber-700"
                    onClick={async () => {
                      await api(`/api/manager/classes/${c.id}/${c.status === 'موقوف' ? 'activate' : 'suspend'}`, { method: 'POST' });
                      await load();
                    }}
                  >
                    {c.status === 'موقوف' ? 'تنشيط' : 'تعطيل'}
                  </button>
                  {c.status === 'موقوف' ? (
                    <button
                      className="rounded-full bg-red-50 px-3 py-1 text-red-600"
                      onClick={async () => {
                        if (!confirm('حذف الفصل؟')) return;
                        await api(`/api/manager/classes/${c.id}`, { method: 'DELETE' });
                        await load();
                      }}
                    >
                      حذف
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        ) : null}

        {tab === 'students' ? (
          <>
            <button className="btn-primary" onClick={() => setShowStudents(true)}>
              تسجيل طالبات
            </button>
            <select className="ios-input font-bold text-burgundy" value={filterClass} onChange={(e) => void loadStudents(e.target.value)}>
              <option value="">اختاري الفصل...</option>
              {classes
                .filter((c) => c.status !== 'موقوف')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (أ. {c.teacherName})
                  </option>
                ))}
            </select>
            {students.map((s) => (
              <div key={s.id} className="ios-card flex items-center justify-between p-3">
                <div>
                  <p className="font-extrabold text-sm">{s.name}</p>
                  <p className="text-[10px] text-gray-500">{s.phone}</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  <button
                    className="rounded-full bg-amber-50 px-2 py-1"
                    onClick={async () => {
                      await api(`/api/manager/students/${s.id}/status`, {
                        method: 'POST',
                        json: { status: s.status === 'موقوف' ? 'نشط' : 'موقوف' },
                      });
                      await loadStudents(filterClass);
                    }}
                  >
                    {s.status === 'موقوف' ? 'تنشيط' : 'إيقاف'}
                  </button>
                  {s.status === 'موقوف' ? (
                    <button
                      className="rounded-full bg-red-50 px-2 py-1 text-red-600"
                      onClick={async () => {
                        await api(`/api/manager/students/${s.id}`, { method: 'DELETE' });
                        await loadStudents(filterClass);
                      }}
                    >
                      حذف
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        ) : null}

        {tab === 'alerts' ? (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className={`ios-card p-4 ${a.isRead ? 'opacity-60' : ''}`}>
                <div className="mb-1 flex justify-between">
                  <h4 className="text-xs font-bold text-burgundy">{a.title}</h4>
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
      </div>

      {showClass ? (
        <Modal title="إضافة فصل" onClose={() => setShowClass(false)}>
          <div className="space-y-2">
            <input className="ios-input" placeholder="اسم الفصل" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            <select className="ios-input" value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}>
              {['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <input className="ios-input" placeholder="اسم المعلمة" value={classForm.teacherName} onChange={(e) => setClassForm({ ...classForm, teacherName: e.target.value })} />
            <input className="ios-input text-left" dir="ltr" placeholder="جوال المعلمة" value={classForm.teacherPhone} onChange={(e) => setClassForm({ ...classForm, teacherPhone: e.target.value })} />
            <button className="btn-primary" onClick={() => void saveClass()}>
              حفظ
            </button>
          </div>
        </Modal>
      ) : null}

      {showStudents ? (
        <Modal title="تسجيل طالبات" onClose={() => setShowStudents(false)}>
          <div className="space-y-2">
            <select className="ios-input" value={stuClassId} onChange={(e) => setStuClassId(e.target.value)}>
              <option value="">اختر الفصل</option>
              {classes
                .filter((c) => c.status !== 'موقوف')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {stuRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="ios-input"
                  placeholder="اسم الطالبة"
                  value={row.name}
                  onChange={(e) => {
                    const next = [...stuRows];
                    next[i] = { ...next[i], name: e.target.value };
                    setStuRows(next);
                  }}
                />
                <input
                  className="ios-input text-left"
                  dir="ltr"
                  placeholder="جوال ولي الأمر"
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
            <button className="btn-primary" onClick={() => void saveStudents()}>
              تسجيل
            </button>
          </div>
        </Modal>
      ) : null}

      {forward ? (
        <Modal title="تمرير للمعلمات" onClose={() => setForward(null)}>
          <select
            className="ios-input mb-3"
            value={forward.targetClassId}
            onChange={(e) => setForward({ ...forward, targetClassId: e.target.value })}
          >
            <option value="الكل">جميع الفصول</option>
            {classes
              .filter((c) => c.status !== 'موقوف')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <button
            className="btn-primary"
            onClick={async () => {
              await api('/api/manager/alerts/forward', { method: 'POST', json: forward });
              setForward(null);
              setMsg('تم تمرير الإشعار');
            }}
          >
            اعتماد التوجيه
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6">
        <div className="mb-4 flex justify-between">
          <h3 className="text-lg font-bold text-burgundy">{title}</h3>
          <button onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
