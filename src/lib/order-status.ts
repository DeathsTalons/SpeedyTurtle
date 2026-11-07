export const STATUS: Record<string, { label: string; tone: string }> = {
  placed: { label: "Scheduled", tone: "bg-amber-soft text-ink" },
  shopping: { label: "Shopping now", tone: "bg-shell text-white" },
  delivering: { label: "On the way", tone: "bg-shell text-white" },
  delivered: { label: "Delivered", tone: "bg-line text-ink" },
  canceled: { label: "Canceled", tone: "bg-line text-muted" },
};

/** Card payment state, as Cody sees it. */
export const PAYMENT: Record<string, { label: string; tone: string }> = {
  none: { label: "No card (test mode)", tone: "text-muted" },
  card_saved: { label: "Card saved", tone: "text-muted" },
  authorized: { label: "Hold placed", tone: "text-shell" },
  captured: { label: "Charged", tone: "text-shell" },
  failed: { label: "Card declined", tone: "text-danger" },
  canceled: { label: "Hold released", tone: "text-muted" },
};
