"use client";
// Card entry at checkout (Stripe). The card is saved to the customer; the hold is placed by the server.
import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { startCardSetup } from "./actions";

export type CardHandle = { confirm: () => Promise<{ paymentMethodId?: string; error?: string }> };

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!));

export function CardSection({ handle }: { handle: Ref<CardHandle> }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    startCardSetup().then((r) => { if (r.clientSecret) setSecret(r.clientSecret); else setError(r.error ?? "The card form didn't load."); });
  }, []);

  if (error) return <p role="alert" className="text-danger font-bold">{error}</p>;
  if (!secret) return <p className="text-muted">Loading the card form…</p>;
  return (
    <Elements stripe={getStripe()} options={{
      clientSecret: secret,
      appearance: {
        theme: "stripe",
        variables: { colorPrimary: "#1f5a40", colorText: "#17261e", borderRadius: "12px", fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif" },
      },
    }}>
      <CardForm handle={handle} />
    </Elements>
  );
}

function CardForm({ handle }: { handle: Ref<CardHandle> }) {
  const stripe = useStripe();
  const elements = useElements();
  useImperativeHandle(handle, () => ({
    async confirm() {
      if (!stripe || !elements) return { error: "The card form is still loading." };
      const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required", confirmParams: { return_url: window.location.href } });
      if (error) return { error: error.message ?? "That card didn't go through." };
      const pm = setupIntent?.payment_method;
      return { paymentMethodId: typeof pm === "string" ? pm : pm?.id };
    },
  }), [stripe, elements]);
  return <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />;
}
