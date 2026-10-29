import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

export function LocalClock({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const formatters = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
      date: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      zone: new Intl.DateTimeFormat(locale, { timeZoneName: "short" }),
    }),
    [locale],
  );

  const time = formatters.time.format(now);
  const date = formatters.date.format(now);
  const zone =
    formatters.zone
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? "";

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/70 px-4 py-3 shadow-xs/5 backdrop-blur-sm",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-10 size-28 rounded-full bg-info/10 blur-2xl"
      />
      <div className="relative flex items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 opacity-70 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-success" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-3" />
            {t("unified:clock.localTime")}
          </p>
          <p className="font-mono text-2xl font-semibold leading-tight tracking-tight tabular-nums text-foreground">
            {time}
          </p>
          <p className="truncate text-[0.625rem] text-muted-foreground">
            {date}
            {zone ? ` · ${zone}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export default LocalClock;
