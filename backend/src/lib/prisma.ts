import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function normalizePhone(phone: string): string {
  let p = String(phone || '').trim().replace(/^'+/, '').replace(/\s+/g, '');
  if (p.startsWith('+966')) p = '0' + p.slice(4);
  if (p.startsWith('966')) p = '0' + p.slice(3);
  if (p.length === 9 && p.startsWith('5')) p = '0' + p;
  return p;
}

export function isValidSaudiMobile(phone: string): boolean {
  return /^05\d{8}$/.test(normalizePhone(phone));
}
