export const STATUS: Record<string, { label: string; tone: string }> = {
  placed: { label: "Scheduled", tone: "bg-amber-soft text-ink" },
  shopping: { label: "Cody is shopping", tone: "bg-shell text-white" },
  delivering: { label: "On the way", tone: "bg-shell text-white" },
  delivered: { label: "Delivered", tone: "bg-line text-ink" },
  canceled: { label: "Canceled", tone: "bg-line text-muted" },
};
