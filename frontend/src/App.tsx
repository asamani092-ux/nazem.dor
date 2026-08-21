import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { MasterPage } from './pages/MasterPage';
import { ManagerPage } from './pages/ManagerPage';
import { TeacherPage } from './pages/TeacherPage';
import { useState, type FormEvent } from 'react';
import { api } from './lib/api';

function ChangePasswordGate({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user?.mustChangePassword) return <>{children}</>;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        json: { currentPassword, newPassword },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التغيير');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="ios-card w-full max-w-sm space-y-3 p-6">
        <h2 className="text-lg font-bold text-[#7A1F3D]">تغيير كلمة المرور مطلوب</h2>
        <p className="text-xs text-gray-500">لأمان الحساب، يجب تعيين كلمة مرور جديدة قبل المتابعة.</p>
        <input
          type="password"
          className="ios-input text-left"
          dir="ltr"
          placeholder="كلمة المرور الحالية"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <input
          type="password"
          className="ios-input text-left"
          dir="ltr"
          placeholder="كلمة المرور الجديدة (6+)"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          minLength={6}
          required
        />
        {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'جاري الحفظ...' : 'حفظ والمتابعة'}
        </button>
      </form>
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-[#7A1F3D]" />
        <p className="text-sm font-bold text-[#7A1F3D]">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  let screen = <LoginPage />;
  if (user.role === 'SUPER_MASTER' || user.role === 'MASTER') screen = <MasterPage />;
  else if (user.role === 'MANAGER') screen = <ManagerPage />;
  else if (user.role === 'TEACHER') screen = <TeacherPage />;

  return <ChangePasswordGate>{screen}</ChangePasswordGate>;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex justify-center" dir="rtl" lang="ar">
        <div className="app-shell">
          <AppRouter />
        </div>
      </div>
    </AuthProvider>
  );
}
