import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { storesFor } from "@/lib/data";
import { signOut } from "../login/actions";
import { deleteAddress, makeDefault } from "./actions";
import { AddressForm, ProfileForm } from "./forms";

export const metadata = { title: "Account · Speedy Turtle" };

export default async function AccountPage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: addresses }] = await Promise.all([
    db.from("profiles").select("full_name, phone").eq("id", user.id).single(),
    db.from("addresses").select("*").eq("user_id", user.id).order("created_at"),
  ]);
  const list = addresses ?? [];
  const def = list.find((a) => a.is_default) ?? list[0];
  const stores = def ? await storesFor(def.latitude != null ? { latitude: def.latitude, longitude: def.longitude } : null) : null;

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold">Account</h1>

      <section aria-labelledby="addr-h" className="space-y-4">
        <h2 id="addr-h" className="text-xl font-extrabold">Delivery address</h2>
        {list.length === 0 && <p className="text-muted">Add where you&apos;d like groceries dropped off. This also picks your nearest Kroger and Meijer.</p>}
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className={`bg-card border rounded-2xl p-4 ${a.id === def?.id ? "border-shell border-2" : "border-line"}`}>
              <p className="font-bold">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
              <p className="text-muted">{a.city}, {a.state} {a.zip}</p>
              {a.delivery_notes && <p className="text-sm mt-1">“{a.delivery_notes}”</p>}
              <div className="flex gap-4 mt-3 text-sm font-bold">
                {a.id === def?.id ? <span className="text-shell">Default address</span> : (
                  <form action={makeDefault.bind(null, a.id)}><button className="underline">Make default</button></form>
                )}
                <form action={deleteAddress.bind(null, a.id)}><button className="underline text-danger">Remove</button></form>
              </div>
            </li>
          ))}
        </ul>
        {stores && (stores.kroger || stores.meijer) && (
          <p className="bg-amber-soft rounded-2xl p-4">
            Your stores: <b className="tag-kroger">{stores.kroger?.name ?? "—"}</b> and <b className="tag-meijer">{stores.meijer?.name ?? "—"}</b>.
          </p>
        )}
        <details open={list.length === 0} className="bg-card border border-line rounded-2xl p-4">
          <summary className="font-bold cursor-pointer">{list.length === 0 ? "Add your address" : "Add another address"}</summary>
          <div className="pt-4"><AddressForm first={list.length === 0} /></div>
        </details>
        {list.length > 0 && <Link href="/shop" className="btn btn-primary">Start shopping</Link>}
      </section>

      <section aria-labelledby="me-h" className="space-y-4">
        <h2 id="me-h" className="text-xl font-extrabold">Your details</h2>
        <p className="text-muted">Signed in as {user.email}</p>
        <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
      </section>

      <form action={signOut}><button className="btn btn-ghost">Sign out</button></form>
    </div>
  );
}
