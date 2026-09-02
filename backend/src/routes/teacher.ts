import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EntityStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';
import { normalizeHomework } from '../lib/domain.js';
import { ensureActiveTerm, getActiveTerm } from '../lib/terms.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export async function teacherRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRoles(Role.TEACHER) };

  app.get('/dashboard', guard, async (request, reply) => {
    const { darId, classId, id: userId } = request.user;
    if (!darId || !classId) {
      return reply.code(400).send({ status: 'error', message: 'حساب المعلمة غير مكتمل' });
    }

    // ترحيل مستوى الفصل فوراً ليتوافق مع منهج الدار
    const [dar, cls] = await Promise.all([
      prisma.dar.findUnique({ where: { id: darId } }),
      prisma.class.findUnique({ where: { id: classId } }),
    ]);
    let classLevel = cls?.level || '';
    if (dar && cls) {
      const { coerceLevelForCurriculum } = await import('../lib/levels.js');
      const next = coerceLevelForCurriculum(cls.level, String(dar.curriculum));
      if (next && next !== cls.level) {
        await prisma.class.update({ where: { id: cls.id }, data: { level: next } });
        classLevel = next;
      } else {
        classLevel = next || cls.level;
      }
    }

    const [notifications, students, reads] = await Promise.all([
      prisma.teacherNotification.findMany({
        where: {
          darId,
          OR: [{ classId: null }, { classId }],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.student.findMany({
        where: { darId, classId, status: EntityStatus.ACTIVE },
        orderBy: { name: 'asc' },
      }),
      prisma.teacherNotificationRead.findMany({
        where: { userId },
        select: { notificationId: true },
      }),
    ]);

    const readSet = new Set(reads.map((r) => r.notificationId));
    const activeTerm = await getActiveTerm();

    const lastTrack = await prisma.dailyTracking.findFirst({
      where: { darId, classId, ...(activeTerm ? { termId: activeTerm.id } : {}) },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true, week: true, day: true, dateStr: true },
    });

    return {
      status: 'success',
      data: {
        classLevel,
        className: cls?.name,
        alerts: notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.content,
          content: n.content,
          date: n.createdAt.toLocaleDateString('en-GB'),
          isRead: readSet.has(n.id),
        })),
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
          parentPhone: s.parentPhone,
        })),
        lastSavedAt: lastTrack?.updatedAt?.toISOString() || null,
        lastSavedLabel: lastTrack
          ? `آخر رصد محفوظ: ${lastTrack.day} · أسبوع ${lastTrack.week} · ${lastTrack.dateStr || lastTrack.updatedAt.toLocaleDateString('en-GB')}`
          : 'لم يُحفظ رصد لهذا الفصل بعد',
      },
    };
  });

  app.post('/notifications/:id/read', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.id;
    const note = await prisma.teacherNotification.findUnique({ where: { id } });
    if (!note || note.darId !== request.user.darId) {
      return reply.code(404).send({ status: 'error', message: 'الإشعار غير موجود' });
    }
    await prisma.teacherNotificationRead.upsert({
      where: { notificationId_userId: { notificationId: id, userId } },
      create: { notificationId: id, userId },
      update: {},
    });
    return { status: 'success' };
  });

  app.get('/tracking', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const q = z
      .object({
        week: z.coerce.number().int().positive(),
        day: z.string().min(1),
      })
      .parse(request.query);

    const activeTerm = await getActiveTerm();
    const rows = await prisma.dailyTracking.findMany({
      where: {
        darId,
        classId,
        week: q.week,
        day: q.day,
        ...(activeTerm ? { termId: activeTerm.id } : {}),
      },
    });

    return {
      status: 'success',
      data: rows.map((r) => ({
        studentId: r.studentId,
        attendance: r.attendance,
        homework: r.homework,
        educational: r.educational,
        tarbawi: r.tarbawi,
        attachment: r.attachment || '',
      })),
    };
  });

  app.get('/lesson-plan', guard, async (request, reply) => {
    const q = z
      .object({
        level: z.string(),
        week: z.coerce.number().int().positive(),
        day: z.string(),
      })
      .parse(request.query);

    const { darId, classId } = request.user;
    if (darId && classId) {
      const [dar, cls] = await Promise.all([
        prisma.dar.findUnique({ where: { id: darId } }),
        prisma.class.findUnique({ where: { id: classId } }),
      ]);
      if (dar && cls) {
        const { levelsForCurriculum, resolveCanonicalLevel } = await import('../lib/domain.js');
        const { coerceLevelForCurriculum } = await import('../lib/levels.js');
        const classLevel = coerceLevelForCurriculum(cls.level, String(dar.curriculum));
        if (!levelsForCurriculum(String(dar.curriculum)).includes(classLevel)) {
          return reply.code(400).send({
            status: 'error',
            message: `مستوى الفصل «${cls.level}» غير متوافق مع منهج الدار. حدّث مستوى الفصل من حساب المديرة إلى أحد: ${levelsForCurriculum(String(dar.curriculum)).join('، ')}`,
          });
        }
        if (cls.level !== classLevel) {
          await prisma.class.update({ where: { id: cls.id }, data: { level: classLevel } });
        }
        const queryLevel = coerceLevelForCurriculum(q.level, String(dar.curriculum));
        // إن اختلاف الطلب عن الفصل بعد التحويل: اعتمد مستوى الفصل المحدَّث
        if (classLevel !== queryLevel && resolveCanonicalLevel(q.level) !== classLevel) {
          // لا ترفض — المعلمة تعتمد classLevel من الجلسة؛ صحّح الطلب
        }
        q.level = classLevel;
      }
    }

    const cleanLevel = q.level.replace(/أ/g, 'ا').trim();
    const plans = await prisma.curriculumPlan.findMany({ where: { week: q.week, day: q.day } });
    const plan = plans.find((p) => p.level.replace(/أ/g, 'ا').trim() === cleanLevel);

    if (!plan) {
      return reply.code(404).send({ status: 'error', message: 'لم يتم العثور على خطة مسجلة لهذا اليوم.' });
    }

    return {
      status: 'success',
      educational: plan.educational,
      homework: normalizeHomework(plan.homework),
      tarbawi: plan.tarbawi || '',
    };
  });

  app.get('/tracked-days', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const week = z.coerce.number().parse((request.query as { week?: string }).week);

    const term = await ensureActiveTerm();
    if (!term) {
      return reply.code(500).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط' });
    }
    const rows = await prisma.lessonTracked.findMany({ where: { darId, classId, week, termId: term.id } });
    return { status: 'success', data: rows.map((r) => r.day) };
  });

  app.post('/tracking', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });

    const body = z
      .object({
        date: z.string(),
        week: z.number().int().positive(),
        day: z.string(),
        trackingData: z.array(
          z.object({
            studentId: z.string(),
            studentName: z.string(),
            attendance: z.string(),
            homework: z.string(),
            educational: z.string(),
            tarbawi: z.string().optional(),
            attachment: z.string().optional(),
          }),
        ),
      })
      .parse(request.body);

    const term = await ensureActiveTerm();
    if (!term) {
      return reply.code(500).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط' });
    }
    await prisma.$transaction(async (tx) => {
      for (const t of body.trackingData) {
        await tx.dailyTracking.upsert({
          where: {
            termId_classId_studentId_week_day: {
              termId: term.id,
              classId,
              studentId: t.studentId,
              week: body.week,
              day: body.day,
            },
          },
          create: {
            termId: term.id,
            darId,
            classId,
            studentId: t.studentId,
            dateStr: body.date,
            week: body.week,
            day: body.day,
            attendance: t.attendance,
            homework: t.homework,
            educational: t.educational,
            tarbawi: t.tarbawi || '-',
            attachment: t.attachment || null,
          },
          update: {
            dateStr: body.date,
            attendance: t.attendance,
            homework: t.homework,
            educational: t.educational,
            tarbawi: t.tarbawi || '-',
            attachment: t.attachment || null,
          },
        });
      }

      await tx.lessonTracked.upsert({
        where: {
          termId_classId_week_day: { termId: term.id, classId, week: body.week, day: body.day },
        },
        create: { termId: term.id, darId, classId, week: body.week, day: body.day },
        update: {},
      });
    });

    return { status: 'success' };
  });

  app.post('/upload', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });

    const file = await request.file();
    if (!file) return reply.code(400).send({ status: 'error', message: 'لا يوجد ملف' });

    const allowed = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);
    const mime = String(file.mimetype || '').toLowerCase();
    if (!allowed.has(mime)) {
      return reply.code(400).send({ status: 'error', message: 'نوع الملف غير مسموح (صور أو PDF فقط)' });
    }

    const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    const dir = path.join(uploadRoot, darId, classId);
    const resolvedDir = path.resolve(dir);
    if (!resolvedDir.startsWith(uploadRoot + path.sep) && resolvedDir !== uploadRoot) {
      return reply.code(400).send({ status: 'error', message: 'مسار غير صالح' });
    }
    fs.mkdirSync(resolvedDir, { recursive: true });

    const ext =
      mime === 'application/pdf'
        ? '.pdf'
        : mime === 'image/png'
          ? '.png'
          : mime === 'image/webp'
            ? '.webp'
            : '.jpg';
    const safeName = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = path.join(resolvedDir, safeName);
    const buffer = await file.toBuffer();
    if (buffer.length > 30 * 1024 * 1024) {
      return reply.code(400).send({ status: 'error', message: 'حجم الملف يتجاوز 30 ميجابايت' });
    }
    fs.writeFileSync(fullPath, buffer);

    const publicBase = process.env.PUBLIC_URL || '';
    const url = `${publicBase}/uploads/${darId}/${classId}/${safeName}`;
    return { status: 'success', url };
  });

  app.get('/week-attachments', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const term = await ensureActiveTerm();
    if (!term) {
      return reply.code(500).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط' });
    }
    const rows = await prisma.weekAttachment.findMany({
      where: { classId, termId: term.id },
      orderBy: { week: 'asc' },
    });
    return {
      status: 'success',
      data: rows.map((r) => ({
        week: r.week,
        url: r.url,
        fileName: r.fileName || '',
        uploadedAt: r.updatedAt.toLocaleDateString('en-GB'),
      })),
    };
  });

  app.post('/week-attachments', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const body = z
      .object({
        week: z.number().int().positive(),
        url: z.string().min(1),
        fileName: z.string().optional(),
      })
      .parse(request.body);

    const term = await ensureActiveTerm();
    if (!term) {
      return reply.code(500).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط' });
    }
    await prisma.weekAttachment.upsert({
      where: { termId_classId_week: { termId: term.id, classId, week: body.week } },
      create: { termId: term.id, darId, classId, week: body.week, url: body.url, fileName: body.fileName || null },
      update: { url: body.url, fileName: body.fileName || null },
    });
    return { status: 'success' };
  });

  app.delete('/week-attachments/:week', guard, async (request, reply) => {
    const { classId } = request.user;
    if (!classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const week = Number((request.params as { week: string }).week);
    if (!Number.isInteger(week) || week <= 0) {
      return reply.code(400).send({ status: 'error', message: 'أسبوع غير صالح' });
    }
    const term = await ensureActiveTerm();
    if (!term) {
      return reply.code(500).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط' });
    }
    await prisma.weekAttachment.deleteMany({ where: { classId, week, termId: term.id } });
    return { status: 'success' };
  });

  app.get('/exams', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });

    const activeTerm = await getActiveTerm();
    const termFilter = activeTerm ? { termId: activeTerm.id } : {};

    const students = await prisma.student.findMany({
      where: { darId, classId, status: EntityStatus.ACTIVE },
      select: { id: true },
    });
    if (!students.length) {
      return { status: 'success', data: { pending: [], graded: [] } };
    }

    const exams = await prisma.exam.findMany({
      where: { OR: [{ darId: null }, { darId }], ...termFilter },
      orderBy: { examDate: 'desc' },
    });

    const grades = await prisma.examGrade.findMany({
      where: { classId, ...termFilter },
      orderBy: { gradedAt: 'desc' },
    });

    const gradedExamIds = new Set(grades.map((g) => g.examId));

    const pending = exams
      .filter((e) => !gradedExamIds.has(e.id))
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.examDate.toLocaleDateString('en-GB'),
        link: e.link,
        maxScore: e.maxScore,
      }));

    const gradedMap = new Map<string, { exam: typeof exams[0]; grades: typeof grades }>();
    for (const g of grades) {
      const exam = exams.find((e) => e.id === g.examId);
      if (!exam) continue;
      if (!gradedMap.has(g.examId)) gradedMap.set(g.examId, { exam, grades: [] });
      gradedMap.get(g.examId)!.grades.push(g);
    }

    const graded = [...gradedMap.values()].map(({ exam, grades: gs }) => ({
      id: exam.id,
      title: exam.title,
      date: exam.examDate.toLocaleDateString('en-GB'),
      link: exam.link,
      maxScore: exam.maxScore,
      grades: gs.map((g) => ({
        studentId: g.studentId,
        name: g.studentName,
        score: g.score,
        note: g.note || '',
      })),
    }));

    return { status: 'success', data: { pending, graded } };
  });

  app.get('/exams/pending', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });

    const activeTerm = await getActiveTerm();
    const termFilter = activeTerm ? { termId: activeTerm.id } : {};

    const graded = await prisma.examGrade.findMany({
      where: { classId, ...termFilter },
      select: { examId: true },
      distinct: ['examId'],
    });
    const gradedSet = new Set(graded.map((g) => g.examId));

    const exams = await prisma.exam.findMany({
      where: { OR: [{ darId: null }, { darId }], ...termFilter },
      orderBy: { examDate: 'desc' },
    });

    return {
      status: 'success',
      data: exams
        .filter((e) => !gradedSet.has(e.id))
        .map((e) => ({
          id: e.id,
          title: e.title,
          date: e.examDate.toLocaleDateString('en-GB'),
          link: e.link,
          maxScore: e.maxScore,
        })),
    };
  });

  app.post('/exams/:id/grades', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const { id } = request.params as { id: string };

    const body = z
      .object({
        examTitle: z.string(),
        gradesData: z.array(
          z.object({
            studentId: z.string(),
            name: z.string(),
            score: z.string(),
            note: z.string().optional(),
          }),
        ),
      })
      .parse(request.body);

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) return reply.code(404).send({ status: 'error', message: 'الاختبار غير موجود' });

    const activeTerm = await getActiveTerm();
    if (!activeTerm) {
      return reply.code(500).send({ status: 'error', message: 'لا يوجد فصل دراسي نشط' });
    }
    const termId = activeTerm.id;

    for (const g of body.gradesData) {
      const raw = String(g.score ?? '').trim();
      if (!raw || raw === 'غائبة') continue;
      const value = parseFloat(raw);
      if (Number.isNaN(value)) {
        return reply.code(400).send({
          status: 'error',
          message: `درجة غير صالحة للطالبة ${g.name}. إدخال رقم أو تركه فارغاً`,
        });
      }
      if (value < 0 || value > exam.maxScore) {
        return reply.code(400).send({
          status: 'error',
          message: `درجة ${g.name} (${raw}) تتجاوز سقف الاختبار ${exam.maxScore}`,
        });
      }
    }

    const studentIds = body.gradesData.map((g) => g.studentId);
    const activeStudents = await prisma.student.count({
      where: { darId, classId, status: EntityStatus.ACTIVE, id: { in: studentIds } },
    });
    if (activeStudents === 0) {
      return reply.code(400).send({ status: 'error', message: 'لا توجد طالبات في الفصل' });
    }

    const term = activeTerm;
    await prisma.$transaction(
      body.gradesData.map((g) =>
        prisma.examGrade.upsert({
          where: {
            classId_examId_studentId: { classId, examId: id, studentId: g.studentId },
          },
          create: {
            termId: term.id,
            darId,
            classId,
            examId: id,
            examTitle: body.examTitle,
            studentId: g.studentId,
            studentName: g.name,
            score: g.score,
            note: g.note || null,
          },
          update: {
            score: g.score,
            note: g.note || null,
            studentName: g.name,
            examTitle: body.examTitle,
            gradedAt: new Date(),
          },
        }),
      ),
    );

    return { status: 'success' };
  });

  app.get('/students/:studentId/report', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });
    const { studentId } = request.params as { studentId: string };

    const student = await prisma.student.findFirst({ where: { id: studentId, darId, classId } });
    if (!student) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });

    const activeTerm = await getActiveTerm();
    const termFilter = activeTerm ? { termId: activeTerm.id } : {};

    const trackings = await prisma.dailyTracking.findMany({ where: { studentId, ...termFilter } });
    let presentDays = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    for (const t of trackings) {
      if (t.attendance === 'حاضرة') presentDays++;
      if (t.attendance !== 'غائبة') {
        totalTasks += 2;
        if (t.homework === 'أنجزت') completedTasks++;
        if (t.educational === 'أتقنت') completedTasks++;
      }
    }

    const grades = await prisma.examGrade.findMany({ where: { studentId, classId, ...termFilter } });
    let totalExamScore = 0;
    let examCount = 0;
    for (const g of grades) {
      const score = parseFloat(g.score);
      if (!Number.isNaN(score)) {
        totalExamScore += score;
        examCount++;
      }
    }

    const totalDays = trackings.length;
    return {
      status: 'success',
      data: {
        attRate: totalDays ? Math.round((presentDays / totalDays) * 100) : 0,
        compRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
        examRate: examCount ? Math.round(totalExamScore / examCount) : 0,
      },
    };
  });
}
