"use client";
// Camera barcode scanner (rear camera) with a type-it-in fallback.
// Phones only allow the camera on https sites (or localhost), so the typed box matters while testing.
import { useEffect, useRef, useState } from "react";

export function Scanner({ title, onCode, onClose }: { title: string; onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState("");
  const [typed, setTyped] = useState("");
  const done = useRef(false);
  const latest = useRef(onCode);
  useEffect(() => { latest.current = onCode; }, [onCode]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current!,
          (result) => {
            if (result && !done.current) {
              done.current = true;
              navigator.vibrate?.(80);
              latest.current(result.getText());
            }
          },
        );
        if (cancelled) controls.stop(); else stop = () => controls.stop();
      } catch (e) {
        const msg = (e as Error).message ?? "";
        setCamError(
          /secure|https|NotAllowed|Permission/i.test(msg) || !window.isSecureContext
            ? "The camera needs permission and an https address (it works once the app is online). Type the number under the barcode instead."
            : "Couldn't start the camera. Type the number under the barcode instead.",
        );
      }
    })();
    return () => { cancelled = true; stop?.(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center gap-3 p-3 text-white">
        <p className="flex-1 font-bold">{title}</p>
        <button className="btn bg-white text-ink" onClick={onClose}>Close</button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={video} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-32 border-4 border-amber rounded-2xl pointer-events-none" />
        {camError && <p className="absolute inset-x-4 top-4 bg-amber-soft text-ink rounded-xl p-3 font-bold">{camError}</p>}
      </div>
      <form className="p-3 bg-card flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.replace(/\D/g, "").length >= 6) onCode(typed); }}>
        <label htmlFor="upc-typed" className="sr-only">Barcode number</label>
        <input id="upc-typed" className="field" inputMode="numeric" placeholder="Or type the barcode number" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button className="btn btn-primary shrink-0">Check</button>
      </form>
    </div>
  );
}
