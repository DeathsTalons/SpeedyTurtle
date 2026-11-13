"use client";
// "Order alerts" card on the admin home: turns push notifications on for this phone.
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./actions";

type State = "loading" | "unsupported" | "install-first" | "off" | "on" | "blocked";

function keyBytes(base64: string) {
  const b64 = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function OrderAlerts({ publicKey, newKeys, devices }: { publicKey: string | null; newKeys: { publicKey: string; privateKey: string } | null; devices: number }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: State;
      if (!supported) next = ios && !standalone ? "install-first" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        next = sub && Notification.permission === "granted" ? "on" : "off";
      }
      if (live) setState(next);
    })().catch(() => live && setState("unsupported"));
    return () => { live = false; };
  }, []);

  const turnOn = () => start(async () => {
    setMsg("");
    if (!publicKey) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
    if (r.error) { setMsg(r.error); return; }
    setState("on");
    const t = await sendTestPush();
    setMsg(t.error ?? "Done! A test alert is on its way.");
  });

  const turnOff = () => start(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    setState("off");
    setMsg("Alerts are off on this device.");
  });

  const test = () => start(async () => { const t = await sendTestPush(); setMsg(t.error ?? `Sent to ${t.sent} device${t.sent === 1 ? "" : "s"}.`); });

  if (!publicKey) {
    return (
      <section className="bg-amber-soft rounded-3xl p-4 mb-5 space-y-2 text-sm">
        <h2 className="text-lg font-extrabold">Order alerts: one-time setup</h2>
        <p>To get a notification on your phone for every new order, add these two keys in <b>Vercel → Settings → Environment Variables</b> (Production), then redeploy:</p>
        {newKeys && (
          <dl className="space-y-2">
            {([["VAPID_PUBLIC_KEY", newKeys.publicKey], ["VAPID_PRIVATE_KEY", newKeys.privateKey]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="font-bold">{k}</dt>
                <dd><input readOnly className="field font-mono text-xs" value={v} onFocus={(e) => e.currentTarget.select()} /></dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-muted">These are made fresh each time this page loads, so copy both from the same visit. Only you can see this page.</p>
      </section>
    );
  }

  return (
    <section className="bg-card border-2 border-line rounded-3xl p-4 mb-5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-extrabold flex-1">Order alerts {state === "on" && <span className="text-shell">· on ✓</span>}</h2>
        {state === "off" && <button className="btn btn-primary !min-h-10" disabled={pending} onClick={turnOn}>Turn on for this phone</button>}
        {state === "on" && (
          <>
            <button className="btn btn-ghost !min-h-10" disabled={pending} onClick={test}>Send test</button>
            <button className="btn btn-ghost !min-h-10" disabled={pending} onClick={turnOff}>Turn off</button>
          </>
        )}
      </div>
      {state === "off" && <p className="text-sm text-muted">Get a notification when someone places, cancels or tips on an order.</p>}
      {state === "install-first" && (
        <p className="text-sm">On iPhone, install the app first: tap <b>Share</b> → <b>Add to Home Screen</b>, open <b>Redbird</b> from your home screen, then come back here to turn alerts on.</p>
      )}
      {state === "blocked" && <p className="text-sm">Notifications are blocked for this site. Allow them in your phone or browser settings, then reload this page.</p>}
      {state === "unsupported" && <p className="text-sm text-muted">This browser can&apos;t show notifications. Try Chrome on Android, or the installed app on iPhone.</p>}
      {devices > 0 && <p className="text-xs text-muted">{devices} device{devices === 1 ? "" : "s"} getting alerts.</p>}
      {msg && <p className="text-sm font-bold" role="status">{msg}</p>}
    </section>
  );
}
