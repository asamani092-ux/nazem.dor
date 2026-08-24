import { useEffect, useState } from 'react';
import { api, waLink } from '../lib/api';
import { formatHomework } from '../lib/format';
import { useAuth } from '../auth';
import { Field, Input, Select, Button, Banner, AppShell, BottomSheet, TrackToggle, DayButton, Card, ActionChip } from '../components/ds';

type Student = { id: string; name: string; parentPhone: string };
type Alert = { id?: string; title: string; content: string; date: string; isRead?: boolean };
type Exam = { id: string; title: string; date: string; link?: string };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

type TrackState = {
  attendance: string;
  educational: string;
  homework: string;
  tarbawi: string;
};

export function TeacherPage() {
  const { user, logout } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [week, setWeek] = useState('');
  const [day, setDay] = useState('');
  const [tracked, setTracked] = useState<string[]>([]);
  const [plan, setPlan] = useState<{ educational: string; homework: string; tarbawi: string } | null>(null);
  const [states, setStates] = useState<Record<string, TrackState>>({});
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [examsOpen, setExamsOpen] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [grading, setGrading] = useState<Exam | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});

  const isTamheedi = String(user?.classLevel || '').includes('تمهيدي');
  const isAwwalia = String(user?.classLevel || '').replace(/أ/g, 'ا').includes('اولي');
  const weekCount = isTamheedi ? 15 : 10;

  async function loadDashboard() {
    const res = await api<{ data: { alerts: Alert[]; students: Student[] } }>('/api/teacher/dashboard');
    setAlerts(res.data.alerts);
    setStudents(res.data.students);
    const init: Record<string, TrackState> = {};
    for (const s of res.data.students) {
      init[s.id] = { attendance: 'حاضرة', educational: 'أتقنت', homework: 'أنجزت', tarbawi: 'أتقنت' };
    }
    setStates(init);
  }

  useEffect(() => {
    void loadDashboard().catch((e) => setMsg(e.message));
  }, []);

  async function loadTracked(w: string) {
    setWeek(w);
    setDay('');
    setPlan(null);
    const res = await api<{ data: string[] }>(`/api/teacher/tracked-days?week=${w}`);
    setTracked(res.data);
  }

  async function fetchPlan() {
    if (!week || !day) return setMsg('اختاري الأسبوع واليوم');
    const res = await api<{ educational: string; homework: string; tarbawi: string }>(
      `/api/teacher/lesson-plan?level=${encodeURIComponent(user?.classLevel || '')}&week=${week}&day=${encodeURIComponent(day)}`,
    );
    setPlan(res);

    const prior = await api<{
      data: Array<{
        studentId: string;
        attendance: string;
        homework: string;
        educational: string;
        tarbawi: string;
      }>;
    }>(`/api/teacher/tracking?week=${week}&day=${encodeURIComponent(day)}`);

    if (prior.data.length > 0) {
      setStates((prev) => {
        const next = { ...prev };
        for (const row of prior.data) {
          next[row.studentId] = {
            attendance: row.attendance,
            homework: row.homework,
            educational: row.educational,
            tarbawi: row.tarbawi || 'أتقنت',
          };
        }
        return next;
      });
      setMsg('تم تحميل الرصد السابق لهذا اليوم — يمكن التعديل ثم الحفظ');
    }
  }

  function toggle(studentId: string, field: keyof TrackState) {
    setStates((prev) => {
      const cur = prev[studentId];
      const next = { ...cur };
      if (field === 'attendance') {
        next.attendance = cur.attendance === 'حاضرة' ? 'غائبة' : 'حاضرة';
        if (next.attendance === 'غائبة') {
          next.educational = '-';
          next.homework = '-';
          next.tarbawi = '-';
        } else {
          next.educational = 'أتقنت';
          next.homework = 'أنجزت';
          next.tarbawi = 'أتقنت';
        }
      } else if (field === 'educational' || field === 'tarbawi') {
        next[field] = cur[field] === 'أتقنت' ? 'لم تتقن' : 'أتقنت';
      } else if (field === 'homework') {
        next.homework = cur.homework === 'أنجزت' ? 'لم تنجز' : 'أنجزت';
      }
      return { ...prev, [studentId]: next };
    });
  }

  async function submitTracking() {
    if (!plan || !week || !day) return setMsg('يجب جلب المقرر أولاً');
    let attachment = '';
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('nazem_token');
      const up = await fetch('/api/teacher/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.message || 'فشل الرفع');
      attachment = upData.url;
    }

    const trackingData = students.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      ...states[s.id],
      attachment,
    }));

    await api('/api/teacher/tracking', {
      method: 'POST',
      json: {
        date: new Date().toLocaleDateString('en-GB'),
        week: Number(week),
        day,
        trackingData,
      },
    });
    setMsg('تم حفظ الرصد');
    setPlan(null);
    setFile(null);
    await loadTracked(week);
  }

  async function openExams() {
    const res = await api<{ data: Exam[] }>('/api/teacher/exams/pending');
    setExams(res.data);
    setExamsOpen(true);
    setGrading(null);
  }

  async function saveGrades() {
    if (!grading) return;
    await api(`/api/teacher/exams/${grading.id}/grades`, {
      method: 'POST',
      json: {
        examTitle: grading.title,
        gradesData: students.map((s) => ({
          studentId: s.id,
          name: s.name,
          score: scores[s.id] || 'غائبة',
        })),
      },
    });
    setMsg('تم حفظ الدرجات');
    await openExams();
  }

  async function sendReport(student: Student) {
    const res = await api<{ data: { attRate: number; compRate: number; examRate: number } }>(
      `/api/teacher/students/${student.id}/report`,
    );
    const d = res.data;
    const msgText =
      `السلام عليكم ورحمة الله وبركاته\n` +
      `📝 تقرير الطالبة: ${student.name}\n` +
      `🏫 الفصل: ${user?.className}\n` +
      `📅 التاريخ: ${new Date().toLocaleDateString('en-GB')}\n\n` +
      `🔸 نسبة الحضور: %${d.attRate}\n` +
      `🔸 نسبة الإنجاز: %${d.compRate}\n` +
      `🔸 متوسط الاختبارات: %${d.examRate}`;
    window.open(`${waLink(student.parentPhone)}?text=${encodeURIComponent(msgText)}`, '_blank');
  }

  return (
    <AppShell
      title="ناظم الصغار"
      subtitle={user?.className || 'فصل التحفيظ'}
      userName={user?.name || ''}
      userRole={user?.role || ''}
      contextLine={user?.classLevel}
      nav={[
        { key: 'track', label: 'الرصد' },
        { key: 'exams', label: 'الاختبارات' },
      ]}
      active={examsOpen ? 'exams' : 'track'}
      onNav={(k) => {
        if (k === 'exams') void openExams();
        else setExamsOpen(false);
      }}
      onLogout={logout}
    >
      {msg ? <Banner tone="success" onClose={() => setMsg('')}>{msg}</Banner> : null}
        {alerts.map((a, i) => (
          <div
            key={a.id || i}
            className={`rounded-xl border-r-4 border-blue-500 bg-blue-50/50 p-3 ${a.isRead ? 'opacity-60' : ''}`}
          >
            <div className="flex justify-between">
              <h4 className="text-xs font-bold text-blue-800">{a.title}</h4>
              <span className="text-[8px] text-blue-400">{a.date}</span>
            </div>
            {String(a.content).startsWith('http') ? (
              <a className="mt-2 inline-block text-[10px] font-bold text-blue-600" href={a.content} target="_blank" rel="noreferrer">
                فتح الرابط
              </a>
            ) : (
              <p className="mt-1 text-[11px] text-gray-600">{a.content}</p>
            )}
            {a.id && !a.isRead ? (
              <button
                className="mt-2 rounded-full bg-white px-3 py-1 text-[9px] font-bold text-blue-700"
                onClick={async () => {
                  await api(`/api/teacher/notifications/${a.id}/read`, { method: 'POST' });
                  await loadDashboard();
                }}
              >
                تحديد كمقروء
              </button>
            ) : null}
          </div>
        ))}

        <Button variant="secondary" className="w-full" onClick={() => void openExams()}>
          مركز الاختبارات
        </Button>

        <Card className="space-y-3">
          <h3 className="text-sm font-bold text-primary">خطة الرصد</h3>
          <Field label="الأسبوع">
            <select className="ds-input" value={week} onChange={(e) => void loadTracked(e.target.value)}>
              <option value="">اختيار الأسبوع...</option>
              {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  الأسبوع {w}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <p className="mb-1 text-[10px] font-bold text-gray-500">اليوم</p>
            <div className="flex flex-wrap justify-between gap-2">
              {DAYS.map((d) => {
                const done = tracked.includes(d);
                const selected = day === d;
                return (
                  <DayButton key={d} day={d} done={done} selected={selected} onClick={() => setDay(d)} />
                );
              })}
            </div>
          </div>
          <button className="ds-btn ds-btn-primary" onClick={() => void fetchPlan()}>
            جلب المقرر للرصد
          </button>
        </Card>

        {plan ? (
          <>
            <div className="ds-card ds-card-pad space-y-1 p-4 text-[11px] font-bold">
              <p>
                الدرس: <span className="text-gray-900">{plan.educational}</span>
              </p>
              <p>
                الواجب: <span className="text-gray-900">{formatHomework(plan.homework)}</span>
              </p>
              {isAwwalia && plan.tarbawi ? (
                <p>
                  تربوي: <span className="text-gray-900">{plan.tarbawi}</span>
                </p>
              ) : null}
              <Field label="مرفق (اختياري)">
                <input type="file" className="ds-input mt-1" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </Field>
            </div>

            {students.map((s, idx) => {
              const st = states[s.id];
              return (
                <div key={s.id} className="ds-card ds-card-pad p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold">
                      {idx + 1}. {s.name}
                    </h3>
                    <div className="flex gap-2">
                      <button className="ds-chip ds-chip-report" onClick={() => void sendReport(s)}>
                        تقرير
                      </button>
                      <a className="ds-chip ds-chip-wa" href={waLink(s.parentPhone)} target="_blank" rel="noreferrer">
                        واتساب
                      </a>
                    </div>
                  </div>
                  <div className={`mb-1 grid gap-2 text-center text-[8px] font-bold text-gray-400 ${isAwwalia ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    <span>الحضور</span>
                    <span>الإنجاز</span>
                    <span>الواجب</span>
                    {isAwwalia ? <span>التربوي</span> : null}
                  </div>
                  <div className={`grid gap-2 ${isAwwalia ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    <TrackToggle label={st.attendance} onClick={() => toggle(s.id, 'attendance')} />
                    <TrackToggle label={st.educational} onClick={() => toggle(s.id, 'educational')} />
                    <TrackToggle label={st.homework} onClick={() => toggle(s.id, 'homework')} />
                    {isAwwalia ? <TrackToggle label={st.tarbawi} onClick={() => toggle(s.id, 'tarbawi')} /> : null}
                  </div>
                </div>
              );
            })}

            <button
              className="ds-btn ds-btn-primary !bg-[#16a34a]"
              onClick={() => void submitTracking().catch((e) => setMsg(e.message))}
            >
              اعتماد وحفظ الرصد
            </button>
          </>
        ) : null}

      {examsOpen ? (
        <BottomSheet
          title={grading ? `رصد: ${grading.title}` : 'مركز الاختبارات'}
          onClose={() => setExamsOpen(false)}
        >
          {!grading ? (
            exams.length === 0 ? (
              <p className="py-6 text-center text-sm text-ios-muted">لا توجد اختبارات معلقة</p>
            ) : (
              <div className="flex flex-col gap-2">
                {exams.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between rounded-[14px] bg-shell p-3.5">
                    <div>
                      <div className="text-sm font-bold">{ex.title}</div>
                      <div className="text-xs text-ios-muted">{ex.date}</div>
                    </div>
                    <Button variant="chip-primary" onClick={() => setGrading(ex)}>رصد الدرجات</Button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              <div className="mb-2 flex justify-between text-[10px] font-bold text-ios-muted">
                <span>الطالبة</span>
                <span>الدرجة</span>
              </div>
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-shell p-3">
                  <span className="text-xs font-bold">{s.name}</span>
                  <Input
                    type="number"
                    className="!w-20 !py-2 text-center text-xs"
                    aria-label={`درجة ${s.name}`}
                    placeholder="0"
                    value={scores[s.id] || ''}
                    onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                  />
                </div>
              ))}
              <Button variant="primary" onClick={() => void saveGrades()}>حفظ الاعتماد</Button>
            </div>
          )}
          <Button variant="primary" className="mt-4" onClick={() => setExamsOpen(false)}>إغلاق</Button>
        </BottomSheet>
      ) : null}
    </AppShell>
  );
}
