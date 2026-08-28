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

## النشر على Coolify
1. Resource → Docker Compose → الملف `/docker-compose.prod.yml` والفرع `main`
2. Environment: `POSTGRES_*` و `JWT_SECRET` و `SEED_*` و `PUBLIC_URL`
3. Domains على خدمة **web** فقط (Generate Domain أو subdomain خاص)
4. ضع `PUBLIC_URL` = رابط الـ Domain ثم **Deploy**
5. لا تربط `ports: 80` — Coolify يستخدم `expose: 80` عبر Traefik

### حفظ المرفقات وقاعدة البيانات بعد Redeploy
- المرفقات على volume ثابت الاسم: `nazem_uploads`
- PostgreSQL على volume ثابت: `nazem_pgdata`
- **Redeploy / Rebuild لا يحذفها**
- تحذف فقط إذا: حذفت الـ Resource مع خيار حذف Volumes، أو نفّذت `docker volume rm nazem_uploads`

للربط المباشر على قرص السيرفر (اختياري أقوى)، في Coolify → Storages أو عدّل الـ volume إلى مسار مثل `/data/nazem/uploads`.

## النشر على VPS (بدون Coolify)
```bash
cp .env.example .env
# عدّل كلمات المرور و JWT_SECRET و PUBLIC_URL
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
# إن احتجت فتح 80 مباشرة: أضف ports: ["80:80"] لخدمة web
```
أو reverse-proxy خارجي عبر `nginx/nazem.conf.example` + certbot.

## الأدوار
| الدور | الوصف |
|------|------|
| SUPER_MASTER | مدير النظام — أعلى صلاحية |
| GENERAL_DIRECTOR | المدير العام — كل صلاحيات مدير النظام عدا المساس بحسابه |
| MASTER | مشرفة عامة |
| MANAGER | مديرة دار |
| TEACHER | معلمة فصل |

الدخول برقم الجوال السعودي `05XXXXXXXX` فقط (حساب نشط). عند الإنشاء يُحفظ hash داخلي للحساب ولا يُعرض للمستخدم.

## مرجع النموذج
المجلد `dor_system/` يحتفظ بنموذج Apps Script الأصلي للمراجعة.
