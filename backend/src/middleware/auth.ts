import type { FastifyReply, FastifyRequest } from 'fastify';
import { EntityStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type AuthUser = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  darId: string | null;
  classId: string | null;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

/** التحقق من JWT ثم مزامنة الصلاحيات من قاعدة البيانات (يمنع JWT قديم ببيانات متجاوزة) */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ status: 'error', message: 'يجب تسجيل الدخول' });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      status: true,
      darId: true,
      classId: true,
    },
  });

  if (!dbUser || dbUser.status !== EntityStatus.ACTIVE) {
    return reply.code(401).send({ status: 'error', message: 'الجلسة غير صالحة أو الحساب موقوف' });
  }

  request.user = {
    id: dbUser.id,
    phone: dbUser.phone,
    name: dbUser.name,
    role: dbUser.role,
    darId: dbUser.darId,
    classId: dbUser.classId,
  };
}

/** مدير النظام + المدير العام — صلاحيات إدارية كاملة عدا المساس بحساب مدير النظام. */
export const ADMIN_ROLES: Role[] = [Role.SUPER_MASTER, Role.GENERAL_DIRECTOR];

export function isAdminRole(role: Role) {
  return role === Role.SUPER_MASTER || role === Role.GENERAL_DIRECTOR;
}

export function requireRoles(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ status: 'error', message: 'صلاحية غير كافية' });
    }
  };
}
