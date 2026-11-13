// Thumbnails of the store receipt photos for an order (signed links made on the server).
export function ReceiptPhotoStrip({ photos, title = "Store receipts" }: { photos: { path: string; chain: string | null; url: string }[]; title?: string }) {
  if (!photos.length) return null;
  return (
    <section className="bg-card border border-line rounded-3xl p-5 space-y-2" aria-labelledby="rcpt-h">
      <h2 id="rcpt-h" className="text-xl font-extrabold">{title}</h2>
      <p className="text-sm text-muted">Photos of the actual receipts, so you can see every price. Tap one to open it full size.</p>
      <ul className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <li key={p.path}>
            <a href={p.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link, not a static asset */}
              <img src={p.url} alt={`${p.chain === "kroger" ? "Kroger" : p.chain === "meijer" ? "Meijer" : "Store"} receipt`}
                className="w-28 h-40 object-cover rounded-xl border border-line" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
