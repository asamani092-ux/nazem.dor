import { useMemo, useState } from 'react';
import {
  addMonths,
  buildMonthGrid,
  eventsOnDay,
  monthStart,
  type CalendarEvent,
  WEEKDAY_LABELS,
} from '../../lib/calendar';

export function CalendarMonth({
  events,
  month: monthProp,
  onMonthChange,
  onSelectDay,
  onSelectEvent,
}: {
  events: CalendarEvent[];
  month?: Date;
  onMonthChange?: (m: Date) => void;
  onSelectDay?: (day: Date, dayEvents: CalendarEvent[]) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  const [internalMonth, setInternalMonth] = useState(() => monthStart(new Date()));
  const month = monthProp ? monthStart(monthProp) : internalMonth;

  function setMonth(m: Date) {
    const next = monthStart(m);
    if (onMonthChange) onMonthChange(next);
    else setInternalMonth(next);
  }

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const monthLabel = month.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

  return (
    <div className="ds-calendar">
      <div className="ds-calendar-header">
        <button type="button" className="ds-calendar-nav" onClick={() => setMonth(addMonths(month, -1))} aria-label="الشهر السابق">
          ‹
        </button>
        <h3 className="ds-calendar-title">{monthLabel}</h3>
        <button type="button" className="ds-calendar-nav" onClick={() => setMonth(addMonths(month, 1))} aria-label="الشهر التالي">
          ›
        </button>
      </div>
      <div className="ds-calendar-weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="ds-calendar-weekday">{w}</span>
        ))}
      </div>
      <div className="ds-calendar-grid">
        {grid.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const dayEvents = eventsOnDay(events, day);
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`ds-calendar-cell ${inMonth ? '' : 'ds-calendar-cell-out'} ${isToday ? 'ds-calendar-cell-today' : ''}`}
              onClick={() => {
                if (dayEvents.length === 1 && onSelectEvent) onSelectEvent(dayEvents[0]);
                else onSelectDay?.(day, dayEvents);
              }}
            >
              <span className="ds-calendar-day-num">{day.getDate()}</span>
              {dayEvents.length ? (
                <div className="ds-calendar-dots">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`ds-calendar-dot ds-calendar-dot-${e.type}`}
                      title={e.title}
                    />
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
