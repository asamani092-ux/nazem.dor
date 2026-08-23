export function TrackToggle({ label, onClick }: { label: string; onClick: () => void }) {
  const positive = ['حاضرة', 'أتقنت', 'أنجزت'].includes(label);
  const negative = ['غائبة', 'لم تتقن', 'لم تنجز', '-'].includes(label);
  const cls = positive ? 'ds-track ds-track-on' : negative ? 'ds-track ds-track-off' : 'ds-track ds-track-neutral';
  return (
    <button type="button" className={cls} onClick={onClick}>
      {label}
    </button>
  );
}

export function DayButton({
  day,
  selected,
  done,
  onClick,
}: {
  day: string;
  selected: boolean;
  done: boolean;
  onClick: () => void;
}) {
  const cls = selected ? 'ds-day ds-day-selected' : done ? 'ds-day ds-day-done' : 'ds-day';
  return (
    <button type="button" className={cls} onClick={onClick}>
      {day}
    </button>
  );
}
