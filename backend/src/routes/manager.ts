import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { EntityStatus, Role } from '@prisma/client';
import { isValidSaudiMobile, normalizePhone, prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';

function statusLabel(s: EntityStatus) {
  if (s === EntityStatus.ACTIVE) return 'نشط';
  if (s === EntityStatus.SUSPENDED) return 'موقوف';
  return 'محذوف';
}

export async function managerRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRoles(Role.MANAGER) };

  function darIdOf(request: { user: { darId: string | null } }) {
    return request.user.darId!;
  }

  app.get('/classes', guard, async (request) => {
    const darId = darIdOf(request);
    const classes = await prisma.class.findMany({
      where: { darId, status: { not: EntityStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
    });

    const activeCounts = await prisma.student.groupBy({
      by: ['classId'],
      where: { darId, status: EntityStatus.ACTIVE },
      _count: { _all: true },
    });
    const countMap = Object.fromEntries(activeCounts.map((c) => [c.classId, c._count._all]));

    return {
      status: 'success',
      data: classes.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        teacherName: c.teacherName,
        teacherPhone: c.teacherPhone,
        status: statusLabel(c.status),
        studentCount: countMap[c.id] || 0,
      })),
    };
  });

  app.post('/classes', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const body = z
      .object({
        name: z.string().min(1),
        level: z.string().min(1),
        teacherName: z.string().min(1),
        teacherPhone: z.string(),
        password: z.string().min(6).optional(),
      })
      .parse(request.body);

    const phone = normalizePhone(body.teacherPhone);
    if (!isValidSaudiMobile(phone)) {
      return reply.code(400).send({ status: 'error', message: 'جوال المعلمة غير صحيح' });
    }
    if (await prisma.user.findUnique({ where: { phone } })) {
      return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم مسبقاً' });
    }

    const password = body.password || phone.slice(-6);
    const cls = await prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          darId,
          name: body.name.trim(),
          level: body.level,
          teacherName: body.teacherName.trim(),
          teacherPhone: phone,
        },
      });
      await tx.user.create({
        data: {
          phone,
          name: body.teacherName.trim(),
          role: Role.TEACHER,
          passwordHash: await bcrypt.hash(password, 10),
          darId,
          classId: created.id,
          mustChangePassword: true,
        },
      });
      return created;
    });

    return {
      status: 'success',
      message: `تمت الإضافة. كلمة مرور المعلمة: ${password}`,
      data: { id: cls.id },
    };
  });

  app.put('/classes/:id', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1),
        level: z.string().min(1),
        teacherName: z.string().min(1),
        teacherPhone: z.string(),
      })
      .parse(request.body);

    const phone = normalizePhone(body.teacherPhone);
    const cls = await prisma.class.findFirst({ where: { id, darId } });
    if (!cls || cls.status === EntityStatus.DELETED) {
      return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.class.update({
        where: { id },
        data: {
          name: body.name.trim(),
          level: body.level,
          teacherName: body.teacherName.trim(),
          teacherPhone: phone,
        },
      });
      const teacher = await tx.user.findFirst({ where: { classId: id, role: Role.TEACHER } });
      if (teacher) {
        if (teacher.phone !== phone) {
          const taken = await tx.user.findUnique({ where: { phone } });
          if (taken && taken.id !== teacher.id) throw new Error('PHONE_TAKEN');
        }
        await tx.user.update({
          where: { id: teacher.id },
          data: { name: body.teacherName.trim(), phone },
        });
      }
    }).catch((e) => {
      if (e instanceof Error && e.message === 'PHONE_TAKEN') {
        return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });
      }
      throw e;
    });

    if (reply.sent) return;
    return { status: 'success' };
  });

  app.post('/classes/:id/suspend', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const cls = await prisma.class.findFirst({ where: { id, darId } });
    if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });
    await prisma.$transaction([
      prisma.class.update({ where: { id }, data: { status: EntityStatus.SUSPENDED } }),
      prisma.user.updateMany({
        where: { classId: id },
        data: { status: EntityStatus.SUSPENDED },
      }),
    ]);
    return { status: 'success' };
  });

  app.post('/classes/:id/activate', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const cls = await prisma.class.findFirst({ where: { id, darId } });
    if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });
    await prisma.$transaction([
      prisma.class.update({ where: { id }, data: { status: EntityStatus.ACTIVE } }),
      prisma.user.updateMany({
        where: { classId: id },
        data: { status: EntityStatus.ACTIVE },
      }),
    ]);
    return { status: 'success' };
  });

  app.delete('/classes/:id', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const cls = await prisma.class.findFirst({ where: { id, darId } });
    if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });
    await prisma.$transaction([
      prisma.class.update({ where: { id }, data: { status: EntityStatus.DELETED } }),
      prisma.user.updateMany({
        where: { classId: id },
        data: { status: EntityStatus.DELETED },
      }),
      prisma.student.updateMany({
        where: { classId: id },
        data: { status: EntityStatus.DELETED },
      }),
    ]);
    return { status: 'success' };
  });

  app.get('/classes/:id/stats', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const studentCount = await prisma.student.count({
      where: { darId, classId: id, status: EntityStatus.ACTIVE },
    });
    const trackings = await prisma.dailyTracking.findMany({
      where: {
        darId,
        classId: id,
        student: { status: { not: EntityStatus.DELETED } },
      },
      select: { attendance: true, educational: true },
    });
    const total = trackings.length;
    const att = trackings.filter((t) => t.attendance === 'حاضرة').length;
    const comp = trackings.filter((t) => t.educational === 'أتقنت').length;
    return {
      status: 'success',
      data: {
        studentCount,
        attendanceRate: total ? Math.round((att / total) * 100) : 0,
        completionRate: total ? Math.round((comp / total) * 100) : 0,
      },
    };
  });

  app.post('/students', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const body = z
      .object({
        classId: z.string(),
        students: z
          .array(z.object({ name: z.string().min(1), phone: z.string() }))
          .min(1)
          .max(10),
      })
      .parse(request.body);

    const cls = await prisma.class.findFirst({
      where: { id: body.classId, darId, status: EntityStatus.ACTIVE },
    });
    if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });

    const data = body.students.map((s) => ({
      darId,
      classId: body.classId,
      name: s.name.trim(),
      parentPhone: normalizePhone(s.phone),
    }));

    await prisma.student.createMany({ data });
    return { status: 'success', message: `تم تسجيل ${data.length} طالبة` };
  });

  app.get('/students', guard, async (request) => {
    const darId = darIdOf(request);
    const q = request.query as { classId?: string };
    if (!q.classId) return { status: 'success', data: [] };

    const students = await prisma.student.findMany({
      where: { darId, classId: q.classId, status: { not: EntityStatus.DELETED } },
      orderBy: { name: 'asc' },
    });

    return {
      status: 'success',
      data: students.map((s) => ({
        id: s.id,
        name: s.name,
        classId: s.classId,
        phone: s.parentPhone,
        status: statusLabel(s.status),
      })),
    };
  });

  app.put('/students/:id', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const body = z
      .object({
        classId: z.string(),
        name: z.string().min(1),
        phone: z.string(),
      })
      .parse(request.body);

    const stu = await prisma.student.findFirst({ where: { id, darId } });
    if (!stu) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });

    await prisma.student.update({
      where: { id },
      data: {
        classId: body.classId,
        name: body.name.trim(),
        parentPhone: normalizePhone(body.phone),
      },
    });
    return { status: 'success' };
  });

  app.post('/students/:id/status', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const body = z.object({ status: z.enum(['نشط', 'موقوف']) }).parse(request.body);
    const stu = await prisma.student.findFirst({ where: { id, darId } });
    if (!stu) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });
    await prisma.student.update({
      where: { id },
      data: { status: body.status === 'موقوف' ? EntityStatus.SUSPENDED : EntityStatus.ACTIVE },
    });
    return { status: 'success' };
  });

  app.delete('/students/:id', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    const stu = await prisma.student.findFirst({ where: { id, darId } });
    if (!stu) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });
    await prisma.student.update({ where: { id }, data: { status: EntityStatus.DELETED } });
    return { status: 'success' };
  });

  app.get('/alerts', guard, async (request) => {
    const darId = darIdOf(request);
    const [alerts, exams, reads] = await Promise.all([
      prisma.alert.findMany({
        where: { OR: [{ darId: null }, { darId }] },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.exam.findMany({
        where: { OR: [{ darId: null }, { darId }] },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.alertRead.findMany({ where: { darId } }),
    ]);
    const readSet = new Set(reads.map((r) => r.alertId));

    const data = [
      ...alerts.map((a) => ({
        id: a.id,
        type: 'msg' as const,
        date: a.createdAt.toLocaleDateString('en-GB'),
        title: a.title,
        content: a.content,
        isRead: readSet.has(a.id),
      })),
      ...exams.map((e) => ({
        id: e.id,
        type: 'exam' as const,
        date: e.examDate.toLocaleDateString('en-GB'),
        title: e.title,
        link: e.link,
        content: '',
        isRead: readSet.has(e.id),
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    return { status: 'success', data };
  });

  app.post('/alerts/:id/read', guard, async (request) => {
    const darId = darIdOf(request);
    const { id } = request.params as { id: string };
    await prisma.alertRead.upsert({
      where: { darId_alertId: { darId, alertId: id } },
      create: { darId, alertId: id },
      update: {},
    });
    return { status: 'success' };
  });

  app.post('/alerts/forward', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const body = z
      .object({
        title: z.string().min(1),
        content: z.string().min(1),
        targetClassId: z.string(),
      })
      .parse(request.body);

    const classId = body.targetClassId === 'الكل' ? null : body.targetClassId;
    if (classId) {
      const cls = await prisma.class.findFirst({ where: { id: classId, darId } });
      if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });
    }

    await prisma.teacherNotification.create({
      data: { darId, classId, title: body.title, content: body.content },
    });
    return { status: 'success' };
  });
}
