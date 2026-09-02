/**
 * مزامنة مشجّرة المستويات في قاعدة البيانات وتفريغ الخطط.
 * O(n) إدراج مستويات؛ O(m) حذف خطط.
 */
import type { CurriculumType, PrismaClient } from '@prisma/client';
import { flattenCurriculumTree } from './curriculum-tree.js';

export async function syncEmptyCurriculumTree(prisma: PrismaClient): Promise<{ levels: number; plansCleared: number }> {
  const flat = flattenCurriculumTree();
  const plansCleared = (await prisma.curriculumPlan.deleteMany({})).count;

  // حذف المستويات القديمة ثم إعادة بناء المشجرة (الأبناء أولاً عبر cascade من الجذور)
  await prisma.curriculumLevel.deleteMany({});

  const idByName = new Map<string, string>();
  for (const row of flat) {
    const created = await prisma.curriculumLevel.create({
      data: {
        name: row.name,
        label: row.label,
        curriculum: row.curriculum as CurriculumType,
        parentId: row.parentName ? idByName.get(row.parentName) ?? null : null,
        isLeaf: row.isLeaf,
        sortOrder: row.sortOrder,
      },
    });
    idByName.set(row.name, created.id);
  }

  return { levels: flat.length, plansCleared };
}
