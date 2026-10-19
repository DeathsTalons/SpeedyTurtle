"use client";
import { useActionState } from "react";
import { addAddress, saveProfile, type FormState } from "./actions";

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="text-danger font-bold">{s.error}</p>;
  if (s.ok) return <p role="status" className="text-shell font-bold">{s.ok}</p>;
  return null;
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  return (
    <form action={action} className="grid sm:grid-cols-2 gap-4">
      <div><label className="label" htmlFor="full_name">Name</label>
        <input className="field" id="full_name" name="full_name" defaultValue={fullName} autoComplete="name" /></div>
      <div><label className="label" htmlFor="phone">Mobile number</label>
        <input className="field" id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" /></div>
      <div className="sm:col-span-2 flex items-center gap-4">
        <button className="btn btn-ghost" disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function AddressForm({ first }: { first: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAddress, {});
  return (
    <form action={action} className="grid grid-cols-6 gap-4" key={state.ok}>
      <div className="col-span-6"><label className="label" htmlFor="line1">Street address</label>
        <input className="field" id="line1" name="line1" autoComplete="address-line1" required /></div>
      <div className="col-span-6"><label className="label" htmlFor="line2">Apt, unit, lot <span className="text-muted font-normal">(optional)</span></label>
        <input className="field" id="line2" name="line2" autoComplete="address-line2" /></div>
      <div className="col-span-4"><label className="label" htmlFor="city">City</label>
        <input className="field" id="city" name="city" autoComplete="address-level2" required /></div>
      <div className="col-span-2"><label className="label" htmlFor="zip">ZIP</label>
        <input className="field" id="zip" name="zip" inputMode="numeric" pattern="\d{5}" autoComplete="postal-code" required /></div>
      <div className="col-span-6"><label className="label" htmlFor="delivery_notes">Drop-off notes <span className="text-muted font-normal">(optional)</span></label>
        <input className="field" id="delivery_notes" name="delivery_notes" placeholder="Gate code, side door, dog in the yard…" /></div>
      <div className="col-span-6 flex items-center gap-4">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : first ? "Save address" : "Add address"}</button>
        <Msg s={state} />
      </div>
    </form>
  );
}
