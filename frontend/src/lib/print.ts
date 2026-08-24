export function printReport(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  const date = new Date().toLocaleDateString('ar-SA');
  w.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: Tajawal, sans-serif; direction: rtl; text-align: right; padding: 24px; color: #1c1c1e; margin: 0; }
  h1 { color: var(--print-primary, #7F4BA9); font-size: 22px; margin: 0 0 4px; }
  .meta { color: #8e8e93; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 15px; margin: 20px 0 8px; color: #3a3a3c; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #e5e5ea; padding: 8px 12px; text-align: right; font-size: 12px; vertical-align: top; }
  thead tr { background: #f2f2f7; }
  th { font-weight: 800; color: #3a3a3c; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">ناظم الصغار — ${date}</div>
  ${bodyHtml}
</body>
</html>`);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    w.print();
  }, 400);
}

export function tableHtml(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${h}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
