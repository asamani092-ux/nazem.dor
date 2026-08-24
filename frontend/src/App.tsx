import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { MasterPage } from './pages/MasterPage';
import { ManagerPage } from './pages/ManagerPage';
import { TeacherPage } from './pages/TeacherPage';
import { ToolsAuditPage } from './pages/ToolsAuditPage';
import { Spinner } from './components/ds/Spinner';
import { ThemeProvider } from './components/ds/theme';
import { ToastProvider } from './components/ds/Toast';

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
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoot />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AppRoot() {
  const { user, loading } = useAuth();
  const wide = !loading && !!user;

  if (!loading && user && window.location.pathname === '/tools-audit') {
    if (user.role !== 'SUPER_MASTER') {
      window.location.href = '/';
      return null;
    }
    return (
      <div className="flex justify-center" dir="rtl" lang="ar">
        <div className="app-shell app-shell-wide">
          <ToolsAuditPage />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen" dir="rtl" lang="ar">
      <div className={wide ? 'app-shell app-shell-wide' : 'app-shell app-shell-wide'}>
        <AppRouter />
      </div>
    </div>
  );
}
