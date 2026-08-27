import { useEffect, useState } from 'react';
import { api, waLink } from '../lib/api';
import { formatHomework } from '../lib/format';
import { useAuth } from '../auth';
import { usePageFeedback } from '../hooks/usePageFeedback';
import {
  Field,
  Input,
  Button,
  Banner,
  AppShell,
  BottomSheet,
  TrackToggle,
  DayButton,
  Card,
  IconButton,
  IconReport,
  NotificationCard,
  FileUpload,
  ViewToggle,
  DataTable,
} from '../components/ds';
import { IconWhatsApp } from '../components/ds/Icons';
import { useToast } from '../components/ds/Toast';

type Student = { id: string; name: string; parentPhone: string };
type Alert = { id?: string; title: string; content: string; date: string; isRead?: boolean };
type Exam = { id: string; title: string; date: string; link?: string; maxScore?: number };
type WeekAttachmentRow = { week: number; url: string; fileName: string; uploadedAt: string };
type GradedExam = Exam & { grades: Array<{ studentId: string; name: string; score: string; note: string }> };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

type TrackState = {
  attendance: string;
  educational: string;
  homework: string;
  tarbawi: string;
};

export function TeacherPage() {
  const { user, logout } = useAuth();
  const { banner, notify, clearBanner } = usePageFeedback();
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [week, setWeek] = useState('');
  const [day, setDay] = useState('');
  const [tracked, setTracked] = useState<string[]>([]);
  const [plan, setPlan] = useState<{ educational: string; homework: string; tarbawi: string } | null>(null);
  const [states, setStates] = useState<Record<string, TrackState>>({});
  const [file, setFile] = useState<File | null>(null);
  const [teacherTab, setTeacherTab] = useState<'track' | 'alerts' | 'exams'>('track');
  const [weekAttachments, setWeekAttachments] = useState<WeekAttachmentRow[]>([]);
  const [trackView, setTrackView] = useState<'cards' | 'table'>('cards');
  const [examTab, setExamTab] = useState<'pending' | 'graded'>('pending');
  const [pendingExams, setPendingExams] = useState<Exam[]>([]);
  const [gradedExams, setGradedExams] = useState<GradedExam[]>([]);
  const [grading, setGrading] = useState<Exam | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
    await loadWeekAttachments();
  }

  async function loadWeekAttachments() {
    const res = await api<{ data: WeekAttachmentRow[] }>('/api/teacher/week-attachments');
    setWeekAttachments(res.data);
  }

  useEffect(() => {
    void loadDashboard().catch((e) => notify(e.message, 'error'));
  }, []);

  const currentWeekAttachment = weekAttachments.find((a) => a.week === Number(week));

  async function loadTracked(w: string) {
    setWeek(w);
    setDay('');
    setPlan(null);
    const res = await api<{ data: string[] }>(`/api/teacher/tracked-days?week=${w}`);
    setTracked(res.data);
  }

  async function fetchPlan() {
    if (!week || !day) return notify('اختاري الأسبوع واليوم', 'error');
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
        attachment?: string;
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
      toast.warn('يوجد رصد سابق — سيتم التعديل عند الحفظ');
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
    if (!plan || !week || !day) return notify('يجب جلب المقرر أولاً', 'error');
    if (tracked.includes(day)) toast.warn('يوجد رصد — سيتم التعديل');
    setSubmitting(true);
    try {
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
        await api('/api/teacher/week-attachments', {
          method: 'POST',
          json: { week: Number(week), url: upData.url, fileName: file.name },
        });
      }

      const trackingData = students.map((s) => ({
        studentId: s.id,
        studentName: s.name,
        ...states[s.id],
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
      notify('تم حفظ الرصد');
      setTracked((prev) => (prev.includes(day) ? prev : [...prev, day]));
      setPlan(null);
      setFile(null);
      await loadWeekAttachments();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'خطأ', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function openExams() {
    setTeacherTab('exams');
    try {
      const res = await api<{ data: { pending: Exam[]; graded: GradedExam[] } }>('/api/teacher/exams');
      setPendingExams(res.data.pending);
      setGradedExams(res.data.graded);
      setGrading(null);
      setExamTab('pending');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'تعذر فتح الاختبارات', 'error');
      setPendingExams([]);
      setGradedExams([]);
    }
  }

  function startGrading(ex: Exam, existing?: GradedExam) {
    setGrading(ex);
    const sc: Record<string, string> = {};
    const nt: Record<string, string> = {};
    if (existing) {
      for (const g of existing.grades) {
        sc[g.studentId] = g.score;
        nt[g.studentId] = g.note || '';
      }
    }
    setScores(sc);
    setNotes(nt);
  }

  async function saveGrades() {
    if (!grading) return;
    const cap = grading.maxScore ?? 100;
    for (const s of students) {
      const raw = (scores[s.id] || '').trim();
      if (!raw || raw === 'غائبة') continue;
      const value = Number(raw);
      if (Number.isNaN(value)) {
        notify(`درجة غير صالحة للطالبة ${s.name} — أدخلي رقماً أو اتركيها فارغة`, 'error');
        return;
      }
      if (value < 0 || value > cap) {
        notify(`درجة ${s.name} (${raw}) تتجاوز سقف الاختبار ${cap}`, 'error');
        return;
      }
    }
    await api(`/api/teacher/exams/${grading.id}/grades`, {
      method: 'POST',
      json: {
        examTitle: grading.title,
        gradesData: students.map((s) => ({
          studentId: s.id,
          name: s.name,
          score: scores[s.id] || 'غائبة',
          note: notes[s.id] || '',
        })),
      },
    });
    notify('تم حفظ الدرجات');
    await openExams();
    setGrading(null);
  }

  async function sendReport(student: Student) {
    const res = await api<{ data: { attRate: number; compRate: number; examRate: number } }>(
      `/api/teacher/students/${student.id}/report`,
    );
    const d = res.data;
    const msgText =
      `السلام عليكم ورحمة الله وبركاته\n` +
      `تقرير الطالبة: ${student.name}\n` +
      `الفصل: ${user?.className || ''}\n` +
      `التاريخ: ${new Date().toLocaleDateString('en-GB')}\n\n` +
      `نسبة الحضور: ${d.attRate}%\n` +
      `نسبة الإنجاز: ${d.compRate}%\n` +
      `متوسط الاختبارات: ${d.examRate}%`;
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
        { key: 'alerts', label: 'التنبيهات' },
        { key: 'exams', label: 'الاختبارات' },
      ]}
      active={teacherTab}
      onNav={(k) => {
        if (k === 'exams') void openExams();
        else setTeacherTab(k as 'track' | 'alerts');
      }}
      onLogout={logout}
    >
      {banner ? <Banner tone={banner.tone} onClose={clearBanner}>{banner.text}</Banner> : null}

      {teacherTab === 'alerts' ? (
        <div className="space-y-3">
          {alerts.map((a, i) => (
            <NotificationCard
              key={a.id || i}
              title={a.title}
              date={a.date}
              isRead={a.isRead}
              content={String(a.content).startsWith('http') ? 'رابط خارجي' : a.content}
              actions={
                <>
                  {String(a.content).startsWith('http') ? (
                    <a className="ds-btn ds-btn-secondary !w-auto !px-3 !py-1 text-xs" href={a.content} target="_blank" rel="noreferrer">
                      فتح الرابط
                    </a>
                  ) : null}
                  {a.id && !a.isRead ? (
                    <button
                      type="button"
                      className="ds-btn ds-btn-secondary !w-auto !px-3 !py-1 text-xs"
                      onClick={() =>
                        void api(`/api/teacher/notifications/${a.id}/read`, { method: 'POST' }).then(() => loadDashboard())
                      }
                    >
                      تحديد كمقروء
                    </button>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      ) : null}

      {teacherTab === 'track' ? (
        <>
          <Card className="space-y-3">
            <h3 className="text-sm font-bold text-primary">خطة الرصد</h3>
            <Field label="الأسبوع">
              <select className="ds-input" value={week} onChange={(e) => void loadTracked(e.target.value)}>
                <option value="">اختيار الأسبوع...</option>
                {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>الأسبوع {w}</option>
                ))}
              </select>
            </Field>
            <div>
              <p className="mb-2 text-[10px] font-bold text-gray-500">اليوم</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <DayButton
                    key={d}
                    day={d}
                    done={tracked.includes(d)}
                    selected={day === d}
                    onClick={() => setDay(d)}
                  />
                ))}
              </div>
            </div>
            <button className="ds-btn ds-btn-primary" onClick={() => void fetchPlan().catch((e) => notify(e.message, 'error'))}>
              جلب المقرر للرصد
            </button>
          </Card>

          {plan ? (
            <>
              <div className="ds-card ds-card-pad space-y-2 p-4 text-sm font-bold">
                <p className="text-base font-extrabold text-primary">المقرر</p>
                <p>الدرس: <span className="text-gray-900">{plan.educational}</span></p>
                <p>الواجب: <span className="text-gray-900">{formatHomework(plan.homework)}</span></p>
                {isAwwalia && plan.tarbawi ? (
                  <p>تربوي: <span className="text-gray-900">{plan.tarbawi}</span></p>
                ) : null}
                <div className="mt-2 rounded-xl bg-shell p-3">
                  <p className="text-xs font-extrabold text-primary">مرفق الفصل — الأسبوع {week}</p>
                  <p className="mt-1 text-[11px] font-semibold text-ios-muted">
                    ملف واحد لكل أسبوع (صورة أو PDF) يظهر لمديرة الدار والمشرفة. رفع ملف جديد يستبدل السابق.
                  </p>
                  {currentWeekAttachment ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <a className="font-bold text-primary" href={currentWeekAttachment.url} target="_blank" rel="noreferrer">
                        عرض المرفق الحالي ({currentWeekAttachment.fileName || 'ملف'})
                      </a>
                      <span className="text-[10px] text-ios-muted">رُفع {currentWeekAttachment.uploadedAt}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-bold text-amber-600">لم يُرفع مرفق لهذا الأسبوع بعد.</p>
                  )}
                  <div className="mt-2">
                    <FileUpload label="رفع/استبدال مرفق الأسبوع" fileName={file?.name} onChange={setFile} accept="image/*,.pdf" />
                  </div>
                </div>
              </div>

              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-primary">رصد الطالبات</h3>
                <ViewToggle mode={trackView} onTable={() => setTrackView('table')} onCards={() => setTrackView('cards')} />
              </div>

              {trackView === 'cards' ? (
                students.map((s, idx) => {
                  const st = states[s.id];
                  if (!st) return null;
                  return (
                    <div key={s.id} className="ds-card ds-card-pad p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-extrabold">{idx + 1}. {s.name}</h3>
                        <div className="flex gap-2">
                          <IconButton label="تقرير" tone="report" onClick={() => void sendReport(s)}><IconReport /></IconButton>
                          <IconButton label="واتساب" tone="wa" onClick={() => void sendReport(s)}><IconWhatsApp /></IconButton>
                        </div>
                      </div>
                      <div className={`mb-1 grid gap-2 text-center text-[9px] font-bold text-gray-400 ${isAwwalia ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
                })
              ) : (
                <DataTable
                  head={
                    <tr>
                      <th>#</th>
                      <th>الطالبة</th>
                      <th>الحضور</th>
                      <th>الإنجاز</th>
                      <th>الواجب</th>
                      {isAwwalia ? <th>التربوي</th> : null}
                      <th>إجراءات</th>
                    </tr>
                  }
                >
                  {students.map((s, idx) => {
                    const st = states[s.id];
                    if (!st) return null;
                    return (
                      <tr key={s.id}>
                        <td>{idx + 1}</td>
                        <td className="font-bold whitespace-nowrap">{s.name}</td>
                        <td><TrackToggle label={st.attendance} onClick={() => toggle(s.id, 'attendance')} /></td>
                        <td><TrackToggle label={st.educational} onClick={() => toggle(s.id, 'educational')} /></td>
                        <td><TrackToggle label={st.homework} onClick={() => toggle(s.id, 'homework')} /></td>
                        {isAwwalia ? <td><TrackToggle label={st.tarbawi} onClick={() => toggle(s.id, 'tarbawi')} /></td> : null}
                        <td>
                          <div className="ds-table-actions">
                            <IconButton label="تقرير" tone="report" onClick={() => void sendReport(s)}><IconReport /></IconButton>
                            <IconButton label="واتساب" tone="wa" onClick={() => void sendReport(s)}><IconWhatsApp /></IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}

              <button
                className="ds-btn ds-btn-primary !bg-[#16a34a] !border-[#15803d]"
                disabled={submitting}
                onClick={() => void submitTracking()}
              >
                {submitting ? 'جاري الحفظ...' : 'اعتماد وحفظ الرصد'}
              </button>
            </>
          ) : null}
        </>
      ) : null}

      {teacherTab === 'exams' ? (
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold text-primary">الاختبارات</h3>
          {!students.length ? (
            <p className="rounded-xl bg-shell p-4 text-center text-sm text-ios-muted">لا توجد طالبات في الفصل — أضيفي طالبات من حساب المديرة أولاً.</p>
          ) : null}
          <div className="flex gap-2">
            <Button variant={examTab === 'pending' ? 'primary' : 'secondary'} className="!w-auto !px-3" onClick={() => setExamTab('pending')}>
              معلّق ({pendingExams.length})
            </Button>
            <Button variant={examTab === 'graded' ? 'primary' : 'secondary'} className="!w-auto !px-3" onClick={() => setExamTab('graded')}>
              مُرصود ({gradedExams.length})
            </Button>
          </div>
          {examTab === 'pending' ? (
            pendingExams.length === 0 ? (
              <p className="py-6 text-center text-sm text-ios-muted">لا توجد اختبارات معلقة</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pendingExams.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between rounded-[14px] bg-shell p-3.5">
                    <div>
                      <div className="text-sm font-bold">{ex.title}</div>
                      <div className="text-xs text-ios-muted">{ex.date} · الدرجة الكاملة {ex.maxScore ?? 100}</div>
                    </div>
                    <Button variant="chip-primary" disabled={!students.length} onClick={() => startGrading(ex)}>رصد</Button>
                  </div>
                ))}
              </div>
            )
          ) : gradedExams.length === 0 ? (
            <p className="py-6 text-center text-sm text-ios-muted">لا توجد اختبارات مرصودة</p>
          ) : (
            <div className="flex flex-col gap-2">
              {gradedExams.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between rounded-[14px] bg-shell p-3.5">
                  <div>
                    <div className="text-sm font-bold">{ex.title}</div>
                    <div className="text-xs text-ios-muted">{ex.date} · مُرصود · الدرجة الكاملة {ex.maxScore ?? 100}</div>
                  </div>
                  <Button variant="chip-primary" onClick={() => startGrading(ex, ex)}>تعديل</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {grading ? (
        <BottomSheet title={`رصد درجات: ${grading.title}`} onClose={() => setGrading(null)}>
          <div className="space-y-3">
            <div className="rounded-lg bg-primary-soft p-3 text-xs font-bold text-primary">
              الدرجة الكاملة لهذا الاختبار: {grading.maxScore ?? 100}
              <span className="mt-1 block text-[10px] font-semibold text-ios-muted">
                اكتبي درجة كل طالبة من 0 إلى {grading.maxScore ?? 100}. اتركي الحقل فارغاً إذا كانت غائبة. الملاحظة اختيارية.
              </span>
            </div>
            {students.map((s) => (
              <div key={s.id} className="rounded-lg bg-shell p-3 space-y-2">
                <span className="text-sm font-extrabold">{s.name}</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={`الدرجة (من ${grading.maxScore ?? 100})`}>
                    <div>
                      <Input
                        type="number"
                        min={0}
                        max={grading.maxScore ?? 100}
                        className="!py-2 text-center text-sm font-bold"
                        aria-label={`درجة ${s.name}`}
                        placeholder={`0 - ${grading.maxScore ?? 100}`}
                        value={scores[s.id] || ''}
                        onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                      />
                      <p className="mt-1 text-[10px] text-ios-muted">فارغة = غائبة</p>
                    </div>
                  </Field>
                  <Field label="ملاحظة (اختياري)">
                    <Input
                      className="!py-2 text-xs"
                      placeholder="مثال: أداء ممتاز"
                      value={notes[s.id] || ''}
                      onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Button variant="primary" onClick={() => void saveGrades().catch((e) => notify(e.message, 'error'))}>
              حفظ الاعتماد
            </Button>
          </div>
        </BottomSheet>
      ) : null}
    </AppShell>
  );
}
