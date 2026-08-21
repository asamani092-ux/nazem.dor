# ناظم الصغار — دور التحفيظ

منصة احترافية بديلة لنموذج Google Apps Script.

## المكدس
- Frontend: React + Vite + Tailwind (RTL)
- Backend: Fastify + Prisma + PostgreSQL
- نشر: Docker Compose على VPS + دومين العميل

## التجربة المحلية (بدون Docker)
```bash
./scripts/dev.sh
```
- الواجهة والـ API معاً: http://127.0.0.1:4000
- أو واجهة Vite للتطوير: http://127.0.0.1:5173 (Proxies إلى 4000)
- في Cursor: Ports → Forward **4000**
- الدخول بالجوال فقط (بدون كلمة مرور): `0555143246`
- الحسابات الجديدة تدخل بنفس رقم الجوال المسجّل؛ لا توجد بوابة تغيير كلمة مرور

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

الدخول برقم الجوال السعودي `05XXXXXXXX` فقط (حساب نشط). عند الإنشاء يُحفظ hash داخلي للحساب ولا يُعرض للمستخدم.

## مرجع النموذج
المجلد `dor_system/` يحتفظ بنموذج Apps Script الأصلي للمراجعة.
