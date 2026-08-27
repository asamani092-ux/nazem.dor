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
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(path, {
      ...options,
      headers,
      body,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({
      status: 'error',
      message: 'استجابة غير صالحة من السيرفر',
    }))) as { status?: string; message?: string } & T;

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

export function waLink(phone: string) {
  let p = String(phone || '').trim();
  if (p.startsWith('0')) p = p.slice(1);
  return `https://wa.me/966${p}`;
}
