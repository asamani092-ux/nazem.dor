import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';

/** طبقات أمنية عامة للمنصة */
export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet, {
    // الواجهة تُخدم من نفس الأصل؛ CSP مريحة للتطوير مع نفس المنفذ
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
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
