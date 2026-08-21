# ناظم الصغار — دور التحفيظ

منصة احترافية بديلة لنموذج Google Apps Script.

## المكدس
- Frontend: React + Vite + Tailwind (RTL)
- Backend: Fastify + Prisma + PostgreSQL
- نشر: Docker Compose على VPS + دومين العميل

## التجربة المحلية
```bash
cp .env.example .env
docker compose up --build
```
- الواجهة: http://localhost:8080
- API: http://localhost:4000/api/health
- الدخول الافتراضي: `0555143246` / `Nazem@123`

## التطوير بدون Docker للواجهة
```bash
# طرفية 1: قاعدة البيانات عبر compose
docker compose up -d db

# طرفية 2: API
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev

# طرفية 3: Frontend
cd frontend
npm install
npm run dev
```

## النشر على VPS
```bash
cp .env.example .env
# عدّل كلمات المرور و JWT_SECRET و PUBLIC_URL و الدومين
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```
اربط الدومين بـ IP السيرفر، ثم فعّل HTTPS (certbot) باستخدام `nginx/nazem.conf.example` إن رغبت reverse-proxy خارجي.

## الأدوار
| الدور | الوصف |
|------|------|
| SUPER_MASTER | مدير النظام + إدارة المشرفات |
| MASTER | مشرفة عامة |
| MANAGER | مديرة دار |
| TEACHER | معلمة فصل |

كلمة المرور الافتراضية عند إنشاء دار/فصل/مشرفة = آخر 6 أرقام من الجوال (قابلة للتغيير).

## مرجع النموذج
المجلد `dor_system/` يحتفظ بنموذج Apps Script الأصلي للمراجعة.
