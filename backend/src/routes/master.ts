import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { computeExamStats, computeRates, levelsForCurriculum, normalizeHomework } from '../lib/domain.js';
import { getRateWeights, setRateWeights } from '../lib/settings.js';
import { CurriculumType, EntityStatus, Role } from '@prisma/client';
import { isValidSaudiMobile, normalizePhone, prisma } from '../lib/prisma.js';
import { ADMIN_ROLES, isAdminRole, requireRoles } from '../middleware/auth.js';
import { buildDarTrackingSummaries, periodSince } from '../lib/tracking-status.js';
import { closeActiveTerm, ensureActiveTerm, getActiveTerm, listTerms, resolveTermId } from '../lib/terms.js';

const curriculumMap: Record<string, CurriculumType> = {
  'منهج تبيان': CurriculumType.TIBYAN,
  'منهج قارئ': CurriculumType.QARI,
  'تبيان/قارئ': CurriculumType.BOTH,
  كلاهما: CurriculumType.BOTH,
  TIBYAN: CurriculumType.TIBYAN,
  QARI: CurriculumType.QARI,
  BOTH: CurriculumType.BOTH,
};

function curriculumLabel(c: CurriculumType) {
  if (c === CurriculumType.TIBYAN) return 'منهج تبيان';
  if (c === CurriculumType.QARI) return 'منهج قارئ';
  return 'تبيان/قارئ';
}

function statusLabel(s: EntityStatus) {
  if (s === EntityStatus.ACTIVE) return 'نشط';
  if (s === EntityStatus.SUSPENDED) return 'معلق';
  return 'محذوف';
}

export async function masterRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRoles(...ADMIN_ROLES, Role.MASTER) };
  const superGuard = { preHandler: requireRoles(...ADMIN_ROLES) };

  /** حصر رؤية الدور: المشرفة ترى دُورها المسندة فقط؛ المديرون يرون الكل. O(1). */
  function darScopeWhere(request: { user: { role: Role; id: string } }) {
    return request.user.role === Role.MASTER ? { supervisorId: request.user.id } : {};
  }

  /** هل يملك المستخدم صلاحية على دار معيّنة؟ */
  async function canAccessDar(request: { user: { role: Role; id: string } }, darId: string) {
    if (isAdminRole(request.user.role)) return true;
    const dar = await prisma.dar.findUnique({ where: { id: darId }, select: { supervisorId: true } });
    return !!dar && dar.supervisorId === request.user.id;
  }

  app.get('/dars', guard, async (request) => {
    const dars = await prisma.dar.findMany({
      where: { status: { not: EntityStatus.DELETED }, ...darScopeWhere(request) },
      orderBy: { createdAt: 'desc' },
      include: { supervisor: { select: { id: true, name: true } } },
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
    const activeTerm = await ensureActiveTerm();
    const trackingMap = await buildDarTrackingSummaries(
      dars.map((d) => d.id),
      7,
      activeTerm.id,
    );
    return {
      status: 'success',
      data: dars.map((d) => {
        const tr = trackingMap.get(d.id);
        return {
          id: d.id,
          name: d.name,
          curriculum: curriculumLabel(d.curriculum),
          managerName: d.managerName,
          managerPhone: d.managerPhone,
          location: d.location || '',
          status: statusLabel(d.status),
          lastVisit: lastVisitMap.get(d.id) || '',
          supervisorId: d.supervisorId || '',
          supervisorName: d.supervisor?.name || '',
          classesCount: tr?.classesCount ?? 0,
          trackedClassesCount: tr?.trackedClassesCount ?? 0,
          lastActivityAt: tr?.lastActivityAt ?? null,
          lastActivityLabel: tr?.lastActivityLabel ?? 'لا يوجد',
          trackingBadge: tr?.trackingBadge ?? 'empty',
        };
      }),
    };
  });

  app.post('/dars/:id/supervisor', superGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ supervisorId: z.string().nullable() }).parse(request.body);
    const dar = await prisma.dar.findUnique({ where: { id } });
    if (!dar || dar.status === EntityStatus.DELETED) {
      return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });
    }
    if (body.supervisorId) {
      const sup = await prisma.user.findFirst({
        where: { id: body.supervisorId, role: Role.MASTER, status: EntityStatus.ACTIVE },
      });
      if (!sup) return reply.code(400).send({ status: 'error', message: 'المشرفة غير موجودة' });
    }
    await prisma.dar.update({ where: { id }, data: { supervisorId: body.supervisorId } });
    return { status: 'success' };
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

  app.get('/indicators', guard, async (request) => {
    const q = z
      .object({
        period: z.enum(['7d', '30d', 'all']).default('all'),
        termId: z.string().optional(),
      })
      .parse(request.query);
    const weights = await getRateWeights();
    const resolvedTermId = await resolveTermId(q.termId);
    const dars = await prisma.dar.findMany({
      where: { status: { not: EntityStatus.DELETED }, ...darScopeWhere(request) },
      select: { id: true, name: true, curriculum: true, status: true },
    });
    const activeDarIds = dars.filter((d) => d.status === EntityStatus.ACTIVE).map((d) => d.id);
    const since = periodSince(q.period);
    const trackingWhere = {
      termId: resolvedTermId,
      darId: { in: activeDarIds },
      student: { status: { not: EntityStatus.DELETED } },
      ...(since ? { updatedAt: { gte: since } } : {}),
    };
    const gradeWhere = {
      termId: resolvedTermId,
      darId: { in: activeDarIds },
      ...(since ? { gradedAt: { gte: since } } : {}),
    };

    const [classesCount, studentsActive, studentsTotal, trackings, examsCount, teachersCount, examGrades] =
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
          where: trackingWhere,
          select: { attendance: true, educational: true, homework: true, darId: true },
        }),
        prisma.exam.count({
          where: {
            termId: resolvedTermId,
            OR: [{ darId: null }, { darId: { in: activeDarIds } }],
            ...(since ? { examDate: { gte: since } } : {}),
          },
        }),
        prisma.user.count({
          where: {
            role: Role.TEACHER,
            status: EntityStatus.ACTIVE,
            darId: { in: activeDarIds },
          },
        }),
        prisma.examGrade.findMany({
          where: gradeWhere,
          select: { score: true, darId: true },
        }),
      ]);

    const rates = computeRates(trackings, weights);
    const examStats = computeExamStats(examGrades, examsCount);
    const byCurriculum = {
      tibyan: dars.filter((d) => d.curriculum === CurriculumType.TIBYAN && d.status === EntityStatus.ACTIVE).length,
      qari: dars.filter((d) => d.curriculum === CurriculumType.QARI && d.status === EntityStatus.ACTIVE).length,
      both: dars.filter((d) => d.curriculum === CurriculumType.BOTH && d.status === EntityStatus.ACTIVE).length,
    };

    const perDar = [];
    for (const d of dars) {
      const rows = trackings.filter((t) => t.darId === d.id);
      const r = computeRates(rows, weights);
      const darExam = computeExamStats(examGrades.filter((g) => g.darId === d.id));
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
        examAvg: darExam.examAvg,
        examsGradedCount: darExam.examsGradedCount,
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
        byCurriculum,
        weights,
        ...rates,
        examAvg: examStats.examAvg,
        examsGradedCount: examStats.examsGradedCount,
        examsCount,
        period: q.period,
        termId: resolvedTermId,
        perDar,
      },
    };
  });

  app.get('/settings/weights', guard, async () => {
    const data = await getRateWeights();
    return { status: 'success', data };
  });

  app.post('/settings/weights', superGuard, async (request, reply) => {
    const body = z
      .object({
        attendance: z.number().int().min(0).max(100),
        completion: z.number().int().min(0).max(100),
        homework: z.number().int().min(0).max(100),
      })
      .parse(request.body);
    if (body.attendance + body.completion + body.homework !== 100) {
      return reply.code(400).send({ status: 'error', message: 'مجموع الأوزان يجب أن يساوي 100' });
    }
    try {
      const data = await setRateWeights(body);
      return { status: 'success', data };
    } catch (e) {
      return reply.code(400).send({ status: 'error', message: e instanceof Error ? e.message : 'فشل الحفظ' });
    }
  });

  app.get('/attachments', guard, async (request) => {
    const q = z.object({ week: z.coerce.number().int().positive().optional() }).parse(request.query);
    const week = q.week;

    const dars = await prisma.dar.findMany({
      where: { status: EntityStatus.ACTIVE, ...darScopeWhere(request) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, curriculum: true },
    });
    const darIds = dars.map((d) => d.id);
    const classes = await prisma.class.findMany({
      where: { status: EntityStatus.ACTIVE, darId: { in: darIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, level: true, darId: true },
    });
    const term = await ensureActiveTerm();
    const attachments = await prisma.weekAttachment.findMany({
      where: { darId: { in: darIds }, termId: term.id, ...(week ? { week } : {}) },
      orderBy: [{ week: 'asc' }],
    });

    const attByClassWeek = new Map<string, { url: string; fileName: string; week: number; uploadedAt: string }>();
    const weeksSet = new Set<number>();
    for (const a of attachments) {
      weeksSet.add(a.week);
      attByClassWeek.set(`${a.classId}:${a.week}`, {
        url: a.url,
        fileName: a.fileName || '',
        week: a.week,
        uploadedAt: a.updatedAt.toLocaleDateString('en-GB'),
      });
    }

    const classesByDar = new Map<string, typeof classes>();
    for (const c of classes) {
      if (!classesByDar.has(c.darId)) classesByDar.set(c.darId, []);
      classesByDar.get(c.darId)!.push(c);
    }

    const perDar = dars.map((d) => {
      const darClasses = classesByDar.get(d.id) || [];
      const classItems = darClasses.map((c) => {
        const found = week ? attByClassWeek.get(`${c.id}:${week}`) : undefined;
        return {
          classId: c.id,
          className: c.name,
          level: c.level,
          uploaded: !!found,
          url: found?.url || '',
          fileName: found?.fileName || '',
          uploadedAt: found?.uploadedAt || '',
        };
      });
      const uploadedCount = classItems.filter((c) => c.uploaded).length;
      return {
        darId: d.id,
        name: d.name,
        curriculum: curriculumLabel(d.curriculum),
        classesCount: darClasses.length,
        uploadedCount,
        allUploaded: darClasses.length > 0 && uploadedCount === darClasses.length,
        classes: classItems,
      };
    });

    return {
      status: 'success',
      data: {
        week: week || null,
        availableWeeks: [...weeksSet].sort((a, b) => a - b),
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
    if (!(await canAccessDar(request, id))) {
      return reply.code(403).send({ status: 'error', message: 'هذه الدار غير مسندة لك' });
    }

    const weights = await getRateWeights();
    const [classes, totalStudents, activeStudents, trackings, examGrades, examsForDar] = await Promise.all([
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
      prisma.examGrade.findMany({ where: { darId: id }, select: { score: true, classId: true } }),
      prisma.exam.count({ where: { OR: [{ darId: id }, { darId: null }] } }),
    ]);

    const rates = computeRates(trackings, weights);
    const examStats = computeExamStats(examGrades, examsForDar);
    const classBreakdown = [];
    for (const c of classes) {
      const rows = trackings.filter((t) => t.classId === c.id);
      const r = computeRates(rows, weights);
      const cExam = computeExamStats(examGrades.filter((g) => g.classId === c.id));
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
        examAvg: cExam.examAvg,
        examsGradedCount: cExam.examsGradedCount,
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
        ...examStats,
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
    if (!(await canAccessDar(request, id))) {
      return reply.code(403).send({ status: 'error', message: 'هذه الدار غير مسندة لك' });
    }

    const weights = await getRateWeights();
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

    const rates = computeRates(trackings, weights);
    const examStats = computeExamStats(examGrades);
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

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
          ...examStats,
        },
        weights,
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

  app.get('/exams', guard, async (request) => {
    let examWhere = {};
    if (request.user.role === Role.MASTER) {
      const own = await prisma.dar.findMany({ where: darScopeWhere(request), select: { id: true } });
      examWhere = { OR: [{ darId: null }, { darId: { in: own.map((d) => d.id) } }] };
    }
    const exams = await prisma.exam.findMany({
      where: examWhere,
      orderBy: { examDate: 'desc' },
      include: { _count: { select: { grades: true } }, dar: { select: { name: true } } },
    });
    return {
      status: 'success',
      data: exams.map((e) => ({
        id: e.id,
        title: e.title,
        examDate: e.examDate.toISOString(),
        link: e.link,
        maxScore: e.maxScore,
        darId: e.darId,
        darName: e.dar?.name || 'كل الدور',
        gradesCount: e._count.grades,
      })),
    };
  });

  app.post('/exams', guard, async (request, reply) => {
    const body = z
      .object({
        targetDarId: z.string(),
        date: z.string().min(1),
        link: z.string().url(),
        title: z.string().min(2, 'عنوان الاختبار مطلوب'),
        maxScore: z.number().int().positive('سقف الدرجة يجب أن يكون رقماً موجباً').max(1000),
      })
      .parse(request.body);

    const term = await ensureActiveTerm();
    const isAll = body.targetDarId === 'الكل';
    const { parseScheduledDate } = await import('../lib/calendar.js');
    const exam = await prisma.exam.create({
      data: {
        title: body.title.trim(),
        darId: isAll ? null : body.targetDarId,
        termId: term.id,
        examDate: parseScheduledDate(body.date),
        link: body.link,
        maxScore: body.maxScore,
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

    let scopedDarIds: string[] | null = null;
    if (request.user.role === Role.MASTER) {
      const own = await prisma.dar.findMany({ where: darScopeWhere(request), select: { id: true } });
      scopedDarIds = own.map((d) => d.id);
    }
    const darInScope = (arr: string[] | null) =>
      arr ? [{ OR: [{ darId: { in: arr } }, { darId: null }] }] : [];

    const [alerts, exams, dars] = await Promise.all([
      prisma.alert.findMany({
        where: {
          AND: [
            ...(darFilter
              ? [{ OR: [{ darId: darFilter }, { darId: null }] }]
              : darInScope(scopedDarIds)),
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
          AND: [
            { examDate: { gte: start, lte: end } },
            ...(darFilter
              ? [{ OR: [{ darId: darFilter }, { darId: null }] }]
              : darInScope(scopedDarIds)),
          ],
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

  app.get('/terms', superGuard, async () => {
    const terms = await listTerms();
    return {
      status: 'success',
      data: terms.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        startsAt: t.startsAt.toISOString(),
        endsAt: t.endsAt?.toISOString() || null,
        archivedAt: t.archivedAt?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

  app.post('/terms/close', superGuard, async (request, reply) => {
    const body = z
      .object({
        confirm: z.boolean(),
        newTermName: z.string().optional(),
      })
      .parse(request.body);

    if (!body.confirm) {
      return reply.code(400).send({ status: 'error', message: 'يجب تأكيد إغلاق الفصل الدراسي' });
    }

    const weights = await getRateWeights();
    const activeBefore = await getActiveTerm();
    if (!activeBefore) {
      return reply.code(400).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط لإغلاقه' });
    }
    const archivedTermId = activeBefore.id;

    const { archived, created } = await closeActiveTerm({ newName: body.newTermName });

    const dars = await prisma.dar.findMany({
      where: { status: { not: EntityStatus.DELETED } },
      orderBy: { createdAt: 'asc' },
      include: {
        classes: { where: { status: EntityStatus.ACTIVE }, orderBy: { name: 'asc' } },
      },
    });

    const allTrackings = await prisma.dailyTracking.findMany({
      where: { termId: archivedTermId },
      select: { darId: true, classId: true, attendance: true, educational: true, homework: true },
    });

    const studentCounts = await prisma.student.groupBy({
      by: ['darId', 'classId'],
      where: { status: EntityStatus.ACTIVE },
      _count: { _all: true },
    });
    const studentCountMap = new Map(studentCounts.map((s) => [`${s.darId}:${s.classId}`, s._count._all]));

    const overallRates = computeRates(allTrackings, weights);
    const generalRows: (string | number)[][] = [
      ['المؤشر', 'القيمة'],
      ['اسم الفصل المغلق', archived.name],
      ['تاريخ البدء', archived.startsAt.toLocaleDateString('en-GB')],
      ['تاريخ الإغلاق', archived.archivedAt?.toLocaleDateString('en-GB') || ''],
      ['عدد الدور', dars.length],
      ['عدد الفصول النشطة', dars.reduce((n, d) => n + d.classes.length, 0)],
      [
        'عدد الطالبات النشطات',
        studentCounts.reduce((n, s) => n + s._count._all, 0),
      ],
      ['نسبة الحضور %', overallRates.attendanceRate],
      ['نسبة الإتقان %', overallRates.completionRate],
      ['نسبة الواجب %', overallRates.homeworkRate],
      ['المعدل العام %', overallRates.overallRate],
      ['سجلات الرصد', overallRates.totalRecords],
    ];

    const darSheets = dars.map((dar) => {
      const darTrackings = allTrackings.filter((t) => t.darId === dar.id);
      const darRates = computeRates(darTrackings, weights);
      const rows: (string | number)[][] = [
        ['الفصل', 'عدد الطالبات', 'نسبة الحضور %', 'نسبة الإتقان %', 'نسبة الواجب %', 'المعدل العام %', 'سجلات الرصد'],
      ];
      for (const cls of dar.classes) {
        const classRows = darTrackings.filter((t) => t.classId === cls.id);
        const classRates = computeRates(classRows, weights);
        rows.push([
          cls.name,
          studentCountMap.get(`${dar.id}:${cls.id}`) || 0,
          classRates.attendanceRate,
          classRates.completionRate,
          classRates.homeworkRate,
          classRates.overallRate,
          classRates.totalRecords,
        ]);
      }
      rows.push([
        'إجمالي الدار',
        dar.classes.reduce((n, c) => n + (studentCountMap.get(`${dar.id}:${c.id}`) || 0), 0),
        darRates.attendanceRate,
        darRates.completionRate,
        darRates.homeworkRate,
        darRates.overallRate,
        darRates.totalRecords,
      ]);
      return {
        name: dar.name.slice(0, 31),
        rows,
      };
    });

    return {
      status: 'success',
      data: {
        archived: {
          id: archived.id,
          name: archived.name,
          status: archived.status,
          startsAt: archived.startsAt.toISOString(),
          endsAt: archived.endsAt?.toISOString() || null,
          archivedAt: archived.archivedAt?.toISOString() || null,
        },
        created: {
          id: created.id,
          name: created.name,
          status: created.status,
          startsAt: created.startsAt.toISOString(),
        },
        sheets: [{ name: 'الإحصائيات العامة', rows: generalRows }, ...darSheets],
      },
    };
  });

  app.delete('/curriculum/:id', { preHandler: requireRoles(...ADMIN_ROLES) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.curriculumPlan.delete({ where: { id } });
      return { status: 'success' };
    } catch {
      return reply.code(404).send({ status: 'error', message: 'غير موجود' });
    }
  });
}
