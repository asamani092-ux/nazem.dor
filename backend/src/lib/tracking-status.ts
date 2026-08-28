import { EntityStatus } from '@prisma/client';
import { prisma } from './prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function periodSince(period: '7d' | '30d' | 'all'): Date | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : 30;
  return new Date(Date.now() - days * DAY_MS);
}

export function relativeActivityAr(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return 'لا يوجد';
  const t = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(t.getTime())) return 'لا يوجد';
  const diffMs = Date.now() - t.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days < 30) return `منذ ${days} أيام`;
  return t.toLocaleDateString('en-GB');
}

export type DarTrackingSummary = {
  classesCount: number;
  trackedClassesCount: number;
  lastActivityAt: string | null;
  lastActivityLabel: string;
  trackingBadge: 'empty' | 'partial' | 'complete';
};

/**
 * Per-dar tracking completion for last 7 days.
 * Time O(c + t) over classes and recent trackings; Space O(c).
 */
export async function buildDarTrackingSummaries(
  darIds: string[],
  windowDays = 7,
  termId?: string,
): Promise<Map<string, DarTrackingSummary>> {
  const map = new Map<string, DarTrackingSummary>();
  if (!darIds.length) return map;

  const since = new Date(Date.now() - windowDays * DAY_MS);
  const classes = await prisma.class.findMany({
    where: { darId: { in: darIds }, status: EntityStatus.ACTIVE },
    select: { id: true, darId: true },
  });

  const classIdsByDar = new Map<string, string[]>();
  for (const id of darIds) classIdsByDar.set(id, []);
  for (const c of classes) {
    classIdsByDar.get(c.darId)?.push(c.id);
  }

  const classIds = classes.map((c) => c.id);
  const recent =
    classIds.length === 0
      ? []
      : await prisma.dailyTracking.findMany({
          where: {
            classId: { in: classIds },
            updatedAt: { gte: since },
            ...(termId ? { termId } : {}),
          },
          select: { darId: true, classId: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        });

  const trackedClassByDar = new Map<string, Set<string>>();
  const lastAtByDar = new Map<string, Date>();
  for (const row of recent) {
    if (!trackedClassByDar.has(row.darId)) trackedClassByDar.set(row.darId, new Set());
    trackedClassByDar.get(row.darId)!.add(row.classId);
    const prev = lastAtByDar.get(row.darId);
    if (!prev || row.updatedAt > prev) lastAtByDar.set(row.darId, row.updatedAt);
  }

  // Any-time last activity for label when none in window
  const anyLast =
    classIds.length === 0
      ? []
      : await prisma.dailyTracking.groupBy({
          by: ['darId'],
          where: { classId: { in: classIds }, ...(termId ? { termId } : {}) },
          _max: { updatedAt: true },
        });
  for (const row of anyLast) {
    if (row._max.updatedAt && !lastAtByDar.has(row.darId)) {
      lastAtByDar.set(row.darId, row._max.updatedAt);
    }
  }

  for (const darId of darIds) {
    const n = classIdsByDar.get(darId)?.length || 0;
    const k = trackedClassByDar.get(darId)?.size || 0;
    const last = lastAtByDar.get(darId) || null;
    let trackingBadge: DarTrackingSummary['trackingBadge'] = 'empty';
    if (n > 0 && k >= n) trackingBadge = 'complete';
    else if (k > 0) trackingBadge = 'partial';
    map.set(darId, {
      classesCount: n,
      trackedClassesCount: k,
      lastActivityAt: last ? last.toISOString() : null,
      lastActivityLabel: relativeActivityAr(last),
      trackingBadge,
    });
  }
  return map;
}

export type ClassTrackingInfo = {
  lastTrackingAt: string | null;
  lastTrackingLabel: string;
  trackedInLast7Days: boolean;
};

/** Time O(t) recent rows; Space O(c). */
export async function buildClassTrackingInfo(
  classIds: string[],
  windowDays = 7,
  termId?: string,
): Promise<Map<string, ClassTrackingInfo>> {
  const map = new Map<string, ClassTrackingInfo>();
  for (const id of classIds) {
    map.set(id, { lastTrackingAt: null, lastTrackingLabel: 'لم يُرصد بعد', trackedInLast7Days: false });
  }
  if (!classIds.length) return map;

  const since = new Date(Date.now() - windowDays * DAY_MS);
  const termFilter = termId ? { termId } : {};
  const latestGroups = await prisma.dailyTracking.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, ...termFilter },
    _max: { updatedAt: true },
  });
  const latestRows =
    latestGroups.length === 0
      ? []
      : await prisma.dailyTracking.findMany({
          where: {
            OR: latestGroups.map((g) => ({
              classId: g.classId,
              updatedAt: g._max.updatedAt || undefined,
            })),
          },
          select: { classId: true, updatedAt: true, week: true, day: true, dateStr: true },
        });
  const seen = new Set<string>();
  for (const row of latestRows) {
    if (seen.has(row.classId)) continue;
    seen.add(row.classId);
    const inWindow = row.updatedAt >= since;
    map.set(row.classId, {
      lastTrackingAt: row.updatedAt.toISOString(),
      lastTrackingLabel: `آخر رصد: ${row.day} · أسبوع ${row.week} · ${row.dateStr || row.updatedAt.toLocaleDateString('en-GB')}`,
      trackedInLast7Days: inWindow,
    });
  }
  return map;
}
