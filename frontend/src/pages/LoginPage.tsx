import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { Field, Input, Card } from '../components/ds';

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
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[18px] bg-white shadow-lg">
        <img src="/favicon.svg" alt="" className="h-12 w-12" aria-hidden="true" />
      </div>
      <h1 className="mb-2 text-2xl font-extrabold text-primary sm:text-[28px]">دور التحفيظ</h1>
      <p className="mb-8 text-center text-sm text-ios-muted sm:mb-10">نظام إدارة دور التحفيظ النسائية — ناظم الصغار</p>
      <form onSubmit={onSubmit} className="w-full max-w-md">
        <Card className="space-y-4">
          <Field label="رقم الجوال">
            <Input
              className="text-left font-semibold tracking-widest"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              required
              error={!!error}
            />
          </Field>
          {error ? <p className="ds-field-error">{error}</p> : null}
          <button className="ds-btn ds-btn-primary" disabled={busy} type="submit">
            {busy ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </Card>
      </form>
    </div>
  );
}
