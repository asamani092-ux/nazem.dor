import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { MasterPage } from './pages/MasterPage';
import { ManagerPage } from './pages/ManagerPage';
import { TeacherPage } from './pages/TeacherPage';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-burgundy">
        جاري التحميل...
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
