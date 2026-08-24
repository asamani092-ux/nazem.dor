import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { Field, Input } from '../components/ds';

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
    <div className="ds-login">
      <form onSubmit={onSubmit} className="ds-login-card">
        <div className="ds-login-brand">
          <img src="/logo.png" alt="" className="ds-login-logo" />
          <div className="ds-login-title">ناظم الصغار</div>
          <div className="ds-login-sub">نظام إدارة دور التحفيظ — بريدة</div>
        </div>
        <div className="ds-login-fields">
          <Field label="رقم الجوال">
            <Input
              className="text-left font-semibold tracking-widest"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              inputMode="numeric"
              required
              error={!!error}
            />
          </Field>
          {error ? <p className="ds-field-error">{error}</p> : null}
          <button className="ds-btn ds-btn-primary" disabled={busy} type="submit">
            {busy ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </div>
      </form>
    </div>
  );
}
