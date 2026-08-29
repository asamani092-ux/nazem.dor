import { EntityStatus } from '@prisma/client';
import { computeRates } from './domain.js';
import { prisma } from './prisma.js';
import { getRateWeights } from './settings.js';

export type ArchiveSheet = { name: string; rows: (string | number)[][] };

export type TermArchivePayload = {
  term: {
    id: string;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    archivedAt: string | null;
  };
  sheets: ArchiveSheet[];
};

/**
 * بناء أوراق أرشيف فترة دراسية (عامة + ورقة لكل دار).
 * Time O(T + D·C)، Space O(T) حيث T=سجلات الرصد.
 */
export async function buildTermArchiveSheets(termId: string): Promise<TermArchivePayload> {
  const term = await prisma.academicTerm.findUnique({ where: { id: termId } });
  if (!term) {
    throw new Error('TERM_NOT_FOUND');
  }

  const weights = await getRateWeights();
  const dars = await prisma.dar.findMany({
    where: { status: { not: EntityStatus.DELETED } },
    orderBy: { createdAt: 'asc' },
    include: {
      classes: { where: { status: EntityStatus.ACTIVE }, orderBy: { name: 'asc' } },
    },
  });

  const allTrackings = await prisma.dailyTracking.findMany({
    where: { termId },
    select: { darId: true, classId: true, attendance: true, educational: true, homework: true },
  });

  const studentCounts = await prisma.student.groupBy({
    by: ['darId', 'classId'],
    where: { status: EntityStatus.ACTIVE },
    _count: { _all: true },
  });
  const studentCountMap = new Map(studentCounts.map((s) => [`${s.darId}:${s.classId}`, s._count._all]));

  const overallRates = computeRates(allTrackings, weights);
  const closeLabel = term.archivedAt
    ? term.archivedAt.toLocaleDateString('en-GB')
    : '— (لم يُغلق بعد)';

  const generalRows: (string | number)[][] = [
    ['المؤشر', 'القيمة'],
    ['اسم الفصل', term.name],
    ['الحالة', term.status === 'ACTIVE' ? 'نشط' : 'مؤرشف'],
    ['تاريخ البدء', term.startsAt.toLocaleDateString('en-GB')],
    ['تاريخ الإغلاق', closeLabel],
    ['عدد الدور', dars.length],
    ['عدد الفصول النشطة', dars.reduce((n, d) => n + d.classes.length, 0)],
    ['عدد الطالبات النشطات', studentCounts.reduce((n, s) => n + s._count._all, 0)],
    ['نسبة الحضور %', overallRates.attendanceRate],
    ['نسبة الإتقان %', overallRates.completionRate],
    ['نسبة الواجب %', overallRates.homeworkRate],
    ['المعدل العام %', overallRates.overallRate],
    ['سجلات الرصد', overallRates.totalRecords],
  ];

  const darSheets = dars.map((dar) => {
    const darTrackings = allTrackings.filter((t) => t.darId === dar.id);
    const darRates = computeRates(darTrackings, weights);
    const rows: (string | number)[][] = [
      ['الفصل', 'عدد الطالبات', 'نسبة الحضور %', 'نسبة الإتقان %', 'نسبة الواجب %', 'المعدل العام %', 'سجلات الرصد'],
    ];
    for (const cls of dar.classes) {
      const classRows = darTrackings.filter((t) => t.classId === cls.id);
      const classRates = computeRates(classRows, weights);
      rows.push([
        cls.name,
        studentCountMap.get(`${dar.id}:${cls.id}`) || 0,
        classRates.attendanceRate,
        classRates.completionRate,
        classRates.homeworkRate,
        classRates.overallRate,
        classRates.totalRecords,
      ]);
    }
    rows.push([
      'إجمالي الدار',
      dar.classes.reduce((n, c) => n + (studentCountMap.get(`${dar.id}:${c.id}`) || 0), 0),
      darRates.attendanceRate,
      darRates.completionRate,
      darRates.homeworkRate,
      darRates.overallRate,
      darRates.totalRecords,
    ]);
    return {
      name: dar.name.slice(0, 31),
      rows,
    };
  });

  return {
    term: {
      id: term.id,
      name: term.name,
      status: term.status,
      startsAt: term.startsAt.toISOString(),
      endsAt: term.endsAt?.toISOString() || null,
      archivedAt: term.archivedAt?.toISOString() || null,
    },
    sheets: [{ name: 'الإحصائيات العامة', rows: generalRows }, ...darSheets],
  };
}
