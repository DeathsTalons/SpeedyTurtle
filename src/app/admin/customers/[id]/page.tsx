import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { customerDetail, totals } from "@/lib/admin-records";
import { money } from "@/lib/money";
import { formatDay, formatStamp } from "@/lib/format";
import { stripeDashboard } from "@/lib/stripe";
import { OrderTable, Stat } from "../../records-ui";

export const metadata = { title: "Customer · Admin" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const c = await customerDetail(db, id);
  if (!c) notFound();
  const p = c.profile;
  const t = totals(c.orders);
  const canceled = c.orders.filter((o) => o.status === "canceled").length;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-sm font-bold underline">← All customers</Link>

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-60">
          <h1 className="text-3xl font-extrabold">{p.full_name || "(no name)"}</h1>
          <p className="text-muted">Joined {formatDay(c.auth?.createdAt ?? p.created_at)} · last signed in {formatStamp(c.auth?.lastSignIn)}</p>
          {p.role === "admin" && <p className="font-bold text-amber">Admin account</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.phone && <a href={`sms:${p.phone}`} className="btn btn-primary">Text</a>}
          {p.phone && <a href={`tel:${p.phone}`} className="btn btn-ghost">Call</a>}
          {c.auth?.email && <a href={`mailto:${c.auth.email}`} className="btn btn-ghost">Email</a>}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Orders" value={String(t.orders)} hint={canceled ? `${canceled} canceled` : undefined} />
        <Stat label="Spent" value={money(t.collectedCents)} hint="Finished orders" />
        <Stat label="Average order" value={t.completed ? money(Math.round(t.collectedCents / t.completed)) : "—"} />
        <Stat label="You made" value={money(t.earnedCents)} hint="Fees + tips" />
        <Stat label="Tips given" value={money(t.tipsCents)} />
      </div>

      <section className="grid md:grid-cols-2 gap-3">
        <div className="bg-card border border-line rounded-3xl p-5 space-y-1">
          <h2 className="text-xl font-extrabold mb-1">Contact</h2>
          <p><span className="text-muted">Phone:</span> {p.phone ?? "—"}</p>
          <p className="break-all"><span className="text-muted">Email:</span> {c.auth?.email ?? "—"}</p>
          <p><span className="text-muted">Saw fee breakdown:</span> {p.fees_seen_at ? formatStamp(p.fees_seen_at) : "Not yet"}</p>
          <p>
            <span className="text-muted">Stripe:</span>{" "}
            {p.stripe_customer_id
              ? <a className="underline" href={stripeDashboard(`customers/${p.stripe_customer_id}`)} target="_blank" rel="noreferrer">Open in Stripe</a>
              : "No card saved yet"}
          </p>
        </div>
        <div className="bg-card border border-line rounded-3xl p-5">
          <h2 className="text-xl font-extrabold mb-2">Addresses</h2>
          {c.addresses.length === 0 ? <p className="text-muted">None yet.</p> : (
            <ul className="space-y-2">
              {c.addresses.map((a: { id: string; line1: string; line2: string | null; city: string; zip: string; delivery_notes: string | null; is_default: boolean }) => (
                <li key={a.id}>
                  <b>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</b>{a.is_default && <span className="text-xs font-bold text-shell"> · default</span>}
                  <span className="block text-sm text-muted">{a.city}, IN {a.zip}</span>
                  {a.delivery_notes && <span className="block text-sm">“{a.delivery_notes}”</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Order history</h2>
        <OrderTable rows={c.orders} showCustomer={false} />
      </section>
    </div>
  );
}
