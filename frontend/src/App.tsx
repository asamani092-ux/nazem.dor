import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { MasterPage } from './pages/MasterPage';
import { ManagerPage } from './pages/ManagerPage';
import { TeacherPage } from './pages/TeacherPage';

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

  if (user.role === 'SUPER_MASTER' || user.role === 'MASTER') return <MasterPage />;
  if (user.role === 'MANAGER') return <ManagerPage />;
  if (user.role === 'TEACHER') return <TeacherPage />;
  return <LoginPage />;
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
