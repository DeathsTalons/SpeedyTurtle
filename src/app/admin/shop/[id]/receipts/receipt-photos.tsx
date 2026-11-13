"use client";
// Snap photos of the paper store receipts for one order. Resized on the phone before upload.
import { useRef, useState, useTransition } from "react";
import { deleteReceiptPhoto, uploadReceiptPhoto } from "../../../actions";

export type PhotoView = { path: string; chain: "kroger" | "meijer" | null; at: string; url: string };

/** Shrink a phone photo to at most `max` px on the long side, as a JPEG (receipts stay readable at 1600px). */
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't read that photo."))), "image/jpeg", 0.82));
}

export function ReceiptPhotos({ orderId, chains, initial }: { orderId: string; chains: ("kroger" | "meijer")[]; initial: PhotoView[] }) {
  const [photos, setPhotos] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [chain, setChain] = useState<"kroger" | "meijer" | null>(chains.length === 1 ? chains[0] : null);

  const pick = (c: "kroger" | "meijer" | null) => { setChain(c); input.current?.click(); };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError("");
    start(async () => {
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set("orderId", orderId);
        if (chain) fd.set("chain", chain);
        fd.set("photo", new File([blob], "receipt.jpg", { type: "image/jpeg" }));
        const r = await uploadReceiptPhoto(fd);
        if (r.error) setError(r.error);
        else if (r.photos) setPhotos(r.photos);
      } catch (e) {
        setError((e as Error).message || "Upload failed. Try again.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  };

  const remove = (path: string) => {
    if (!window.confirm("Remove this receipt photo?")) return;
    start(async () => { const r = await deleteReceiptPhoto(orderId, path); setPhotos(r.photos); });
  };

  const label = (c: "kroger" | "meijer") => (c === "kroger" ? "Kroger" : "Meijer");

  return (
    <div className="space-y-2">
      <p className="label !mb-0">Receipt photos</p>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.path} className="relative">
              <a href={p.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link, not a static asset */}
                <img src={p.url} alt={`${p.chain ? label(p.chain) + " " : ""}receipt photo`} className="w-20 h-28 object-cover rounded-xl border border-line" />
              </a>
              {p.chain && <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-white/90 rounded px-1">{label(p.chain)}</span>}
              <button type="button" onClick={() => remove(p.path)} disabled={pending} aria-label="Remove photo"
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border border-line font-bold leading-none">×</button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        {chains.length > 1
          ? chains.map((c) => (
              <button key={c} type="button" className="btn btn-ghost !min-h-10" disabled={pending} onClick={() => pick(c)}>
                {pending && chain === c ? "Uploading…" : `Snap ${label(c)} receipt`}
              </button>
            ))
          : <button type="button" className="btn btn-ghost !min-h-10" disabled={pending} onClick={() => pick(chains[0] ?? null)}>
              {pending ? "Uploading…" : photos.length ? "Add another photo" : "Snap receipt photo"}
            </button>}
      </div>
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
