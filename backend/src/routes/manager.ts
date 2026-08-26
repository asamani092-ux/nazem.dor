import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { computeExamStats, computeRates, isLevelAllowed, levelsForCurriculum } from '../lib/domain.js';
import { getRateWeights } from '../lib/settings.js';
import { CurriculumType, EntityStatus, Role } from '@prisma/client';
import { isValidSaudiMobile, normalizePhone, prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';

function statusLabel(s: EntityStatus) {
  if (s === EntityStatus.ACTIVE) return 'نشط';
  if (s === EntityStatus.SUSPENDED) return 'موقوف';
  return 'محذوف';
}

function curriculumLabel(c: CurriculumType | string) {
  if (c === CurriculumType.TIBYAN || c === 'TIBYAN') return 'منهج تبيان';
  if (c === CurriculumType.QARI || c === 'QARI') return 'منهج قارئ';
  if (c === CurriculumType.BOTH || c === 'BOTH') return 'كلاهما';
  return String(c);
}

export async function managerRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRoles(Role.MANAGER) };

  function darIdOf(request: { user: { darId: string | null } }) {
    return request.user.darId!;
  }

  app.get('/meta', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const dar = await prisma.dar.findUnique({ where: { id: darId } });
    if (!dar) return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    return {
      status: 'success',
      data: {
        darId: dar.id,
        darName: dar.name,
        curriculum: curriculumLabel(dar.curriculum),
        allowedLevels: levelsForCurriculum(dar.curriculum),
      },
    };
  });

  app.get('/report', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const dar = await prisma.dar.findUnique({ where: { id: darId } });
    if (!dar) return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });

    const classes = await prisma.class.findMany({
      where: { darId, status: { not: EntityStatus.DELETED } },
    });
    const students = await prisma.student.findMany({
      where: { darId, status: { not: EntityStatus.DELETED } },
      orderBy: { name: 'asc' },
    });
    const trackings = await prisma.dailyTracking.findMany({
      where: { darId, student: { status: { not: EntityStatus.DELETED } } },
      select: {
        studentId: true,
        classId: true,
        attendance: true,
        educational: true,
        homework: true,
      },
    });
    const examGrades = await prisma.examGrade.findMany({ where: { darId } });
    const weights = await getRateWeights();
    const rates = computeRates(trackings, weights);
    const examStats = computeExamStats(examGrades);
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

    const classBreakdown = classes.map((c) => {
      const rows = trackings.filter((t) => t.classId === c.id);
      const r = computeRates(rows, weights);
      const cExam = computeExamStats(examGrades.filter((g) => g.classId === c.id));
      return {
        id: c.id,
        name: c.name,
        level: c.level,
        teacherName: c.teacherName,
        studentCount: students.filter((s) => s.classId === c.id && s.status === EntityStatus.ACTIVE).length,
        ...r,
        examAvg: cExam.examAvg,
        examsGradedCount: cExam.examsGradedCount,
      };
    });

    const studentReports = students.map((s) => {
      const rows = trackings.filter((t) => t.studentId === s.id);
      const r = computeRates(rows, weights);
      const grades = examGrades.filter((g) => g.studentId === s.id);
      const sExam = computeExamStats(grades);
      return {
        id: s.id,
        name: s.name,
        className: classMap[s.classId]?.name || '-',
        level: classMap[s.classId]?.level || '-',
        status: statusLabel(s.status),
        parentPhone: s.parentPhone,
        ...r,
        examAvg: sExam.examAvg,
        examsCount: sExam.examsGradedCount,
      };
    });

    return {
      status: 'success',
      data: {
        generatedAt: new Date().toISOString(),
        dar: {
          name: dar.name,
          curriculum: curriculumLabel(dar.curriculum),
          allowedLevels: levelsForCurriculum(dar.curriculum),
        },
        summary: {
          totalStudents: students.length,
          activeStudents: students.filter((s) => s.status === EntityStatus.ACTIVE).length,
          classesCount: classes.filter((c) => c.status === EntityStatus.ACTIVE).length,
          ...rates,
          ...examStats,
        },
        weights,
        classBreakdown,
        students: studentReports,
        examGrades: examGrades.map((g) => ({
          examTitle: g.examTitle,
          studentName: g.studentName,
          className: classMap[g.classId]?.name || '-',
          score: g.score,
          gradedAt: g.gradedAt.toLocaleDateString('en-GB'),
        })),
      },
    };
  });

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

    const dar = await prisma.dar.findUnique({ where: { id: darId } });
    if (!dar) return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    if (!isLevelAllowed(dar.curriculum, body.level)) {
      return reply.code(400).send({
        status: 'error',
        message: `المستوى غير مسموح لمنهج هذه الدار. المسموح: ${levelsForCurriculum(dar.curriculum).join('، ')}`,
      });
    }

    if (await prisma.user.findUnique({ where: { phone } })) {
      return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم مسبقاً' });
    }

    // Internal passwordHash for account integrity; login is phone-only
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
          mustChangePassword: false,
        },
      });
      return created;
    });

    return {
      status: 'success',
      message: `تمت الإضافة. الدخول بجوال المعلمة: ${phone}`,
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

    const dar = await prisma.dar.findUnique({ where: { id: darId } });
    if (!dar) return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    if (!isLevelAllowed(dar.curriculum, body.level)) {
      return reply.code(400).send({
        status: 'error',
        message: `المستوى غير مسموح لمنهج هذه الدار. المسموح: ${levelsForCurriculum(dar.curriculum).join('، ')}`,
      });
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
    const weights = await getRateWeights();
    const studentCount = await prisma.student.count({
      where: { darId, classId: id, status: EntityStatus.ACTIVE },
    });
    const trackings = await prisma.dailyTracking.findMany({
      where: {
        darId,
        classId: id,
        student: { status: { not: EntityStatus.DELETED } },
      },
      select: { attendance: true, educational: true, homework: true },
    });
    const examGrades = await prisma.examGrade.findMany({
      where: { darId, classId: id },
      select: { score: true },
    });
    const rates = computeRates(trackings, weights);
    const examStats = computeExamStats(examGrades);
    return {
      status: 'success',
      data: {
        studentCount,
        ...rates,
        ...examStats,
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
          .max(100),
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
        kind: a.kind,
        scheduledAt: a.scheduledAt?.toISOString() || null,
        date: a.kind === 'VISIT' && a.scheduledAt
          ? a.scheduledAt.toLocaleDateString('en-GB')
          : a.createdAt.toLocaleDateString('en-GB'),
        title: a.title,
        content: a.content,
        isRead: readSet.has(a.id),
      })),
      ...exams.map((e) => ({
        id: e.id,
        type: 'exam' as const,
        kind: 'EXAM' as const,
        scheduledAt: e.examDate.toISOString(),
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

  app.get('/calendar', guard, async (request, reply) => {
    const darId = darIdOf(request);
    const q = z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .parse(request.query);

    let start: Date;
    let end: Date;
    try {
      const { parseDateRange } = await import('../lib/calendar.js');
      const range = parseDateRange(q.from, q.to);
      start = range.start;
      end = range.end;
    } catch {
      return reply.code(400).send({ status: 'error', message: 'نطاق تاريخ غير صالح' });
    }

    const [alerts, exams, dar] = await Promise.all([
      prisma.alert.findMany({
        where: {
          AND: [
            { OR: [{ darId: null }, { darId }] },
            {
              OR: [
                { kind: 'VISIT', scheduledAt: { gte: start, lte: end } },
                { kind: 'NOTICE', createdAt: { gte: start, lte: end } },
              ],
            },
          ],
        },
      }),
      prisma.exam.findMany({
        where: {
          examDate: { gte: start, lte: end },
          OR: [{ darId: null }, { darId }],
        },
        orderBy: { examDate: 'asc' },
      }),
      prisma.dar.findUnique({ where: { id: darId }, select: { name: true } }),
    ]);

    const reads = await prisma.alertRead.findMany({ where: { darId } });
    const readSet = new Set(reads.map((r) => r.alertId));
    const { alertToEvent, examToEvent } = await import('../lib/calendar.js');
    const darName = dar?.name;

    const events = [
      ...alerts
        .map((a) => alertToEvent(a, a.darId === darId ? darName : 'كل الدور', readSet.has(a.id)))
        .filter(Boolean),
      ...exams.map((e) => examToEvent(e, e.darId === darId ? darName : 'كل الدور', readSet.has(e.id))),
    ] as import('../lib/calendar.js').CalendarEventDto[];

    return { status: 'success', data: events };
  });
}
