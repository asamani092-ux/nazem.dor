export type Role = 'SUPER_MASTER' | 'GENERAL_DIRECTOR' | 'MASTER' | 'MANAGER' | 'TEACHER';

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  darId?: string | null;
  darName?: string;
  classId?: string | null;
  className?: string;
  classLevel?: string;
  mustChangePassword?: boolean;
};

const TOKEN_KEY = 'nazem_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const timeoutMs = options.timeoutMs ?? 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { json: _json, timeoutMs: _timeoutMs, ...fetchOpts } = options;

  try {
    const res = await fetch(path, {
      ...fetchOpts,
      headers,
      body,
      signal: controller.signal,
    });
    const raw = await res.text();
    let data: { status?: string; message?: string } & T;
    try {
      data = (raw ? JSON.parse(raw) : {}) as { status?: string; message?: string } & T;
    } catch {
      const unavailable = res.status === 502 || res.status === 503 || res.status === 504;
      throw new Error(
        unavailable
          ? 'السيرفر غير متاح حالياً — أعد نشر التطبيق من Coolify ثم حاول مجدداً'
          : 'استجابة غير صالحة من السيرفر',
      );
    }

    if (!res.ok) {
      throw new Error((data as { message?: string }).message || `فشل الطلب (${res.status})`);
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بالسيرفر');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** رفع ملف multipart — Time O(size) شبكة؛ لا تُضبط Content-Type يدوياً. */
export async function apiUpload<T = unknown>(path: string, file: File, timeoutMs = 120_000): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  return api<T>(path, { method: 'POST', body: fd, timeoutMs });
}

export function waLink(phone: string) {
  let p = String(phone || '').trim();
  if (p.startsWith('0')) p = p.slice(1);
  return `https://wa.me/966${p}`;
}
