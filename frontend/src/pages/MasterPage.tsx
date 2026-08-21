import { useEffect, useMemo, useState } from 'react';
import { api, waLink } from '../lib/api';
import { useAuth } from '../auth';

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

export function MasterPage() {
  const { user, logout } = useAuth();
  const [dars, setDars] = useState<Dar[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [showExam, setShowExam] = useState(false);
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

  const filtered = useMemo(
    () => dars.filter((d) => d.name.includes(q.trim())),
    [dars, q],
  );

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

  useEffect(() => {
    void load();
  }, []);

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

  async function showStats(id: string) {
    const res = await api<{
      data: {
        totalStudents: number;
        activeStudents: number;
        classesCount: number;
        attendanceRate: number;
        completionRate: number;
        overallRate: number;
      };
    }>(`/api/master/dars/${id}/stats`);
    const d = res.data;
    setMsg(
      `طالبات: ${d.totalStudents} | نشطات: ${d.activeStudents} | فصول: ${d.classesCount}\nحضور: %${d.attendanceRate} | إنجاز: %${d.completionRate} | عام: %${d.overallRate}`,
    );
  }

  async function saveExam() {
    if (!exam.title.trim() || exam.title.trim().length < 2) {
      setMsg('عنوان الاختبار مطلوب');
      return;
    }
    if (!exam.date || !exam.link) {
      setMsg('أكمل التاريخ والرابط');
      return;
    }
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
    const res = await api<{ message: string }>('/api/master/supervisors', {
      method: 'POST',
      json: adminForm,
    });
    setMsg(res.message || 'تمت الإضافة');
    setAdminForm({ name: '', phone: '' });
    await loadSupervisors();
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b bg-white/90 p-4 pt-10 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-burgundy">الإشراف العام</h1>
          <button onClick={logout} className="rounded-full bg-red-50 px-3 py-2 text-sm font-bold text-red-500">
            خروج
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white" onClick={() => setShowAdd(true)}>
            إضافة دار
          </button>
          {user?.role === 'SUPER_MASTER' ? (
            <button className="rounded-xl bg-ios-muted px-3 py-2 text-xs font-bold text-white" onClick={() => void loadSupervisors()}>
              المشرفات
            </button>
          ) : null}
          <button className="rounded-xl bg-burgundy px-3 py-2 text-xs font-bold text-white" onClick={() => setShowExam(true)}>
            اختبار مركزي
          </button>
        </div>
        <input className="ios-input text-sm" placeholder="ابحث عن دار..." value={q} onChange={(e) => setQ(e.target.value)} />
      </header>

      {msg ? (
        <div className="m-4 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm font-bold text-burgundy shadow">
          {msg}
          <button className="mr-3 text-xs text-gray-400" onClick={() => setMsg('')}>
            إغلاق
          </button>
        </div>
      ) : null}

      <div className="space-y-4 p-4">
        {busy && !dars.length ? <p className="text-center text-sm text-gray-400">جاري التحميل...</p> : null}
        {filtered.map((dar) => (
          <div key={dar.id} className={`ios-card p-5 ${dar.status === 'معلق' ? 'opacity-70 grayscale' : ''}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{dar.name}</h2>
                <p className="mt-1 text-sm text-ios-muted">المديرة: {dar.managerName}</p>
              </div>
              <span className="rounded-md border px-2 py-1 text-[10px] font-bold">{dar.curriculum}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4">
              <button className="rounded-xl bg-gray-50 p-2" onClick={() => void showStats(dar.id)}>
                إحصائيات
              </button>
              <a className="rounded-xl bg-green-50 p-2 text-center text-green-700" href={waLink(dar.managerPhone)} target="_blank" rel="noreferrer">
                واتساب
              </a>
              <button
                className="rounded-xl bg-blue-50 p-2 text-blue-700"
                onClick={() => setAlertForm({ darId: dar.id, title: '', content: '', kind: 'NOTICE' })}
              >
                إشعار
              </button>
              <button className="rounded-xl bg-amber-50 p-2 text-amber-700" onClick={() => void suspendToggle(dar)}>
                {dar.status === 'معلق' ? 'تنشيط' : 'تعليق'}
              </button>
              <button className="rounded-xl bg-red-50 p-2 text-red-600 sm:col-span-2" onClick={() => void deleteDar(dar.id)}>
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

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
            <input className="ios-input" placeholder="رابط الموقع (اختياري)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <button className="btn-primary" onClick={() => void addDar()}>
              حفظ
            </button>
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
                <span className="text-xs font-bold">{s.status}</span>
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
          <h3 className="text-lg font-bold text-burgundy">{title}</h3>
          <button onClick={onClose} className="text-2xl text-gray-400">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
