export function Spinner({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
      <p className="text-sm font-bold text-primary">{label}</p>
    </div>
  );
}
