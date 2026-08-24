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

export function parseDateRange(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('invalid_range');
  }
  return { start, end };
}
