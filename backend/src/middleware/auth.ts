import type { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@prisma/client';

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

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ status: 'error', message: 'يجب تسجيل الدخول' });
  }
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
