import * as XLSX from 'xlsx';

export type ExportSheet = { name: string; rows: Record<string, unknown>[] };

/** Time O(k) per row keys. Space O(k) per row. */
export function mapRowKeys(row: Record<string, unknown>, labels: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, label] of Object.entries(labels)) {
    if (key in row) out[label] = row[key];
  }
  for (const [k, v] of Object.entries(row)) {
    if (!labels[k] && !(labels[k] && k in labels)) {
      const arabic = labels[k];
      if (!arabic) out[k] = v;
    }
  }
  return out;
}

/** Map rows using explicit Arabic column labels. Time O(n*k). */
export function arabicRows(rows: Record<string, unknown>[], labels: Record<string, string>): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [key, label] of Object.entries(labels)) {
      if (key in r) out[label] = r[key];
    }
    return out;
  });
}

/** Time O(n) per sheet. Space O(n) for workbook buffer. */
export function downloadXlsx(filename: string, sheets: ExportSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeName = sheet.name.replace(/[\\/*?:\[\]]/g, '_').slice(0, 31) || 'Sheet';
    const ws = sheet.rows.length
      ? XLSX.utils.json_to_sheet(sheet.rows)
      : XLSX.utils.aoa_to_sheet([['لا توجد بيانات']]);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** تنزيل أوراق بصيغة مصفوفات (رأس + صفوف). Time O(n). */
export function downloadXlsxAoa(filename: string, sheets: Array<{ name: string; rows: (string | number)[][] }>) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeName = sheet.name.replace(/[\\/*?:\[\]]/g, '_').slice(0, 31) || 'Sheet';
    const ws = sheet.rows.length
      ? XLSX.utils.aoa_to_sheet(sheet.rows)
      : XLSX.utils.aoa_to_sheet([['لا توجد بيانات']]);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Download empty template with Arabic headers. */
export function downloadTemplateXlsx(filename: string, headers: string[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, 'نموذج');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Parse first sheet to JSON rows. Time O(n). */
export function parseXlsxFile(file: File): Promise<Record<string, unknown>[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  });
}
