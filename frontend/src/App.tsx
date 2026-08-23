import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { MasterPage } from './pages/MasterPage';
import { ManagerPage } from './pages/ManagerPage';
import { TeacherPage } from './pages/TeacherPage';
import { Spinner } from './components/ui/Spinner';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

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
