/** مستويات الصف حسب نوع منهج الدار */
export const LEVELS_BY_CURRICULUM: Record<string, string[]> = {
  TIBYAN: ['تمهيدي 1', 'تمهيدي 2'],
  QARI: ['صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
  BOTH: ['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
  'منهج تبيان': ['تمهيدي 1', 'تمهيدي 2'],
  'منهج قارئ': ['صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
  كلاهما: ['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
};

export function levelsForCurriculum(curriculum: string): string[] {
  return LEVELS_BY_CURRICULUM[curriculum] || LEVELS_BY_CURRICULUM.BOTH;
}

export function isLevelAllowed(curriculum: string, level: string): boolean {
  return levelsForCurriculum(curriculum).includes(level);
}

export type TrackingRates = {
  attendanceRate: number;
  completionRate: number;
  homeworkRate: number;
  overallRate: number;
  totalRecords: number;
};

export function computeRates(
  rows: Array<{ attendance: string; educational: string; homework: string }>,
): TrackingRates {
  const totalRecords = rows.length;
  if (!totalRecords) {
    return { attendanceRate: 0, completionRate: 0, homeworkRate: 0, overallRate: 0, totalRecords: 0 };
  }
  const attendanceCount = rows.filter((t) => t.attendance === 'حاضرة').length;
  const completionCount = rows.filter((t) => t.educational === 'أتقنت').length;
  const homeworkCount = rows.filter((t) => t.homework === 'أنجزت').length;
  const attendanceRate = Math.round((attendanceCount / totalRecords) * 100);
  const completionRate = Math.round((completionCount / totalRecords) * 100);
  const homeworkRate = Math.round((homeworkCount / totalRecords) * 100);
  const overallRate = Math.round((attendanceRate + completionRate + homeworkRate) / 3);
  return { attendanceRate, completionRate, homeworkRate, overallRate, totalRecords };
}
