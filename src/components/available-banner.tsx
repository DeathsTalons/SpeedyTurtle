import { formatTime } from "@/lib/format";
import { asapOpenFor, type Availability } from "@/lib/data";
import { AREA_LABEL, type Area } from "@/lib/areas";

/**
 * "I'm out shopping now" banner. Server component.
 * With `area` (a signed-in customer): shown only if Cody is available in their area.
 * Without (visitors on the home page): shown with the area named, so others know it isn't theirs.
 */
export function AvailableBanner({ a, area }: { a: Availability; area?: Area }) {
  if (!a.open || !a.until) return null;
  if (area && !asapOpenFor(a, area)) return null;
  const where = a.area ? AREA_LABEL[a.area] : null;
  return (
    <div className="rounded-3xl bg-shell text-white p-4 mb-5 flex items-center gap-3" role="status">
      <span className="w-3 h-3 rounded-full bg-amber shrink-0 animate-pulse" aria-hidden />
      <p>
        <b>I&apos;m out shopping{where ? ` in ${where}` : ""} now.</b> Order by {formatTime(a.until)} for delivery today. Pick &ldquo;ASAP&rdquo; at checkout.
        {where && !area && <> (Same-day is for the {where} area only.)</>}
      </p>
    </div>
  );
}
