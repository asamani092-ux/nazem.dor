export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const LEVELS_BY_CURRICULUM: Record<string, string[]> = {
  TIBYAN: ['تمهيدي 1', 'تمهيدي 2'],
  QARI: ['صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
  BOTH: ['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
  'منهج تبيان': ['تمهيدي 1', 'تمهيدي 2'],
  'منهج قارئ': ['صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
  كلاهما: ['تمهيدي 1', 'تمهيدي 2', 'صفوف أولية 1', 'صفوف أولية 2', 'صفوف أولية 3'],
};
