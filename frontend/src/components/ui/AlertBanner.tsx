export function AlertBanner({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="mx-4 mt-4 whitespace-pre-wrap rounded-xl border border-primary-soft bg-white p-3 text-sm font-bold text-primary shadow-sm sm:mx-6">
      {message}
      {onClose ? (
        <button type="button" className="mr-3 text-xs text-ios-muted" onClick={onClose}>
          إغلاق
        </button>
      ) : null}
    </div>
  );
}
