function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printPrimary(): string {
  if (typeof document === 'undefined') return '#7F4BA9';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  return v || '#7F4BA9';
}

function buildPrintHtml(title: string, bodyHtml: string, primary: string): string {
  const date = new Date().toLocaleDateString('ar-SA');
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { width: 100%; }
  body {
    font-family: Tajawal, sans-serif;
    direction: rtl;
    text-align: right;
    padding: 24px;
    color: #1c1c1e;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { color: ${primary}; font-size: 22px; margin: 0 0 4px; }
  .meta { color: #8e8e93; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 15px; margin: 20px 0 8px; color: #3a3a3c; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; table-layout: fixed; }
  th, td {
    border: 1px solid #e5e5ea;
    padding: 8px 12px;
    text-align: right;
    font-size: 12px;
    vertical-align: top;
    word-wrap: break-word;
  }
  thead tr { background: #f2f2f7; }
  th { font-weight: 800; color: #3a3a3c; }
  @media print {
    body { padding: 12px; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">ناظم الصغار — ${escapeHtml(date)}</div>
  ${bodyHtml}
</body>
</html>`;
}

/** Time O(1). Space O(n) for HTML string length. */
export function printReport(title: string, bodyHtml: string) {
  const primary = printPrimary();
  const html = buildPrintHtml(title, bodyHtml, primary);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    const win = iframe.contentWindow;
    try {
      win?.focus();
      win?.print();
    } catch {
      openPrintWindow(html);
    }
    window.setTimeout(() => iframe.remove(), 60000);
  };

  iframe.onload = () => window.setTimeout(triggerPrint, 350);
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    openPrintWindow(html);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // احتياط: إن لم يُطلق onload (بعض المتصفحات مع document.write) اطبع بعد مهلة
  window.setTimeout(triggerPrint, 800);
}

/** احتياطي: نافذة طباعة منفصلة عند تعذّر الطباعة من iframe. */
function openPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      /* ignore */
    }
  }, 400);
}

export function tableHtml(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
