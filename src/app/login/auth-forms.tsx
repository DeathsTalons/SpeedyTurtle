"use client";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForms({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "in" ? inState : upState;

  return (
    <div className="bg-card border border-line rounded-3xl p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-1 p-1 bg-paper rounded-full mb-6" role="tablist">
        {(["in", "up"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`py-2.5 rounded-full font-bold ${mode === m ? "bg-shell text-white" : "text-muted"}`}>
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form action={mode === "in" ? inAction : upAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "up" && (
          <>
            <div><label className="label" htmlFor="full_name">Your name</label>
              <input className="field" id="full_name" name="full_name" autoComplete="name" required /></div>
            <div><label className="label" htmlFor="phone">Mobile number</label>
              <input className="field" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="For substitution texts" /></div>
          </>
        )}
        <div><label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <input className="field" id="password" name="password" type="password" required minLength={mode === "up" ? 8 : undefined}
            autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>

        {state.error && <p role="alert" className="text-danger font-bold">{state.error}</p>}
        {state.message && <p role="status" className="bg-amber-soft rounded-xl p-3">{state.message}</p>}

        <button className="btn btn-primary w-full" disabled={inPending || upPending}>
          {mode === "in" ? (inPending ? "Signing in…" : "Sign in") : upPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
