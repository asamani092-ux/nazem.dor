import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { EntityStatus } from '@prisma/client';
import { isValidSaudiMobile, normalizePhone, prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

async function enrichUser(user: {
  id: string;
  phone: string;
  name: string;
  role: string;
  darId: string | null;
  classId: string | null;
  mustChangePassword: boolean;
}) {
  let darName: string | undefined;
  let className: string | undefined;
  let classLevel: string | undefined;
  if (user.darId) {
    const dar = await prisma.dar.findUnique({ where: { id: user.darId } });
    darName = dar?.name;
  }
  if (user.classId) {
    const cls = await prisma.class.findUnique({ where: { id: user.classId } });
    className = cls?.name;
    classLevel = cls?.level;
  }
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    darId: user.darId,
    darName,
    classId: user.classId,
    className,
    classLevel,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const body = z
      .object({
        phone: z.string().min(9),
        password: z.string().min(4),
      })
      .parse(request.body);

    const phone = normalizePhone(body.phone);
    if (!isValidSaudiMobile(phone)) {
      return reply.code(400).send({ status: 'error', message: 'رقم الجوال غير صحيح (05XXXXXXXX)' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.status !== EntityStatus.ACTIVE) {
      return reply.code(401).send({ status: 'error', message: 'الجوال غير مسجل أو الحساب موقوف' });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ status: 'error', message: 'كلمة المرور غير صحيحة' });
    }

    if (user.role === 'MANAGER' || user.role === 'TEACHER') {
      if (!user.darId) {
        return reply.code(401).send({ status: 'error', message: 'الحساب غير مرتبط بدار' });
      }
      const dar = await prisma.dar.findUnique({ where: { id: user.darId } });
      if (!dar || dar.status === EntityStatus.DELETED || dar.status === EntityStatus.SUSPENDED) {
        return reply.code(401).send({ status: 'error', message: 'الدار موقوفة أو محذوفة' });
      }
    }

    if (user.role === 'TEACHER' && user.classId) {
      const cls = await prisma.class.findUnique({ where: { id: user.classId } });
      if (!cls || cls.status === EntityStatus.DELETED || cls.status === EntityStatus.SUSPENDED) {
        return reply.code(401).send({ status: 'error', message: 'الفصل موقوف أو محذوف' });
      }
    }

    const token = app.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      darId: user.darId,
      classId: user.classId,
    });

    return {
      status: 'success',
      token,
      role: user.role.toLowerCase(),
      user: await enrichUser(user),
    };
  });

  app.get('/me', { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.id } });
    if (!user) return { status: 'error', message: 'المستخدم غير موجود' };
    return { status: 'success', user: await enrichUser(user) };
  });

  app.post('/change-password', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({
        currentPassword: z.string().min(4),
        newPassword: z.string().min(6),
      })
      .parse(request.body);

    if (body.currentPassword === body.newPassword) {
      return reply.code(400).send({ status: 'error', message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' });
    }

    const user = await prisma.user.findUnique({ where: { id: request.user.id } });
    if (!user) return reply.code(404).send({ status: 'error', message: 'غير موجود' });

    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) return reply.code(400).send({ status: 'error', message: 'كلمة المرور الحالية غير صحيحة' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(body.newPassword, 10),
        mustChangePassword: false,
      },
    });

    return { status: 'success' };
  });
}
