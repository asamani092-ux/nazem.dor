import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { computeRates, levelsForCurriculum, normalizeHomework } from '../lib/domain.js';
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
    const visits = await prisma.alert.findMany({
      where: { kind: 'VISIT', darId: { in: dars.map((d) => d.id) }, scheduledAt: { not: null } },
      orderBy: { scheduledAt: 'desc' },
    });
    const lastVisitMap = new Map<string, string>();
    for (const v of visits) {
      if (v.darId && !lastVisitMap.has(v.darId) && v.scheduledAt) {
        lastVisitMap.set(v.darId, v.scheduledAt.toLocaleDateString('en-GB'));
      }
    }
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
        lastVisit: lastVisitMap.get(d.id) || '',
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

    // Internal passwordHash for account integrity; login is phone-only
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
          mustChangePassword: false,
        },
      });
      return created;
    });

    return {
      status: 'success',
      message: `تم إنشاء الدار. الدخول بجوال المديرة: ${phone}`,
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

  app.get('/indicators', guard, async () => {
    const dars = await prisma.dar.findMany({
      where: { status: { not: EntityStatus.DELETED } },
      select: { id: true, name: true, curriculum: true, status: true },
    });
    const activeDarIds = dars.filter((d) => d.status === EntityStatus.ACTIVE).map((d) => d.id);

    const [classesCount, studentsActive, studentsTotal, trackings, examsCount, teachersCount] =
      await Promise.all([
        prisma.class.count({
          where: { darId: { in: activeDarIds }, status: EntityStatus.ACTIVE },
        }),
        prisma.student.count({
          where: { darId: { in: activeDarIds }, status: EntityStatus.ACTIVE },
        }),
        prisma.student.count({
          where: { darId: { in: activeDarIds }, status: { not: EntityStatus.DELETED } },
        }),
        prisma.dailyTracking.findMany({
          where: {
            darId: { in: activeDarIds },
            student: { status: { not: EntityStatus.DELETED } },
          },
          select: { attendance: true, educational: true, homework: true, darId: true },
        }),
        prisma.exam.count(),
        prisma.user.count({
          where: {
            role: Role.TEACHER,
            status: EntityStatus.ACTIVE,
            darId: { in: activeDarIds },
          },
        }),
      ]);

    const rates = computeRates(trackings);
    const byCurriculum = {
      tibyan: dars.filter((d) => d.curriculum === CurriculumType.TIBYAN && d.status === EntityStatus.ACTIVE).length,
      qari: dars.filter((d) => d.curriculum === CurriculumType.QARI && d.status === EntityStatus.ACTIVE).length,
      both: dars.filter((d) => d.curriculum === CurriculumType.BOTH && d.status === EntityStatus.ACTIVE).length,
    };

    const perDar = [];
    for (const d of dars) {
      const rows = trackings.filter((t) => t.darId === d.id);
      const r = computeRates(rows);
      const activeStudents = await prisma.student.count({
        where: { darId: d.id, status: EntityStatus.ACTIVE },
      });
      const classCount = await prisma.class.count({
        where: { darId: d.id, status: EntityStatus.ACTIVE },
      });
      perDar.push({
        id: d.id,
        name: d.name,
        curriculum: curriculumLabel(d.curriculum),
        status: statusLabel(d.status),
        activeStudents,
        classesCount: classCount,
        ...r,
      });
    }

    return {
      status: 'success',
      data: {
        darsTotal: dars.length,
        darsActive: activeDarIds.length,
        classesCount,
        teachersCount,
        studentsActive,
        studentsTotal,
        examsCount,
        byCurriculum,
        ...rates,
        perDar,
      },
    };
  });

  app.get('/dars/:id/stats', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dar = await prisma.dar.findUnique({ where: { id } });
    if (!dar || dar.status === EntityStatus.DELETED) {
      return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    }

    const [classes, totalStudents, activeStudents, trackings] = await Promise.all([
      prisma.class.findMany({
        where: { darId: id, status: { not: EntityStatus.DELETED } },
        orderBy: { name: 'asc' },
      }),
      prisma.student.count({ where: { darId: id, status: { not: EntityStatus.DELETED } } }),
      prisma.student.count({ where: { darId: id, status: EntityStatus.ACTIVE } }),
      prisma.dailyTracking.findMany({
        where: {
          darId: id,
          student: { status: { not: EntityStatus.DELETED } },
        },
        select: {
          attendance: true,
          educational: true,
          homework: true,
          classId: true,
        },
      }),
    ]);

    const rates = computeRates(trackings);
    const classBreakdown = [];
    for (const c of classes) {
      const rows = trackings.filter((t) => t.classId === c.id);
      const r = computeRates(rows);
      const studentCount = await prisma.student.count({
        where: { classId: c.id, status: EntityStatus.ACTIVE },
      });
      classBreakdown.push({
        id: c.id,
        name: c.name,
        level: c.level,
        teacherName: c.teacherName,
        status: statusLabel(c.status),
        studentCount,
        ...r,
      });
    }

    return {
      status: 'success',
      data: {
        dar: {
          id: dar.id,
          name: dar.name,
          curriculum: curriculumLabel(dar.curriculum),
          managerName: dar.managerName,
          managerPhone: dar.managerPhone,
          status: statusLabel(dar.status),
          allowedLevels: levelsForCurriculum(dar.curriculum),
        },
        totalStudents,
        activeStudents,
        classesCount: classes.filter((c) => c.status === EntityStatus.ACTIVE).length,
        ...rates,
        classBreakdown,
      },
    };
  });

  app.get('/dars/:id/report', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dar = await prisma.dar.findUnique({ where: { id } });
    if (!dar || dar.status === EntityStatus.DELETED) {
      return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    }

    const classes = await prisma.class.findMany({
      where: { darId: id, status: { not: EntityStatus.DELETED } },
    });
    const students = await prisma.student.findMany({
      where: { darId: id, status: { not: EntityStatus.DELETED } },
      orderBy: { name: 'asc' },
    });
    const trackings = await prisma.dailyTracking.findMany({
      where: { darId: id, student: { status: { not: EntityStatus.DELETED } } },
      select: {
        studentId: true,
        classId: true,
        attendance: true,
        educational: true,
        homework: true,
        week: true,
        day: true,
        dateStr: true,
      },
    });
    const examGrades = await prisma.examGrade.findMany({
      where: { darId: id },
      orderBy: { gradedAt: 'desc' },
    });

    const rates = computeRates(trackings);
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

    const studentReports = students.map((s) => {
      const rows = trackings.filter((t) => t.studentId === s.id);
      const r = computeRates(rows);
      const grades = examGrades.filter((g) => g.studentId === s.id);
      let examSum = 0;
      let examN = 0;
      for (const g of grades) {
        const n = parseFloat(g.score);
        if (!Number.isNaN(n)) {
          examSum += n;
          examN++;
        }
      }
      return {
        id: s.id,
        name: s.name,
        className: classMap[s.classId]?.name || '-',
        level: classMap[s.classId]?.level || '-',
        status: statusLabel(s.status),
        parentPhone: s.parentPhone,
        ...r,
        examAvg: examN ? Math.round(examSum / examN) : 0,
        examsCount: examN,
      };
    });

    return {
      status: 'success',
      data: {
        generatedAt: new Date().toISOString(),
        dar: {
          id: dar.id,
          name: dar.name,
          curriculum: curriculumLabel(dar.curriculum),
          managerName: dar.managerName,
          managerPhone: dar.managerPhone,
          allowedLevels: levelsForCurriculum(dar.curriculum),
        },
        summary: {
          totalStudents: students.length,
          activeStudents: students.filter((s) => s.status === EntityStatus.ACTIVE).length,
          classesCount: classes.filter((c) => c.status === EntityStatus.ACTIVE).length,
          ...rates,
        },
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

    // Internal passwordHash for account integrity; login is phone-only
    const password = body.password || phone.slice(-6);
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        phone,
        role: Role.MASTER,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: false,
      },
    });

    return {
      status: 'success',
      message: `تم إنشاء المشرفة. الدخول بالجوال: ${phone}`,
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
    const { parseScheduledDate } = await import('../lib/calendar.js');
    const exam = await prisma.exam.create({
      data: {
        title: body.title.trim(),
        darId: isAll ? null : body.targetDarId,
        examDate: parseScheduledDate(body.date),
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
        content: z.string().optional(),
        kind: z.enum(['NOTICE', 'VISIT']).optional(),
        scheduledAt: z.string().optional(),
      })
      .parse(request.body);

    const isVisit = body.kind === 'VISIT';
    const content = (body.content || '').trim() || body.title.trim();
    if (isVisit && !body.scheduledAt) {
      return reply.code(400).send({ status: 'error', message: 'تاريخ الزيارة مطلوب' });
    }

    const isAll = body.darId === 'الكل';
    if (isVisit && isAll) {
      return reply.code(400).send({ status: 'error', message: 'الزيارة تتطلب تحديد دار' });
    }

    const { parseScheduledDate } = await import('../lib/calendar.js');
    await prisma.alert.create({
      data: {
        darId: isAll ? null : body.darId,
        title: body.title,
        content,
        kind: isVisit ? 'VISIT' : 'NOTICE',
        scheduledAt: isVisit && body.scheduledAt ? parseScheduledDate(body.scheduledAt) : null,
      },
    });
    return { status: 'success' };
  });

  app.get('/calendar', guard, async (request, reply) => {
    const q = z
      .object({
        from: z.string(),
        to: z.string(),
        darId: z.string().optional(),
      })
      .parse(request.query);

    let start: Date;
    let end: Date;
    try {
      const range = (await import('../lib/calendar.js')).parseDateRange(q.from, q.to);
      start = range.start;
      end = range.end;
    } catch {
      return reply.code(400).send({ status: 'error', message: 'نطاق تاريخ غير صالح' });
    }

    const darFilter = q.darId && q.darId !== 'الكل' ? q.darId : undefined;

    const [alerts, exams, dars] = await Promise.all([
      prisma.alert.findMany({
        where: {
          AND: [
            ...(darFilter
              ? [{ OR: [{ darId: darFilter }, { darId: null }] }]
              : []),
            {
              OR: [
                { kind: 'VISIT', scheduledAt: { gte: start, lte: end } },
                { kind: 'NOTICE', createdAt: { gte: start, lte: end } },
              ],
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.exam.findMany({
        where: {
          examDate: { gte: start, lte: end },
          ...(darFilter ? { OR: [{ darId: darFilter }, { darId: null }] } : {}),
        },
        orderBy: { examDate: 'asc' },
      }),
      prisma.dar.findMany({ select: { id: true, name: true } }),
    ]);

    const darMap = new Map(dars.map((d) => [d.id, d.name]));
    const { alertToEvent, examToEvent } = await import('../lib/calendar.js');

    const events = [
      ...alerts.map((a) => alertToEvent(a, a.darId ? darMap.get(a.darId) : 'كل الدور')).filter(Boolean),
      ...exams.map((e) => examToEvent(e, e.darId ? darMap.get(e.darId) : undefined)),
    ] as import('../lib/calendar.js').CalendarEventDto[];

    return { status: 'success', data: events };
  });

  app.get('/curriculum/levels', guard, async () => {
    const rows = await prisma.curriculumLevel.findMany({ orderBy: { sortOrder: 'asc' } });
    if (rows.length) {
      return { status: 'success', data: rows.map((r) => r.name) };
    }
    const distinct = await prisma.curriculumPlan.findMany({
      select: { level: true },
      distinct: ['level'],
      orderBy: { level: 'asc' },
    });
    return { status: 'success', data: distinct.map((d) => d.level) };
  });

  app.post('/curriculum/levels', guard, async (request) => {
    const body = z.object({ name: z.string().min(1) }).parse(request.body);
    const name = body.name.trim();
    const count = await prisma.curriculumLevel.count();
    await prisma.curriculumLevel.upsert({
      where: { name },
      create: { name, sortOrder: count + 1 },
      update: {},
    });
    return { status: 'success', data: { name } };
  });

  app.get('/curriculum', guard, async () => {
    const rows = await prisma.curriculumPlan.findMany({
      orderBy: [{ level: 'asc' }, { week: 'asc' }, { day: 'asc' }],
    });
    return {
      status: 'success',
      data: rows.map((r) => ({ ...r, homework: normalizeHomework(r.homework) })),
    };
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

    const homework = normalizeHomework(body.homework);
    const row = await prisma.curriculumPlan.upsert({
      where: {
        level_week_day: { level: body.level, week: body.week, day: body.day },
      },
      create: {
        level: body.level,
        week: body.week,
        day: body.day,
        educational: body.educational,
        homework,
        tarbawi: body.tarbawi || '',
      },
      update: {
        educational: body.educational,
        homework,
        tarbawi: body.tarbawi || '',
      },
    });
    return { status: 'success', data: { ...row, homework: normalizeHomework(row.homework) } };
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
