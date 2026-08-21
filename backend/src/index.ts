import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { ZodError } from 'zod';
import { authRoutes } from './routes/auth.js';
import { masterRoutes } from './routes/master.js';
import { managerRoutes } from './routes/manager.js';
import { teacherRoutes } from './routes/teacher.js';

const port = Number(process.env.PORT || 4000);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

const frontendDist = path.resolve(
  process.env.FRONTEND_DIST || path.join(process.cwd(), '../frontend/dist'),
);

const app = Fastify({ logger: true });

// Must be registered before encapsulated route plugins so they inherit it.
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const err = error as Error & { validation?: unknown; issues?: Array<{ message?: string }> };
  if (error instanceof ZodError || err.name === 'ZodError' || Array.isArray(err.issues)) {
    const message = err.issues?.[0]?.message || 'بيانات غير صالحة';
    return reply.code(400).send({ status: 'error', message });
  }
  if (err.validation) {
    return reply.code(400).send({ status: 'error', message: 'بيانات غير صالحة' });
  }
  const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
  return reply.code(500).send({ status: 'error', message });
});

await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
});
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
await app.register(fastifyStatic, {
  root: uploadDir,
  prefix: '/uploads/',
  decorateReply: false,
});

app.get('/api/health', async () => ({ status: 'ok', app: 'ناظم الصغار' }));

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(masterRoutes, { prefix: '/api/master' });
await app.register(managerRoutes, { prefix: '/api/manager' });
await app.register(teacherRoutes, { prefix: '/api/teacher' });

if (fs.existsSync(frontendDist)) {
  await app.register(fastifyStatic, {
    root: frontendDist,
    prefix: '/',
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/uploads/')) {
      return reply.code(404).send({ status: 'error', message: 'غير موجود' });
    }
    return reply.sendFile('index.html');
  });
  app.log.info(`Serving frontend from ${frontendDist}`);
}

await app.listen({ port, host: '0.0.0.0' });
