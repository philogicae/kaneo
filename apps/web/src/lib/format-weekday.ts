// 2026-10-04 is a Sunday, so adding a weekday number gives that weekday.
const SUNDAY = Date.UTC(2026, 9, 4);

export function formatWeekday(
  day: number,
  locale: string,
  width: "long" | "short" | "narrow" = "long",
) {
  return new Intl.DateTimeFormat(locale, {
    weekday: width,
    timeZone: "UTC",
  }).format(new Date(SUNDAY + day * 86_400_000));
}
