import type { Alert, Exam } from '@prisma/client';

export type CalendarEventDto = {
  id: string;
  type: 'visit' | 'exam' | 'notice';
  title: string;
  scheduledAt: string;
  darId: string | null;
  darName?: string;
  content?: string;
  link?: string;
  kind?: string;
  isRead?: boolean;
};

export function alertToEvent(a: Alert, darName?: string, isRead?: boolean): CalendarEventDto | null {
  if (a.kind === 'VISIT') {
    if (!a.scheduledAt) return null;
    return {
      id: a.id,
      type: 'visit',
      title: a.title,
      scheduledAt: a.scheduledAt.toISOString(),
      darId: a.darId,
      darName,
      content: a.content,
      kind: a.kind,
      isRead,
    };
  }
  return {
    id: a.id,
    type: 'notice',
    title: a.title,
    scheduledAt: a.createdAt.toISOString(),
    darId: a.darId,
    darName,
    content: a.content,
    kind: a.kind,
    isRead,
  };
}

export function examToEvent(e: Exam, darName?: string, isRead?: boolean): CalendarEventDto {
  return {
    id: e.id,
    type: 'exam',
    title: e.title,
    scheduledAt: e.examDate.toISOString(),
    darId: e.darId,
    darName: darName || (e.darId ? undefined : 'كل الدور'),
    link: e.link,
    content: e.notes || '',
    isRead,
  };
}

function parseLocalDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) throw new Error('invalid_range');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error('invalid_range');
  return new Date(y, mo - 1, d);
}

/** يدعم YYYY-MM-DD أو ISO — بداية/نهاية اليوم محلياً */
export function parseDateRange(from: string, to: string) {
  const start = parseLocalDateOnly(from);
  start.setHours(0, 0, 0, 0);
  const end = parseLocalDateOnly(to);
  end.setHours(23, 59, 59, 999);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('invalid_range');
  }
  return { start, end };
}

export function parseScheduledDate(value: string): Date {
  const day = parseLocalDateOnly(value);
  day.setHours(12, 0, 0, 0);
  return day;
}
