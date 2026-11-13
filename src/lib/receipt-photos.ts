// Photos of paper store receipts, kept in the private "receipts" storage bucket.
// Paths are stored on orders.receipt_photos; viewers get short-lived signed links.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabaseAdmin() as any;
const BUCKET = "receipts";

export type ReceiptPhoto = { path: string; chain: "kroger" | "meijer" | null; at: string };
export type ReceiptPhotoView = ReceiptPhoto & { url: string };

export const photosOf = (o: { receipt_photos?: unknown }): ReceiptPhoto[] =>
  Array.isArray(o?.receipt_photos) ? (o.receipt_photos as ReceiptPhoto[]).filter((p) => typeof p?.path === "string") : [];

/** Signed links (1 hour) for showing photos on a page. */
export async function signedPhotos(photos: ReceiptPhoto[], seconds = 3600): Promise<ReceiptPhotoView[]> {
  if (!photos.length) return [];
  const { data } = await db().storage.from(BUCKET).createSignedUrls(photos.map((p) => p.path), seconds);
  const byPath = new Map<string, string>((data ?? []).filter((d: any) => d.signedUrl).map((d: any) => [d.path, d.signedUrl]));
  return photos.flatMap((p) => (byPath.has(p.path) ? [{ ...p, url: byPath.get(p.path)! }] : []));
}

/** Save one photo for an order (already resized on the phone). */
export async function addReceiptPhoto(orderId: string, file: File, chain: "kroger" | "meijer" | null): Promise<ReceiptPhoto> {
  const type = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg";
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const path = `${orderId}/${chain ?? "receipt"}-${Date.now()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false });
  if (error) throw new Error(/bucket/i.test(error.message) ? "Receipt photo storage isn't set up yet (run migration 0019)." : error.message);
  const photo: ReceiptPhoto = { path, chain, at: new Date().toISOString() };
  const { data: o } = await db().from("orders").select("*").eq("id", orderId).single();
  const { error: upErr } = await db().from("orders").update({ receipt_photos: [...photosOf(o), photo] }).eq("id", orderId);
  if (upErr) { await db().storage.from(BUCKET).remove([path]); throw new Error("Couldn't save the photo on the order (run migration 0019)."); }
  return photo;
}

export async function removeReceiptPhoto(orderId: string, path: string) {
  const { data: o } = await db().from("orders").select("*").eq("id", orderId).single();
  const keep = photosOf(o).filter((p) => p.path !== path);
  if (keep.length === photosOf(o).length) return;
  await db().from("orders").update({ receipt_photos: keep }).eq("id", orderId);
  await db().storage.from(BUCKET).remove([path]);
}

/** The photo files themselves, for attaching to the receipt email. */
export async function photoFiles(photos: ReceiptPhoto[]): Promise<{ filename: string; content: string }[]> {
  const out: { filename: string; content: string }[] = [];
  for (const [i, p] of photos.entries()) {
    const { data } = await db().storage.from(BUCKET).download(p.path);
    if (!data) continue;
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = p.path.split(".").pop() || "jpg";
    const name = p.chain ? `${p.chain === "kroger" ? "Kroger" : "Meijer"}-receipt` : "store-receipt";
    out.push({ filename: `${name}${photos.length > 1 ? `-${i + 1}` : ""}.${ext}`, content: buf.toString("base64") });
  }
  return out;
}
