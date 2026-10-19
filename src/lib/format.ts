import { TIMEZONE } from "@/lib/schedule";

export const formatDate = (date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

export const formatTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE }).replace(":00", "");

/** "10:00:00" → "10am" */
export const clockLabel = (t: string | null | undefined) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hh = h % 12 || 12;
  return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
};
