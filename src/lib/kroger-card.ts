// The Kroger card (Alt ID) phone number customers can give for their Kroger items.
// Kroger accepts a 10-digit number that doesn't start with 0 as a card number at the register.

/** Digits only, US 10-digit (a leading 1 is dropped). Returns null when it isn't a usable card number. */
export function normalizeKrogerPhone(input: string | null | undefined): string | null {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 && !d.startsWith("0") ? d : null;
}

/** "7655551234" → "(765) 555-1234". */
export const formatKrogerPhone = (d: string) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;

/** The customer-facing explanation, shared by checkout and the Account page. */
export const KROGER_CARD_NOTE =
  "Add the phone number on your Kroger card and I'll ring up your Kroger items with it, so your clipped digital coupons apply and the fuel points go to you. Leave it blank and I'll use my own card so you still get member prices, and I appreciate the fuel points.";
