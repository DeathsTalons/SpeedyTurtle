import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Cancellations & Refunds · Redbird Grocery" };

export default function RefundsPage() {
  return (
    <LegalPage title="Cancellations & Refunds">
      <h2>Canceling an order</h2>
      <ul>
        <li><b>Before Cody starts shopping:</b> cancel for free from your order page. You won&apos;t be charged, and any hold on your card is released. Most banks drop a released hold within a few business days.</li>
        <li><b>After shopping has started:</b> the order can&apos;t be canceled, because the groceries have already been bought for you.</li>
        <li>If Cody has to cancel your order, for example because of bad weather, illness or a store closure, you won&apos;t be charged and he&apos;ll let you know right away.</li>
      </ul>

      <h2>Missing, damaged or wrong items</h2>
      <p>
        Tell Cody within <b>24 hours of delivery</b> by text or email. Include which items and, if you can, a photo. Cody will refund the price
        you paid for each affected item to your original card. Refunds usually show up within 5–10 business days, depending on your bank.
      </p>

      <h2>Out-of-stock items</h2>
      <p>
        You&apos;re only charged for what&apos;s on the store receipt, so items that couldn&apos;t be found are never charged. If you chose a substitute,
        you pay the substitute&apos;s receipt price.
      </p>

      <h2>Fees and tips</h2>
      <p>
        The service fee and second-store fee cover Cody&apos;s time shopping and driving, so they aren&apos;t refunded once shopping has started. If
        something went seriously wrong with your order, reach out and Cody will make it right. Tips are voluntary and refunded only if your order
        is canceled.
      </p>

    </LegalPage>
  );
}
