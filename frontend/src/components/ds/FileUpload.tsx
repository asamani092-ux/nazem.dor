import { useRef, type ChangeEvent } from 'react';

export function FileUpload({
  label,
  accept,
  fileName,
  onChange,
}: {
  label?: string;
  accept?: string;
  fileName?: string | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] || null);
  }

  return (
    <div className="ds-file-upload">
      {label ? <span className="ds-file-upload-label">{label}</span> : null}
      <div className="ds-file-upload-row">
        <button type="button" className="ds-file-upload-btn" onClick={() => inputRef.current?.click()}>
          اختيار ملف
        </button>
        <span className="ds-file-upload-name">{fileName || 'لم يُختَر ملف'}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="ds-file-upload-input"
        accept={accept}
        onChange={onFile}
      />
    </div>
  );
}
