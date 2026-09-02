import { CurriculumType } from '@prisma/client';
import { prisma } from './prisma.js';
import { levelsForCurriculum } from './domain.js';
import {
  curriculumTreeDto,
  leafLevelsForCurriculum,
  resolveCanonicalLevel,
} from './curriculum-tree.js';

function toCurriculumType(curriculum: string): CurriculumType | null {
  if (curriculum === 'TIBYAN' || curriculum === 'منهج تبيان') return CurriculumType.TIBYAN;
  if (curriculum === 'QARI' || curriculum === 'منهج قارئ') return CurriculumType.QARI;
  if (curriculum === 'BOTH' || curriculum === 'كلاهما' || curriculum === 'تبيان/قارئ') return null;
  return null;
}

function normKey(s: string): string {
  return String(s ?? '')
    .replace(/أ/g, 'ا')
    .replace(/[—–−-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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

/**
 * إجبار مستوى ليتوافق مع منهج الدار.
 * يحوّل القديم القديم ثم يطابق بالكلمات المفتاحية، وإلا أول ورقة مسموحة.
 * O(a) حيث a = عدد الأوراق المسموحة.
 */
export function coerceLevelForCurriculum(level: string, curriculum: string): string {
  const allowed = levelsForCurriculum(curriculum);
  if (!allowed.length) return resolveCanonicalLevel(level);
  const canonical = resolveCanonicalLevel(level);
  if (allowed.includes(canonical)) return canonical;
  const n = normKey(canonical || level);
  const exactish = allowed.find((a) => normKey(a) === n);
  if (exactish) return exactish;
  const keywords = [
    'تمهيدي صباحي',
    'تمهيدي مسائي سنتين',
    'تمهيدي مسائي',
    'ابتدائي أولية سنة ثانية',
    'ابتدائي أولية سنة أولى',
    'ابتدائي سنة ثانية',
    'ابتدائي سنة أولى',
    'روضة مسائي',
    'روضة',
    'تمهيدي',
    'الفصل الثاني',
    'الفصل الأول',
  ];
  for (const kw of keywords) {
    if (n.includes(normKey(kw))) {
      const hit = allowed.find((a) => normKey(a).includes(normKey(kw)));
      if (hit) return hit;
    }
  }
  // أرقام قديمة
  if (/[123]/.test(n)) {
    if (n.includes('3') || n.includes('٢') || n.includes('٣')) {
      const y2 = allowed.find((a) => a.includes('سنة ثانية') && a.includes('الفصل الأول'));
      if (y2) return y2;
    }
    if (n.includes('2') || n.includes('٢')) {
      const s2 = allowed.find((a) => a.includes('الفصل الثاني'));
      if (s2) return s2;
    }
  }
  return allowed[0];
}

/**
 * ترحيل كل الفصول إلى مستوى مسموح لمنهج دارها.
 * O(c · a)
 */
export async function migrateClassLevelsToCanonical(): Promise<number> {
  const classes = await prisma.class.findMany({
    select: { id: true, level: true, darId: true, dar: { select: { curriculum: true } } },
  });
  let updated = 0;
  for (const cls of classes) {
    const curriculum = String(cls.dar?.curriculum || 'BOTH');
    const next = coerceLevelForCurriculum(cls.level, curriculum);
    if (next && next !== cls.level) {
      await prisma.class.update({ where: { id: cls.id }, data: { level: next } });
      updated++;
    }
  }
  return updated;
}
