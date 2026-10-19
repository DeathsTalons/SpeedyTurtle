// Works out which delivery windows customers can book.
// Rules, in order of priority:
//   1. A calendar override for that exact window (e.g. "close Sat afternoon")
//   2. A calendar override for the whole day (e.g. "traveling Oct 20", or "open this Monday")
//   3. The default week (Mon & Tue off)
// Then a window disappears if it's full or too close to its start time.

export const TIMEZONE = "America/Indiana/Indianapolis";

export type SlotTemplate = {
  id: number;
  label: string;
  startTime: string; // "10:00" or "10:00:00"
  endTime: string;
  capacity: number;
  active?: boolean;
};

export type Override = {
  date: string; // "2026-10-20"
  slotTemplateId: number | null; // null = whole day
  isOpen: boolean;
  note?: string | null;
};

export type ScheduleInput = {
  now: Date;
  daysAhead: number;
  cutoffHours: number;
  weekly: Record<number, boolean>; // weekday (0=Sun) → open?
  templates: SlotTemplate[];
  overrides: Override[];
  bookings: { date: string; slotTemplateId: number; count: number }[];
};

export type AvailableSlot = {
  date: string;
  weekday: number;
  slotTemplateId: number;
  label: string;
  startsAt: Date;
  endsAt: Date;
  remaining: number;
};

/** "YYYY-MM-DD" for an instant, as seen on a clock in Indiana. */
export function localDate(d: Date, tz = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Converts a local Indiana date + clock time into a real instant (handles daylight saving). */
export function zonedToInstant(date: string, time: string, tz = TIMEZONE): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return asUtc - ms;
  };
  let ms = guess - offsetAt(guess);
  ms = guess - offsetAt(ms); // second pass settles DST edges
  return new Date(ms);
}

export function isSlotOpen(date: string, slotId: number, input: Pick<ScheduleInput, "weekly" | "overrides">): boolean {
  const exact = input.overrides.find((o) => o.date === date && o.slotTemplateId === slotId);
  if (exact) return exact.isOpen;
  const day = input.overrides.find((o) => o.date === date && o.slotTemplateId === null);
  if (day) return day.isOpen;
  return input.weekly[weekdayOf(date)] ?? false;
}

export function availableSlots(input: ScheduleInput): AvailableSlot[] {
  const today = localDate(input.now);
  const cutoffMs = input.cutoffHours * 3_600_000;
  const templates = input.templates.filter((t) => t.active !== false);
  const out: AvailableSlot[] = [];

  for (let i = 0; i <= input.daysAhead; i++) {
    const date = addDays(today, i);
    for (const t of templates) {
      if (!isSlotOpen(date, t.id, input)) continue;
      const startsAt = zonedToInstant(date, t.startTime);
      if (startsAt.getTime() - input.now.getTime() < cutoffMs) continue;
      const booked = input.bookings.find((b) => b.date === date && b.slotTemplateId === t.id)?.count ?? 0;
      const remaining = t.capacity - booked;
      if (remaining <= 0) continue;
      out.push({
        date, weekday: weekdayOf(date), slotTemplateId: t.id, label: t.label,
        startsAt, endsAt: zonedToInstant(date, t.endTime), remaining,
      });
    }
  }
  return out;
}

/** For Cody's calendar screen: every day in a range, with each window's open/closed state and why. */
export function calendarView(
  from: string,
  days: number,
  input: Pick<ScheduleInput, "weekly" | "overrides" | "templates">,
) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const dayOverride = input.overrides.find((o) => o.date === date && o.slotTemplateId === null);
    return {
      date,
      weekday: weekdayOf(date),
      note: dayOverride?.note ?? null,
      slots: input.templates.map((t) => {
        const exact = input.overrides.find((o) => o.date === date && o.slotTemplateId === t.id);
        return {
          slotTemplateId: t.id,
          label: t.label,
          open: isSlotOpen(date, t.id, input),
          source: exact ? "slot override" : dayOverride ? "day override" : "default week",
        };
      }),
    };
  });
}
