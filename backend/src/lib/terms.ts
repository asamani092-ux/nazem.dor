import { AcademicTermStatus } from '@prisma/client';
import { prisma } from './prisma.js';

const DEFAULT_TERM_NAME = 'الفصل الحالي';

export async function getActiveTerm() {
  return prisma.academicTerm.findFirst({
    where: { status: AcademicTermStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });
}

/** Get or create the single ACTIVE term named "الفصل الحالي". */
export async function ensureActiveTerm() {
  const existing = await getActiveTerm();
  if (existing) return existing;
  return prisma.academicTerm.create({
    data: {
      name: DEFAULT_TERM_NAME,
      status: AcademicTermStatus.ACTIVE,
      startsAt: new Date(),
    },
  });
}

export async function listTerms() {
  return prisma.academicTerm.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveTermId(termId?: string): Promise<string> {
  if (termId) return termId;
  const term = await getActiveTerm();
  if (term) return term.id;
  const ensured = await ensureActiveTerm();
  return ensured.id;
}

export async function closeActiveTerm(opts?: { newName?: string }) {
  const active = await getActiveTerm();
  if (!active) {
    throw new Error('NO_ACTIVE_TERM');
  }

  const now = new Date();
  const newName = opts?.newName?.trim() || DEFAULT_TERM_NAME;

  return prisma.$transaction(async (tx) => {
    const archived = await tx.academicTerm.update({
      where: { id: active.id },
      data: {
        status: AcademicTermStatus.ARCHIVED,
        archivedAt: now,
        endsAt: now,
      },
    });

    const created = await tx.academicTerm.create({
      data: {
        name: newName,
        status: AcademicTermStatus.ACTIVE,
        startsAt: now,
      },
    });

    return { archived, created };
  });
}
