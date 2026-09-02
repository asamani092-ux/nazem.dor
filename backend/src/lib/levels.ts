import { CurriculumType } from '@prisma/client';
import { prisma } from './prisma.js';
import { levelsForCurriculum } from './domain.js';
import { curriculumTreeDto, leafLevelsForCurriculum, resolveCanonicalLevel } from './curriculum-tree.js';

function toCurriculumType(curriculum: string): CurriculumType | null {
  if (curriculum === 'TIBYAN' || curriculum === 'منهج تبيان') return CurriculumType.TIBYAN;
  if (curriculum === 'QARI' || curriculum === 'منهج قارئ') return CurriculumType.QARI;
  if (curriculum === 'BOTH' || curriculum === 'كلاهما' || curriculum === 'تبيان/قارئ') return null;
  return null;
}

/** أوراق المشجّرة من قاعدة البيانات. O(n) */
export async function getLeafLevelsFromDb(curriculum: string): Promise<string[]> {
  const ctype = toCurriculumType(curriculum);
  const rows = await prisma.curriculumLevel.findMany({
    where: ctype ? { isLeaf: true, curriculum: ctype } : { isLeaf: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (rows.length) return rows.map((r) => r.name);
  return leafLevelsForCurriculum(curriculum);
}

/** المستويات المسموحة لدار = أوراق المشجّرة للمنهج. O(n) */
export async function getAllowedLevels(curriculum: string): Promise<string[]> {
  const fromDb = await getLeafLevelsFromDb(String(curriculum));
  if (fromDb.length) return fromDb;
  return levelsForCurriculum(String(curriculum));
}

export async function isLevelAllowedMerged(curriculum: string, level: string): Promise<boolean> {
  const allowed = await getAllowedLevels(curriculum);
  const canonical = resolveCanonicalLevel(level);
  return allowed.includes(level) || allowed.includes(canonical);
}

/** شجرة للواجهة من التعريف الثابت. O(n) */
export function getCurriculumTree() {
  return curriculumTreeDto();
}

/** تحديث مستويات الفصول القديمة إلى أوراق المشجّرة. O(c) */
export async function migrateClassLevelsToCanonical(): Promise<number> {
  const classes = await prisma.class.findMany({ select: { id: true, level: true } });
  let updated = 0;
  for (const cls of classes) {
    const next = resolveCanonicalLevel(cls.level);
    if (next && next !== cls.level) {
      await prisma.class.update({ where: { id: cls.id }, data: { level: next } });
      updated++;
    }
  }
  return updated;
}
