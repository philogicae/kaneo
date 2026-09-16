import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type Appointment from "@/types/appointment";
import {
  appointmentsForDay,
  buildWeekDays,
  HOUR_HEIGHT,
  HOURS,
  isSameDay,
} from "./week-model";

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type WeekCalendarProps = {
  appointments: Appointment[] | undefined;
  weekStart: Date;
  onSelectAppointment: (appointment: Appointment) => void;
  onCreateAt: (start: Date) => void;
};

// A minute tick keeps the current-time cursor honest without re-rendering
// every second.
function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

export default function WeekCalendar({
  appointments,
  weekStart,
  onSelectAppointment,
  onCreateAt,
}: WeekCalendarProps) {
  const { t } = useTranslation();
  const now = useNow();
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = buildWeekDays(weekStart);

  // Open on the working day, not at midnight; the grid stays scrollable.
  // The header is sticky inside the scroll container, so hour 7 lands just
  // below it instead of underneath it.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  const handleColumnClick = (
    day: Date,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - bounds.top;
    const hour = Math.min(23, Math.max(0, Math.floor(offsetY / HOUR_HEIGHT)));
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    onCreateAt(start);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The header lives inside the scroll container so its day columns and
          the body's day columns share the same width (a scrollbar on the body
          alone would shift the columns out of alignment). */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col">
          <div className="sticky top-0 z-30 flex border-b border-border/80 bg-card">
            <div className="w-14 shrink-0" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex-1 border-l border-border/60 px-1 py-1.5 text-center",
                  isSameDay(day, now) && "bg-accent/40",
                )}
              >
                <p className="text-[10px] uppercase text-muted-foreground">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isSameDay(day, now) && "text-foreground",
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="w-14 shrink-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-1.5 right-2 text-[10px] text-muted-foreground tabular-nums">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const items = appointmentsForDay(appointments, day);
              const showNowLine = isSameDay(day, now);
              const nowTop =
                ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: click-to-create is a mouse shortcut; the New appointment button covers keyboard use
                // biome-ignore lint/a11y/useKeyWithClickEvents: click-to-create is a mouse shortcut; the New appointment button covers keyboard use
                <div
                  key={day.toISOString()}
                  className="relative flex-1 border-l border-border/60"
                  style={{ height: 24 * HOUR_HEIGHT }}
                  onClick={(event) => handleColumnClick(day, event)}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border/40"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {showNowLine && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10"
                      style={{ top: nowTop }}
                    >
                      <div className="relative h-px bg-destructive">
                        <span className="absolute -top-2 right-1 rounded bg-destructive px-1 text-[9px] font-medium text-white tabular-nums">
                          {formatTime(now)}
                        </span>
                      </div>
                    </div>
                  )}

                  {items.map(({ appointment, top, height }) => (
                    <button
                      key={`${appointment.id}-${day.toISOString()}`}
                      type="button"
                      className="absolute inset-x-1 z-20 overflow-hidden rounded-md border border-info/40 bg-info/15 px-1.5 py-0.5 text-left transition-colors hover:bg-info/25"
                      style={{ top, height }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectAppointment(appointment);
                      }}
                      title={appointment.title}
                    >
                      <span className="block truncate text-[10px] font-medium text-foreground">
                        {appointment.title}
                      </span>
                      <span className="block truncate text-[9px] text-muted-foreground tabular-nums">
                        {appointment.startDate
                          ? formatTime(new Date(appointment.startDate))
                          : ""}
                        {appointment.dueDate &&
                        appointment.dueDate !== appointment.startDate
                          ? ` – ${formatTime(new Date(appointment.dueDate))}`
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        {t("appointments:weekHint")}
      </p>
    </div>
  );
}
