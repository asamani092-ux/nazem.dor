import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EntityStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';
import { normalizeHomework } from '../lib/domain.js';
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

    return {
      status: 'success',
      data: {
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

    const rows = await prisma.dailyTracking.findMany({
      where: { darId, classId, week: q.week, day: q.day },
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
        const { levelsForCurriculum, isLevelAllowed } = await import('../lib/domain.js');
        if (!isLevelAllowed(dar.curriculum, cls.level)) {
          return reply.code(400).send({
            status: 'error',
            message: `مستوى الفصل غير متوافق مع منهج الدار. المسموح: ${levelsForCurriculum(dar.curriculum).join('، ')}`,
          });
        }
        if (cls.level !== q.level) {
          return reply.code(400).send({ status: 'error', message: 'المستوى لا يطابق فصل المعلمة' });
        }
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

    const rows = await prisma.lessonTracked.findMany({ where: { darId, classId, week } });
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

    await prisma.$transaction(async (tx) => {
      for (const t of body.trackingData) {
        await tx.dailyTracking.upsert({
          where: {
            classId_studentId_week_day: {
              classId,
              studentId: t.studentId,
              week: body.week,
              day: body.day,
            },
          },
          create: {
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
          classId_week_day: { classId, week: body.week, day: body.day },
        },
        create: { darId, classId, week: body.week, day: body.day },
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
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(400).send({ status: 'error', message: 'حجم الملف يتجاوز 10 ميجابايت' });
    }
    fs.writeFileSync(fullPath, buffer);

    const publicBase = process.env.PUBLIC_URL || '';
    const url = `${publicBase}/uploads/${darId}/${classId}/${safeName}`;
    return { status: 'success', url };
  });

  app.get('/exams/pending', guard, async (request, reply) => {
    const { darId, classId } = request.user;
    if (!darId || !classId) return reply.code(400).send({ status: 'error', message: 'بيانات ناقصة' });

    const graded = await prisma.examGrade.findMany({
      where: { classId },
      select: { examId: true },
      distinct: ['examId'],
    });
    const gradedSet = new Set(graded.map((g) => g.examId));

    const exams = await prisma.exam.findMany({
      where: { OR: [{ darId: null }, { darId }] },
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
          }),
        ),
      })
      .parse(request.body);

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) return reply.code(404).send({ status: 'error', message: 'الاختبار غير موجود' });

    const already = await prisma.examGrade.findFirst({ where: { classId, examId: id } });
    if (already) {
      return reply.code(403).send({
        status: 'error',
        message: 'تم رصد هذا الاختبار مسبقاً. التعديل غير مسموح إلا عبر طلب موافقة (قريباً).',
      });
    }

    await prisma.$transaction(
      body.gradesData.map((g) =>
        prisma.examGrade.create({
          data: {
            darId,
            classId,
            examId: id,
            examTitle: body.examTitle,
            studentId: g.studentId,
            studentName: g.name,
            score: g.score,
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

    const trackings = await prisma.dailyTracking.findMany({ where: { studentId } });
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

    const grades = await prisma.examGrade.findMany({ where: { studentId, classId } });
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
