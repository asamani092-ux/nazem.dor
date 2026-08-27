import { prisma } from './prisma.js';
import { levelsForCurriculum } from './domain.js';

/** المستويات المخصّصة التي أضافها مدير النظام (جدول CurriculumLevel). */
export async function getCustomLevels(): Promise<string[]> {
  const rows = await prisma.curriculumLevel.findMany({ orderBy: { sortOrder: 'asc' } });
  return rows.map((r) => r.name);
}

/**
 * المستويات المسموحة لدار = مستويات المنهج الأساسية + أي مستويات مخصّصة مضافة.
 * O(n) دمج بدون تكرار.
 */
export async function getAllowedLevels(curriculum: string): Promise<string[]> {
  const base = levelsForCurriculum(curriculum);
  const custom = await getCustomLevels();
  const merged = [...base];
  for (const level of custom) {
    if (!merged.includes(level)) merged.push(level);
  }
  return merged;
}

export async function isLevelAllowedMerged(curriculum: string, level: string): Promise<boolean> {
  const allowed = await getAllowedLevels(curriculum);
  return allowed.includes(level);
}
