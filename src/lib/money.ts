// Dollar formatting, usable on both the server and in the browser.
export const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
