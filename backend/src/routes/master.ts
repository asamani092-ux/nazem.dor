import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { CurriculumType, EntityStatus, Role } from '@prisma/client';
import { isValidSaudiMobile, normalizePhone, prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';

const curriculumMap: Record<string, CurriculumType> = {
  'منهج تبيان': CurriculumType.TIBYAN,
  'منهج قارئ': CurriculumType.QARI,
  كلاهما: CurriculumType.BOTH,
  TIBYAN: CurriculumType.TIBYAN,
  QARI: CurriculumType.QARI,
  BOTH: CurriculumType.BOTH,
};

function curriculumLabel(c: CurriculumType) {
  if (c === CurriculumType.TIBYAN) return 'منهج تبيان';
  if (c === CurriculumType.QARI) return 'منهج قارئ';
  return 'كلاهما';
}

function statusLabel(s: EntityStatus) {
  if (s === EntityStatus.ACTIVE) return 'نشط';
  if (s === EntityStatus.SUSPENDED) return 'معلق';
  return 'محذوف';
}

export async function masterRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRoles(Role.SUPER_MASTER, Role.MASTER) };
  const superGuard = { preHandler: requireRoles(Role.SUPER_MASTER) };

  app.get('/dars', guard, async () => {
    const dars = await prisma.dar.findMany({
      where: { status: { not: EntityStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      status: 'success',
      data: dars.map((d) => ({
        id: d.id,
        name: d.name,
        curriculum: curriculumLabel(d.curriculum),
        managerName: d.managerName,
        managerPhone: d.managerPhone,
        location: d.location || '',
        status: statusLabel(d.status),
      })),
    };
  });

  app.post('/dars', guard, async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(2),
        curriculum: z.string(),
        managerName: z.string().min(2),
        managerPhone: z.string(),
        location: z.string().optional(),
        password: z.string().min(6).optional(),
      })
      .parse(request.body);

    const phone = normalizePhone(body.managerPhone);
    if (!isValidSaudiMobile(phone)) {
      return reply.code(400).send({ status: 'error', message: 'جوال المديرة غير صحيح' });
    }

    const curriculum = curriculumMap[body.curriculum];
    if (!curriculum) return reply.code(400).send({ status: 'error', message: 'منهج غير معروف' });

    const exists = await prisma.dar.findFirst({
      where: { name: body.name.trim(), status: { not: EntityStatus.DELETED } },
    });
    if (exists) return reply.code(400).send({ status: 'error', message: 'اسم الدار مسجل مسبقاً' });

    const phoneTaken = await prisma.user.findUnique({ where: { phone } });
    if (phoneTaken) return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم مسبقاً' });

    const password = body.password || phone.slice(-6);
    const dar = await prisma.$transaction(async (tx) => {
      const created = await tx.dar.create({
        data: {
          name: body.name.trim(),
          curriculum,
          managerName: body.managerName.trim(),
          managerPhone: phone,
          location: body.location || null,
        },
      });
      await tx.user.create({
        data: {
          phone,
          name: body.managerName.trim(),
          role: Role.MANAGER,
          passwordHash: await bcrypt.hash(password, 10),
          darId: created.id,
          mustChangePassword: true,
        },
      });
      return created;
    });

    return {
      status: 'success',
      message: `تم إنشاء الدار. كلمة مرور المديرة الافتراضية: ${password}`,
      data: { id: dar.id },
    };
  });

  app.put('/dars/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(2),
        curriculum: z.string(),
        managerName: z.string().min(2),
        managerPhone: z.string(),
        location: z.string().optional(),
        status: z.enum(['نشط', 'معلق']),
      })
      .parse(request.body);

    const phone = normalizePhone(body.managerPhone);
    const curriculum = curriculumMap[body.curriculum];
    if (!curriculum) return reply.code(400).send({ status: 'error', message: 'منهج غير معروف' });

    const dar = await prisma.dar.findUnique({ where: { id } });
    if (!dar || dar.status === EntityStatus.DELETED) {
      return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    }

    const newStatus = body.status === 'معلق' ? EntityStatus.SUSPENDED : EntityStatus.ACTIVE;

    await prisma.$transaction(async (tx) => {
      await tx.dar.update({
        where: { id },
        data: {
          name: body.name.trim(),
          curriculum,
          managerName: body.managerName.trim(),
          managerPhone: phone,
          location: body.location || null,
          status: newStatus,
        },
      });

      const manager = await tx.user.findFirst({ where: { darId: id, role: Role.MANAGER } });
      if (manager) {
        if (manager.phone !== phone) {
          const taken = await tx.user.findUnique({ where: { phone } });
          if (taken && taken.id !== manager.id) throw new Error('PHONE_TAKEN');
        }
        await tx.user.update({
          where: { id: manager.id },
          data: {
            name: body.managerName.trim(),
            phone,
            status: newStatus === EntityStatus.SUSPENDED ? EntityStatus.SUSPENDED : EntityStatus.ACTIVE,
          },
        });
      }
    }).catch((e) => {
      if (e instanceof Error && e.message === 'PHONE_TAKEN') {
        return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم مسبقاً' });
      }
      throw e;
    });

    if (reply.sent) return;
    return { status: 'success' };
  });

  app.delete('/dars/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dar = await prisma.dar.findUnique({ where: { id } });
    if (!dar) return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });

    await prisma.$transaction([
      prisma.dar.update({ where: { id }, data: { status: EntityStatus.DELETED } }),
      prisma.user.updateMany({
        where: { darId: id },
        data: { status: EntityStatus.DELETED },
      }),
    ]);
    return { status: 'success' };
  });

  app.get('/dars/:id/stats', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dar = await prisma.dar.findUnique({ where: { id } });
    if (!dar || dar.status === EntityStatus.DELETED) {
      return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    }

    const [classesCount, totalStudents, activeStudents, trackings] = await Promise.all([
      prisma.class.count({ where: { darId: id, status: EntityStatus.ACTIVE } }),
      prisma.student.count({ where: { darId: id, status: { not: EntityStatus.DELETED } } }),
      prisma.student.count({ where: { darId: id, status: EntityStatus.ACTIVE } }),
      prisma.dailyTracking.findMany({
        where: {
          darId: id,
          student: { status: { not: EntityStatus.DELETED } },
        },
        select: { attendance: true, educational: true },
      }),
    ]);

    const totalRecords = trackings.length;
    const attendanceCount = trackings.filter((t) => t.attendance === 'حاضرة').length;
    const completionCount = trackings.filter((t) => t.educational === 'أتقنت').length;
    const attendanceRate = totalRecords ? Math.round((attendanceCount / totalRecords) * 100) : 0;
    const completionRate = totalRecords ? Math.round((completionCount / totalRecords) * 100) : 0;

    return {
      status: 'success',
      data: {
        totalStudents,
        activeStudents,
        classesCount,
        attendanceRate,
        completionRate,
        overallRate: Math.round((attendanceRate + completionRate) / 2),
      },
    };
  });

  app.get('/supervisors', superGuard, async () => {
    const list = await prisma.user.findMany({
      where: { role: Role.MASTER, status: { not: EntityStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      status: 'success',
      data: list.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        status: statusLabel(u.status),
      })),
    };
  });

  app.post('/supervisors', superGuard, async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(2),
        phone: z.string(),
        password: z.string().min(6).optional(),
      })
      .parse(request.body);

    const phone = normalizePhone(body.phone);
    if (!isValidSaudiMobile(phone)) {
      return reply.code(400).send({ status: 'error', message: 'جوال غير صحيح' });
    }
    if (await prisma.user.findUnique({ where: { phone } })) {
      return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });
    }

    const password = body.password || phone.slice(-6);
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        phone,
        role: Role.MASTER,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: true,
      },
    });

    return {
      status: 'success',
      message: `كلمة المرور الافتراضية: ${password}`,
      data: { id: user.id },
    };
  });

  app.put('/supervisors/:id', superGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(2),
        phone: z.string(),
        status: z.enum(['نشط', 'معلق', 'محذوف']),
      })
      .parse(request.body);

    const phone = normalizePhone(body.phone);
    const status =
      body.status === 'محذوف'
        ? EntityStatus.DELETED
        : body.status === 'معلق'
          ? EntityStatus.SUSPENDED
          : EntityStatus.ACTIVE;

    const taken = await prisma.user.findFirst({ where: { phone, NOT: { id } } });
    if (taken) return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });

    await prisma.user.update({
      where: { id },
      data: { name: body.name.trim(), phone, status },
    });
    return { status: 'success' };
  });

  app.post('/exams', guard, async (request, reply) => {
    const body = z
      .object({
        targetDarId: z.string(),
        date: z.string().min(1),
        link: z.string().url(),
        title: z.string().min(2, 'عنوان الاختبار مطلوب'),
      })
      .parse(request.body);

    const isAll = body.targetDarId === 'الكل';
    const exam = await prisma.exam.create({
      data: {
        title: body.title.trim(),
        darId: isAll ? null : body.targetDarId,
        examDate: new Date(body.date),
        link: body.link,
      },
    });
    return { status: 'success', data: { id: exam.id } };
  });

  app.post('/alerts', guard, async (request, reply) => {
    const body = z
      .object({
        darId: z.string(),
        title: z.string().min(2),
        content: z.string().min(2),
        kind: z.enum(['NOTICE', 'VISIT']).optional(),
      })
      .parse(request.body);

    const isAll = body.darId === 'الكل';
    await prisma.alert.create({
      data: {
        darId: isAll ? null : body.darId,
        title: body.title,
        content: body.content,
        kind: body.kind === 'VISIT' ? 'VISIT' : 'NOTICE',
      },
    });
    return { status: 'success' };
  });

  app.get('/curriculum', guard, async () => {
    const rows = await prisma.curriculumPlan.findMany({
      orderBy: [{ level: 'asc' }, { week: 'asc' }, { day: 'asc' }],
    });
    return { status: 'success', data: rows };
  });

  app.post('/curriculum', guard, async (request) => {
    const body = z
      .object({
        level: z.string().min(1),
        week: z.number().int().positive(),
        day: z.string().min(1),
        educational: z.string().min(1),
        homework: z.string(),
        tarbawi: z.string().optional(),
      })
      .parse(request.body);

    const row = await prisma.curriculumPlan.upsert({
      where: {
        level_week_day: { level: body.level, week: body.week, day: body.day },
      },
      create: {
        level: body.level,
        week: body.week,
        day: body.day,
        educational: body.educational,
        homework: body.homework,
        tarbawi: body.tarbawi || '',
      },
      update: {
        educational: body.educational,
        homework: body.homework,
        tarbawi: body.tarbawi || '',
      },
    });
    return { status: 'success', data: row };
  });

  app.delete('/curriculum/:id', { preHandler: requireRoles(Role.SUPER_MASTER) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.curriculumPlan.delete({ where: { id } });
      return { status: 'success' };
    } catch {
      return reply.code(404).send({ status: 'error', message: 'غير موجود' });
    }
  });
}
