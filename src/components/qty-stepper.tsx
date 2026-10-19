"use client";
export function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border-[1.5px] border-shell bg-card" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} className="w-11 h-11 text-xl font-bold text-shell" aria-label={value === 1 ? `Remove ${label}` : `One fewer ${label}`}>
        {value === 1 ? "×" : "−"}
      </button>
      <span className="min-w-7 text-center font-bold" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="w-11 h-11 text-xl font-bold text-shell" aria-label={`One more ${label}`}>+</button>
    </div>
  );
}
