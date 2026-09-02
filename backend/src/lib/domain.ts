import { leafLevelsForCurriculum, resolveCanonicalLevel } from './curriculum-tree.js';

/** مستويات الصف (الأوراق) حسب نوع منهج الدار — مشتقة من المشجّرة */
export const LEVELS_BY_CURRICULUM: Record<string, string[]> = {
  TIBYAN: leafLevelsForCurriculum('TIBYAN'),
  QARI: leafLevelsForCurriculum('QARI'),
  BOTH: leafLevelsForCurriculum('BOTH'),
  'منهج تبيان': leafLevelsForCurriculum('TIBYAN'),
  'منهج قارئ': leafLevelsForCurriculum('QARI'),
  كلاهما: leafLevelsForCurriculum('BOTH'),
  'تبيان/قارئ': leafLevelsForCurriculum('BOTH'),
};

export function levelsForCurriculum(curriculum: string): string[] {
  return LEVELS_BY_CURRICULUM[curriculum] || LEVELS_BY_CURRICULUM.BOTH;
}

export function isLevelAllowed(curriculum: string, level: string): boolean {
  const canonical = resolveCanonicalLevel(level);
  return levelsForCurriculum(curriculum).includes(canonical);
}

export { resolveCanonicalLevel };

/** أرقام الواجب بدون كسر زائد (5.0 → 5). النصوص تبقى كما هي. O(1) زمن/مكان */
export function normalizeHomework(value: string): string {
  const t = String(value ?? '').trim();
  if (!t) return t;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return t;
  const n = Number(t);
  if (!Number.isFinite(n)) return t;
  return Number.isInteger(n) ? String(n) : String(n);
}

export type RateWeights = {
  attendance: number;
  completion: number;
  homework: number;
};

export const DEFAULT_RATE_WEIGHTS: RateWeights = {
  attendance: 40,
  completion: 30,
  homework: 30,
};

export function normalizeWeights(w: Partial<RateWeights> | null | undefined): RateWeights {
  const attendance = Math.max(0, Math.round(Number(w?.attendance) || 0));
  const completion = Math.max(0, Math.round(Number(w?.completion) || 0));
  const homework = Math.max(0, Math.round(Number(w?.homework) || 0));
  const sum = attendance + completion + homework;
  if (sum !== 100) {
    return { ...DEFAULT_RATE_WEIGHTS };
  }
  return { attendance, completion, homework };
}

export type TrackingRates = {
  attendanceRate: number;
  completionRate: number;
  homeworkRate: number;
  overallRate: number;
  totalRecords: number;
};

/**
 * نسب الرصد اليومي.
 * O(n) زمن، O(1) مكان.
 * overallRate = حضور*wA + إتقان*wC + واجب*wH (أوزان من إعدادات مدير النظام).
 */
export function computeRates(
  rows: Array<{ attendance: string; educational: string; homework: string }>,
  weights: RateWeights = DEFAULT_RATE_WEIGHTS,
): TrackingRates {
  const totalRecords = rows.length;
  if (!totalRecords) {
    return { attendanceRate: 0, completionRate: 0, homeworkRate: 0, overallRate: 0, totalRecords: 0 };
  }
  const w = normalizeWeights(weights);
  const attendanceCount = rows.filter((t) => t.attendance === 'حاضرة').length;
  const completionCount = rows.filter((t) => t.educational === 'أتقنت').length;
  const homeworkCount = rows.filter((t) => t.homework === 'أنجزت').length;
  const attendanceRate = Math.round((attendanceCount / totalRecords) * 100);
  const completionRate = Math.round((completionCount / totalRecords) * 100);
  const homeworkRate = Math.round((homeworkCount / totalRecords) * 100);
  const overallRate = Math.round(
    (attendanceRate * w.attendance + completionRate * w.completion + homeworkRate * w.homework) / 100,
  );
  return { attendanceRate, completionRate, homeworkRate, overallRate, totalRecords };
}

export type ExamStats = {
  examAvg: number;
  examsGradedCount: number;
  examsCount: number;
};

/** متوسط درجات الاختبارات الرقمية فقط. O(n) زمن، O(1) مكان. */
export function computeExamStats(
  grades: Array<{ score: string }>,
  publishedExamsCount = 0,
): ExamStats {
  let sum = 0;
  let n = 0;
  for (const g of grades) {
    const v = parseFloat(String(g.score));
    if (!Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return {
    examAvg: n ? Math.round(sum / n) : 0,
    examsGradedCount: n,
    examsCount: publishedExamsCount,
  };
}
