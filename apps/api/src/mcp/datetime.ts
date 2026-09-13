// MCP input normalization for date-time arguments. The REST API stores
// instants (UTC) and its MCP schemas require an explicit offset, but agents
// often get a wall-clock time from the user ("remind me at 14:00") without a
// timezone. These helpers convert such local times with an explicit IANA
// timezone and reject anything ambiguous.

const OFFSET_SUFFIX = /(?:z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

const INVALID_DATE_HINT =
  "Use ISO 8601, e.g. 2026-09-14T14:00:00+03:00, or a local time plus `timezone`.";

function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error(
      `Invalid timezone "${timeZone}". Use an IANA name like Europe/Bucharest.`,
    );
  }
}

function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  // Some engines report midnight as hour 24 with hour12: false.
  const hour = values.hour === 24 ? 0 : (values.hour ?? 0);
  const asUtc = Date.UTC(
    values.year ?? 0,
    (values.month ?? 1) - 1,
    values.day ?? 1,
    hour,
    values.minute ?? 0,
    values.second ?? 0,
  );
  return asUtc - instant;
}

export function resolveDateTimeInput(
  value: string | null | undefined,
  timeZone?: string,
): string | null | undefined {
  if (value === null || value === undefined) return value;
  const trimmed = value.trim();

  if (trimmed === "") {
    throw new Error(`Date value cannot be empty. ${INVALID_DATE_HINT}`);
  }

  // An explicit offset (Z or ±HH:MM) is already an unambiguous instant.
  if (OFFSET_SUFFIX.test(trimmed)) {
    if (Number.isNaN(new Date(trimmed).getTime())) {
      throw new Error(`Invalid date "${value}". ${INVALID_DATE_HINT}`);
    }
    return trimmed;
  }

  const local = LOCAL_DATE_TIME.exec(trimmed);
  if (!local) {
    throw new Error(`Invalid date "${value}". ${INVALID_DATE_HINT}`);
  }

  if (!timeZone) {
    throw new Error(
      `Date "${value}" has no UTC offset. Ask the user for their timezone and pass it as \`timezone\` (IANA, e.g. Europe/Bucharest), or send the date with an explicit offset.`,
    );
  }
  assertTimeZone(timeZone);

  const [, year, month, day, hour, minute, second] = local;
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
  );

  // Reject impossible wall-clock values (Date.UTC silently rolls over).
  const check = new Date(wallClockAsUtc);
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() !== Number(month) - 1 ||
    check.getUTCDate() !== Number(day) ||
    check.getUTCHours() !== Number(hour) ||
    check.getUTCMinutes() !== Number(minute)
  ) {
    throw new Error(`Invalid date "${value}". ${INVALID_DATE_HINT}`);
  }

  // Two passes settle the offset even when the first guess crosses a DST
  // transition (the offset at the guessed instant may differ from the one at
  // the resolved instant).
  let instant = wallClockAsUtc - timeZoneOffsetMs(wallClockAsUtc, timeZone);
  instant = wallClockAsUtc - timeZoneOffsetMs(instant, timeZone);

  return new Date(instant).toISOString();
}
