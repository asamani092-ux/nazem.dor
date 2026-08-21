import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg">
        <span className="text-3xl text-burgundy">📖</span>
      </div>
      <h1 className="mb-2 text-3xl font-bold text-burgundy">دور التحفيظ</h1>
      <p className="mb-10 text-center text-ios-muted">نظام إدارة دور التحفيظ النسائية</p>
      <form onSubmit={onSubmit} className="ios-card w-full max-w-sm space-y-4 p-6">
        <div>
          <label className="mb-2 block text-xs font-bold text-gray-500">رقم الجوال</label>
          <input
            className="ios-input text-left font-semibold tracking-widest"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05XXXXXXXX"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold text-gray-500">كلمة المرور</label>
          <input
            type="password"
            className="ios-input text-left"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );
}
