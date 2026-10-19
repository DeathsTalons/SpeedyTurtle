import { formatTime } from "@/lib/format";
import type { Availability } from "@/lib/data";

/** "Cody's out shopping now" banner for customers. Server component. */
export function AvailableBanner({ a }: { a: Availability }) {
  if (!a.open || !a.until) return null;
  return (
    <div className="rounded-3xl bg-shell text-white p-4 mb-5 flex items-center gap-3" role="status">
      <span className="w-3 h-3 rounded-full bg-amber shrink-0 animate-pulse" aria-hidden />
      <p><b>Cody is out shopping now.</b> Order by {formatTime(a.until)} for delivery today. Pick &ldquo;ASAP&rdquo; at checkout.</p>
    </div>
  );
}
