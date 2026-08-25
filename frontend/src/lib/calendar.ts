export type CalendarEvent = {
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

export function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** YYYY-MM-DD بالتوقيت المحلي — بدون انزياح UTC */
export function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthRangeParams(month: Date): { from: string; to: string } {
  return {
    from: formatDateParam(monthStart(month)),
    to: formatDateParam(monthEnd(month)),
  };
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStr = formatDateParam(day);
  return events.filter((e) => formatDateParam(new Date(e.scheduledAt)) === dayStr);
}

export function buildMonthGrid(month: Date): Date[] {
  const start = monthStart(month);
  const end = monthEnd(month);
  const grid: Date[] = [];
  const pad = start.getDay();
  for (let i = pad; i > 0; i--) {
    grid.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() - i));
  }
  for (let d = 1; d <= end.getDate(); d++) {
    grid.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (grid.length % 7 !== 0) {
    const last = grid[grid.length - 1];
    grid.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return grid;
}

export const WEEKDAY_LABELS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
