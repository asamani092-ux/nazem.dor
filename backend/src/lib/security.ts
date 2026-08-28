import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';

/** طبقات أمنية عامة للمنصة */
export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet, {
    // الواجهة تُخدم من نفس الأصل؛ CSP مريحة للتطوير مع نفس المنفذ
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // منع إجبار HTTPS عبر HSTS — Coolify sslip غالباً HTTP أو شهادة غير جاهزة
    // وإلا المتصفح يحوّل لـ https فيظهر failed to fetch (503)
    hsts: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      status: 'error',
      message: 'طلبات كثيرة — حاول لاحقاً',
    }),
  });
}
