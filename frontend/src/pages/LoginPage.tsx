import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(phone.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg ring-4 ring-primary-soft">
        <img src="/favicon.svg" alt="" className="h-12 w-12" aria-hidden="true" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-primary sm:text-3xl">دور التحفيظ</h1>
      <p className="mb-8 text-center text-sm text-ios-muted sm:mb-10">نظام إدارة دور التحفيظ النسائية — ناظم الصغار</p>
      <form onSubmit={onSubmit} className="ios-card w-full max-w-md space-y-4 p-6 sm:p-8">
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
        {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );
}
