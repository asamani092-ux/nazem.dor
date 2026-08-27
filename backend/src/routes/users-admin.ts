import type { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { EntityStatus, Role } from '@prisma/client';
import { isValidSaudiMobile, normalizePhone, prisma } from '../lib/prisma.js';
import { ADMIN_ROLES, requireRoles } from '../middleware/auth.js';

type AccountType = 'SUPER_MASTER' | 'GENERAL_DIRECTOR' | 'MASTER' | 'MANAGER' | 'TEACHER' | 'STUDENT';

function statusLabel(s: EntityStatus) {
  if (s === EntityStatus.ACTIVE) return 'نشط';
  if (s === EntityStatus.SUSPENDED) return 'معلق';
  return 'محذوف';
}

function typeLabel(t: AccountType) {
  if (t === 'SUPER_MASTER') return 'مدير النظام';
  if (t === 'GENERAL_DIRECTOR') return 'المدير العام';
  if (t === 'MASTER') return 'مشرفة';
  if (t === 'MANAGER') return 'مديرة';
  if (t === 'TEACHER') return 'معلمة';
  return 'طالبة';
}

const filterEnum = z.enum([
  'ALL',
  'MASTER',
  'MANAGER',
  'TEACHER',
  'STUDENT',
  'SUPER_MASTER',
  'GENERAL_DIRECTOR',
]);

/**
 * حارس إدارة الحسابات.
 * Time O(1) Space O(1).
 * - الهدف SUPER_MASTER: مدير النظام فقط (تعليق/حذف ممنوعان لاحقاً).
 * - الهدف GENERAL_DIRECTOR: مدير النظام فقط.
 * - غير ذلك: مدير النظام أو المدير العام.
 */
function assertCanManage(
  requesterRole: Role,
  targetRole: Role,
  reply: FastifyReply,
): boolean {
  if (targetRole === Role.SUPER_MASTER) {
    if (requesterRole !== Role.SUPER_MASTER) {
      reply.code(403).send({ status: 'error', message: 'لا يمكن إدارة حساب مدير النظام' });
      return false;
    }
    return true;
  }
  if (targetRole === Role.GENERAL_DIRECTOR) {
    if (requesterRole !== Role.SUPER_MASTER) {
      reply.code(403).send({ status: 'error', message: 'إدارة المدير العام لمدير النظام فقط' });
      return false;
    }
    return true;
  }
  return true;
}

/** Time O(n) users+students; Space O(n) response list. */
export async function usersAdminRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRoles(...ADMIN_ROLES) };

  app.get('/meta', guard, async () => {
    const dars = await prisma.dar.findMany({
      where: { status: { not: EntityStatus.DELETED } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        classes: {
          where: { status: { not: EntityStatus.DELETED } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, level: true, darId: true },
        },
      },
    });
    return {
      status: 'success',
      data: {
        dars: dars.map((d) => ({
          id: d.id,
          name: d.name,
          classes: d.classes,
        })),
      },
    };
  });

  app.get('/', guard, async (request) => {
    const q = z
      .object({
        type: filterEnum.default('ALL'),
        search: z.string().optional(),
      })
      .parse(request.query);

    const requester = request.user.role;
    const hideSuper = requester === Role.GENERAL_DIRECTOR;

    if (hideSuper && q.type === 'SUPER_MASTER') {
      return { status: 'success', data: [] };
    }

    const search = (q.search || '').trim();
    const items: Array<{
      id: string;
      kind: 'USER' | 'STUDENT';
      type: AccountType;
      typeLabel: string;
      name: string;
      phone: string;
      status: string;
      darId: string | null;
      darName: string;
      classId: string | null;
      className: string;
    }> = [];

    const wantUsers =
      q.type === 'ALL' ||
      q.type === 'MASTER' ||
      q.type === 'MANAGER' ||
      q.type === 'TEACHER' ||
      q.type === 'SUPER_MASTER' ||
      q.type === 'GENERAL_DIRECTOR';
    const wantStudents = q.type === 'ALL' || q.type === 'STUDENT';

    if (wantUsers) {
      const roleFilter =
        q.type === 'ALL' || q.type === 'STUDENT' ? undefined : (q.type as Role);

      const users = await prisma.user.findMany({
        where: {
          status: { not: EntityStatus.DELETED },
          ...(roleFilter
            ? { role: roleFilter }
            : hideSuper
              ? { role: { not: Role.SUPER_MASTER } }
              : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                ],
              }
            : {}),
        },
        include: { dar: { select: { name: true } }, class: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      for (const u of users) {
        const type = u.role as AccountType;
        items.push({
          id: u.id,
          kind: 'USER',
          type,
          typeLabel: typeLabel(type),
          name: u.name,
          phone: u.phone,
          status: statusLabel(u.status),
          darId: u.darId,
          darName: u.dar?.name || '',
          classId: u.classId,
          className: u.class?.name || '',
        });
      }
    }

    if (wantStudents) {
      const students = await prisma.student.findMany({
        where: {
          status: { not: EntityStatus.DELETED },
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { parentPhone: { contains: search } },
                ],
              }
            : {}),
        },
        include: {
          dar: { select: { name: true } },
          class: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      for (const s of students) {
        items.push({
          id: s.id,
          kind: 'STUDENT',
          type: 'STUDENT',
          typeLabel: typeLabel('STUDENT'),
          name: s.name,
          phone: s.parentPhone,
          status: statusLabel(s.status),
          darId: s.darId,
          darName: s.dar?.name || '',
          classId: s.classId,
          className: s.class?.name || '',
        });
      }
    }

    return { status: 'success', data: items };
  });

  app.post('/', guard, async (request, reply) => {
    const peekType = (request.body as { type?: string } | null)?.type;
    if (peekType === 'GENERAL_DIRECTOR' && request.user.role !== Role.SUPER_MASTER) {
      return reply.code(403).send({ status: 'error', message: 'إنشاء المدير العام لمدير النظام فقط' });
    }

    const body = z
      .object({
        type: z.enum(['GENERAL_DIRECTOR', 'MASTER', 'MANAGER', 'TEACHER', 'STUDENT']),
        name: z.string().min(2),
        phone: z.string(),
        darId: z.string().optional(),
        classId: z.string().optional(),
      })
      .parse(request.body);

    if (body.type === 'GENERAL_DIRECTOR' && request.user.role !== Role.SUPER_MASTER) {
      return reply.code(403).send({ status: 'error', message: 'إنشاء المدير العام لمدير النظام فقط' });
    }

    const phone = normalizePhone(body.phone);
    if (!isValidSaudiMobile(phone)) {
      return reply.code(400).send({ status: 'error', message: 'جوال غير صحيح' });
    }

    if (body.type === 'GENERAL_DIRECTOR') {
      if (await prisma.user.findUnique({ where: { phone } })) {
        return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });
      }
      const user = await prisma.user.create({
        data: {
          name: body.name.trim(),
          phone,
          role: Role.GENERAL_DIRECTOR,
          passwordHash: await bcrypt.hash(phone.slice(-6), 10),
          mustChangePassword: false,
        },
      });
      return {
        status: 'success',
        message: `تم إنشاء المدير العام. الدخول: ${phone}`,
        data: { id: user.id, kind: 'USER' },
      };
    }

    if (body.type === 'MASTER') {
      if (await prisma.user.findUnique({ where: { phone } })) {
        return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });
      }
      const user = await prisma.user.create({
        data: {
          name: body.name.trim(),
          phone,
          role: Role.MASTER,
          passwordHash: await bcrypt.hash(phone.slice(-6), 10),
          mustChangePassword: false,
        },
      });
      return {
        status: 'success',
        message: `تم إنشاء المشرفة. الدخول: ${phone}`,
        data: { id: user.id, kind: 'USER' },
      };
    }

    if (body.type === 'MANAGER') {
      if (!body.darId) return reply.code(400).send({ status: 'error', message: 'اختيار الدار مطلوب' });
      const dar = await prisma.dar.findFirst({
        where: { id: body.darId, status: { not: EntityStatus.DELETED } },
      });
      if (!dar) return reply.code(404).send({ status: 'error', message: 'الدار غير موجودة' });

      const phoneTaken = await prisma.user.findFirst({
        where: { phone, NOT: { role: Role.MANAGER, darId: dar.id } },
      });
      if (phoneTaken) return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });

      const existing = await prisma.user.findFirst({
        where: { darId: dar.id, role: Role.MANAGER, status: { not: EntityStatus.DELETED } },
      });

      const user = await prisma.$transaction(async (tx) => {
        await tx.dar.update({
          where: { id: dar.id },
          data: { managerName: body.name.trim(), managerPhone: phone },
        });
        if (existing) {
          return tx.user.update({
            where: { id: existing.id },
            data: { name: body.name.trim(), phone, status: EntityStatus.ACTIVE },
          });
        }
        return tx.user.create({
          data: {
            name: body.name.trim(),
            phone,
            role: Role.MANAGER,
            darId: dar.id,
            passwordHash: await bcrypt.hash(phone.slice(-6), 10),
            mustChangePassword: false,
          },
        });
      });

      return {
        status: 'success',
        message: existing ? 'تم تحديث مديرة الدار' : `تم إنشاء المديرة. الدخول: ${phone}`,
        data: { id: user.id, kind: 'USER' },
      };
    }

    if (body.type === 'TEACHER') {
      if (!body.classId) return reply.code(400).send({ status: 'error', message: 'اختيار الفصل مطلوب' });
      const cls = await prisma.class.findFirst({
        where: { id: body.classId, status: { not: EntityStatus.DELETED } },
      });
      if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });

      const phoneTaken = await prisma.user.findFirst({
        where: { phone, NOT: { role: Role.TEACHER, classId: cls.id } },
      });
      if (phoneTaken) return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });

      const existing = await prisma.user.findFirst({
        where: { classId: cls.id, role: Role.TEACHER, status: { not: EntityStatus.DELETED } },
      });

      const user = await prisma.$transaction(async (tx) => {
        await tx.class.update({
          where: { id: cls.id },
          data: { teacherName: body.name.trim(), teacherPhone: phone },
        });
        if (existing) {
          return tx.user.update({
            where: { id: existing.id },
            data: {
              name: body.name.trim(),
              phone,
              darId: cls.darId,
              status: EntityStatus.ACTIVE,
            },
          });
        }
        return tx.user.create({
          data: {
            name: body.name.trim(),
            phone,
            role: Role.TEACHER,
            darId: cls.darId,
            classId: cls.id,
            passwordHash: await bcrypt.hash(phone.slice(-6), 10),
            mustChangePassword: false,
          },
        });
      });

      return {
        status: 'success',
        message: existing ? 'تم تحديث معلمة الفصل' : `تم إنشاء المعلمة. الدخول: ${phone}`,
        data: { id: user.id, kind: 'USER' },
      };
    }

    // STUDENT
    if (!body.classId) return reply.code(400).send({ status: 'error', message: 'اختيار الفصل مطلوب' });
    const cls = await prisma.class.findFirst({
      where: { id: body.classId, status: { not: EntityStatus.DELETED } },
    });
    if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });

    const student = await prisma.student.create({
      data: {
        darId: cls.darId,
        classId: cls.id,
        name: body.name.trim(),
        parentPhone: phone,
      },
    });
    return {
      status: 'success',
      message: 'تم تسجيل الطالبة',
      data: { id: student.id, kind: 'STUDENT' },
    };
  });

  app.put('/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        kind: z.enum(['USER', 'STUDENT']),
        name: z.string().min(2),
        phone: z.string(),
        classId: z.string().optional(),
        darId: z.string().optional(),
      })
      .parse(request.body);

    const phone = normalizePhone(body.phone);
    if (!isValidSaudiMobile(phone)) {
      return reply.code(400).send({ status: 'error', message: 'جوال غير صحيح' });
    }

    if (body.kind === 'STUDENT') {
      const stu = await prisma.student.findFirst({
        where: { id, status: { not: EntityStatus.DELETED } },
      });
      if (!stu) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });

      let darId = stu.darId;
      let classId = stu.classId;
      if (body.classId && body.classId !== stu.classId) {
        const cls = await prisma.class.findFirst({
          where: { id: body.classId, status: { not: EntityStatus.DELETED } },
        });
        if (!cls) return reply.code(404).send({ status: 'error', message: 'الفصل غير موجود' });
        darId = cls.darId;
        classId = cls.id;
      }

      await prisma.student.update({
        where: { id },
        data: { name: body.name.trim(), parentPhone: phone, darId, classId },
      });
      return { status: 'success', message: 'تم تحديث الطالبة' };
    }

    const user = await prisma.user.findFirst({
      where: { id, status: { not: EntityStatus.DELETED } },
    });
    if (!user) return reply.code(404).send({ status: 'error', message: 'الحساب غير موجود' });
    if (!assertCanManage(request.user.role, user.role, reply)) return;

    const taken = await prisma.user.findFirst({ where: { phone, NOT: { id } } });
    if (taken) return reply.code(400).send({ status: 'error', message: 'الجوال مستخدم' });

    await prisma.$transaction(async (tx) => {
      const data: {
        name: string;
        phone: string;
        darId?: string | null;
        classId?: string | null;
      } = { name: body.name.trim(), phone };

      if (user.role === Role.MANAGER) {
        const darId = body.darId || user.darId;
        if (darId) {
          data.darId = darId;
          await tx.dar.update({
            where: { id: darId },
            data: { managerName: body.name.trim(), managerPhone: phone },
          });
        }
      }

      if (user.role === Role.TEACHER) {
        let classId = body.classId || user.classId;
        if (classId) {
          const cls = await tx.class.findUnique({ where: { id: classId } });
          if (cls) {
            data.classId = classId;
            data.darId = cls.darId;
            await tx.class.update({
              where: { id: classId },
              data: { teacherName: body.name.trim(), teacherPhone: phone },
            });
          }
        }
      }

      await tx.user.update({ where: { id }, data });
    });

    return { status: 'success', message: 'تم تحديث الحساب' };
  });

  app.post('/:id/status', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        kind: z.enum(['USER', 'STUDENT']),
        status: z.enum(['نشط', 'معلق']),
      })
      .parse(request.body);

    if (body.kind === 'USER' && request.user.id === id) {
      return reply.code(400).send({ status: 'error', message: 'لا يمكن تعليق حسابك الحالي' });
    }

    const status = body.status === 'معلق' ? EntityStatus.SUSPENDED : EntityStatus.ACTIVE;

    if (body.kind === 'STUDENT') {
      const stu = await prisma.student.findFirst({
        where: { id, status: { not: EntityStatus.DELETED } },
      });
      if (!stu) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });
      await prisma.student.update({ where: { id }, data: { status } });
      return { status: 'success' };
    }

    const user = await prisma.user.findFirst({
      where: { id, status: { not: EntityStatus.DELETED } },
    });
    if (!user) return reply.code(404).send({ status: 'error', message: 'الحساب غير موجود' });
    if (!assertCanManage(request.user.role, user.role, reply)) return;
    if (user.role === Role.SUPER_MASTER && status === EntityStatus.SUSPENDED) {
      return reply.code(400).send({ status: 'error', message: 'لا يمكن تعليق مدير النظام' });
    }

    await prisma.user.update({ where: { id }, data: { status } });
    return { status: 'success' };
  });

  app.delete('/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const qKind = (request.query as { kind?: string }).kind;
    let kind: 'USER' | 'STUDENT' | undefined = qKind === 'USER' || qKind === 'STUDENT' ? qKind : undefined;
    if (!kind && request.body && typeof request.body === 'object' && 'kind' in (request.body as object)) {
      kind = z.enum(['USER', 'STUDENT']).parse((request.body as { kind: string }).kind);
    }
    if (!kind) {
      return reply.code(400).send({ status: 'error', message: 'kind مطلوب (USER أو STUDENT)' });
    }

    if (kind === 'USER' && request.user.id === id) {
      return reply.code(400).send({ status: 'error', message: 'لا يمكن حذف حسابك الحالي' });
    }

    if (kind === 'STUDENT') {
      const stu = await prisma.student.findFirst({
        where: { id, status: { not: EntityStatus.DELETED } },
      });
      if (!stu) return reply.code(404).send({ status: 'error', message: 'الطالبة غير موجودة' });
      await prisma.student.update({ where: { id }, data: { status: EntityStatus.DELETED } });
      return { status: 'success' };
    }

    const user = await prisma.user.findFirst({
      where: { id, status: { not: EntityStatus.DELETED } },
    });
    if (!user) return reply.code(404).send({ status: 'error', message: 'الحساب غير موجود' });
    if (!assertCanManage(request.user.role, user.role, reply)) return;
    if (user.role === Role.SUPER_MASTER) {
      return reply.code(400).send({ status: 'error', message: 'لا يمكن حذف مدير النظام' });
    }

    await prisma.user.update({ where: { id }, data: { status: EntityStatus.DELETED } });
    return { status: 'success' };
  });
}
