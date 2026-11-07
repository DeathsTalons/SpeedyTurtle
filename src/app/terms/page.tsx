import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Terms of Service · Redbird Grocery" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        {BUSINESS.name} is a grocery shopping and delivery service run by me, {BUSINESS.owner} (&ldquo;I,&rdquo; &ldquo;me,&rdquo;
        &ldquo;{BUSINESS.name}&rdquo;). These terms cover your use of it. By creating an account or placing an order, you agree to them.
      </p>

      <h2>What I do</h2>
      <p>
        You choose groceries from Kroger and Meijer on this site. I shop for them in person and deliver them to your door in{" "}
        {BUSINESS.area}. {BUSINESS.name} is an independent business. I&apos;m not affiliated with, endorsed by, or acting for Kroger or Meijer.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 to create an account and place orders.</li>
        <li>Give me a correct name, phone number and delivery address, and keep them up to date.</li>
        <li>Keep your password private. You&apos;re responsible for orders placed from your account.</li>
      </ul>

      <h2>Prices and fees</h2>
      <ul>
        <li>You pay the store&apos;s price for each item, exactly as it appears on the store receipt. Prices shown while you shop are estimates from the store and can change by the time I shop.</li>
        <li>Each order also has a flat service fee based on how many different items it has, plus a flat fee if you add items from a second store. Current fees are on the <Link href="/pricing">pricing page</Link> and are shown before you check out.</li>
        <li>Tips are optional. You can add one at checkout or after delivery.</li>
        <li>Fees can change, but the fees you see at checkout are the ones you pay for that order.</li>
      </ul>

      <h2>How payment works</h2>
      <p>
        When you place an order, your card is saved with my payment processor, Stripe, and a temporary hold is placed for the estimated total plus
        a small buffer for weighed items and price changes. If your delivery is more than a few days away, the hold is placed closer to your
        delivery day. After I shop, your card is charged the actual receipt total plus the service fee, any second-store fee and your tip, and
        the rest of the hold is released. If the final total is more than the hold, I&apos;ll contact you before charging the difference.
      </p>

      <h2>Substitutions and out-of-stock items</h2>
      <p>
        For each item you can choose what happens if it&apos;s out of stock: an approved replacement, my best pick, the store brand, or a refund
        of that item. I may text you about a substitution while shopping. You&apos;re never charged for items that weren&apos;t bought.
      </p>

      <h2>Delivery</h2>
      <ul>
        <li>You pick a delivery window at checkout. I aim to arrive inside it, but traffic, weather or store delays sometimes make me late. If so, I&apos;ll text you.</li>
        <li>Someone should be available to receive cold and frozen items. If no one is home, I&apos;ll leave the order at your door per your delivery notes. Once delivered, the groceries are your responsibility.</li>
        <li>I don&apos;t deliver alcohol, tobacco or other age-restricted items. If one ends up in an order, I&apos;ll leave it out and you won&apos;t be charged for it.</li>
      </ul>

      <h2>Cancellations and refunds</h2>
      <p>
        You can cancel any order for free until I start shopping for it. Problems with items can be reported within 24 hours of delivery.
        Details are in my <Link href="/refunds">refund policy</Link>.
      </p>

      <h2>My responsibility</h2>
      <p>
        I shop carefully and handle your groceries with care. To the extent the law allows, my total responsibility for any order is limited to
        the amount you paid for that order. I&apos;m not responsible for the quality, safety or labeling of products made by others. Contact the
        maker or the store about recalls or product defects, and check labels for allergens.
      </p>

      <h2>Ending service</h2>
      <p>
        You can stop using the service and ask me to close your account at any time. I may refuse or cancel orders, or close accounts, in cases of
        abuse, fraud, unpaid charges or unsafe delivery locations.
      </p>

      <h2>Changes to these terms</h2>
      <p>I may update these terms. The date at the top shows the latest version. Orders are covered by the terms in place when they were placed.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Indiana.</p>
    </LegalPage>
  );
}
