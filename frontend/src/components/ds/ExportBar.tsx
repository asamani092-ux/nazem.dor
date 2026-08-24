import { IconDownload, IconPrint } from './Icons';

export function ExportBar({
  onExcel,
  onPrint,
  excelLabel = 'تصدير Excel',
  printLabel = 'طباعة',
  disabled,
}: {
  onExcel?: () => void;
  onPrint?: () => void;
  excelLabel?: string;
  printLabel?: string;
  disabled?: boolean;
}) {
  if (!onExcel && !onPrint) return null;
  return (
    <div className="ds-export-bar">
      {onExcel ? (
        <button type="button" className="ds-export-excel" disabled={disabled} onClick={onExcel}>
          <IconDownload />
          {excelLabel}
        </button>
      ) : null}
      {onPrint ? (
        <button type="button" className="ds-export-print" disabled={disabled} onClick={onPrint}>
          <IconPrint />
          {printLabel}
        </button>
      ) : null}
    </div>
  );
}
