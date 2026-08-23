export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: Array<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={`tab-scroll flex rounded-xl bg-gray-200 p-1 ${className}`}>
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`min-w-0 flex-1 shrink-0 rounded-lg px-2 py-2.5 text-[10px] font-bold sm:text-[11px] ${
            active === key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
