// The one place the "tips are optional" wording lives, so checkout, the welcome screen
// and the after-delivery tip all say the same thing.
export function TipNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted ${className}`}>
      Tips are never required. There&apos;s no app company in the middle taking a cut of your order.
      They&apos;re still appreciated, and every cent goes to Cody.
    </p>
  );
}
