import * as XLSX from 'xlsx';

export type ExportSheet = { name: string; rows: Record<string, unknown>[] };

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
