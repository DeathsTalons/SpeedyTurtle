import { LegalPage } from "@/components/legal-page";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Privacy Policy · Redbird Grocery" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {BUSINESS.name} is a one-person business. This page explains what we collect, why, and who else sees it. The short version: we use your
        information to shop and deliver your groceries, and we never sell it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your name, email address, phone number and password (stored securely; we can&apos;t see it).</li>
        <li><b>Delivery addresses</b> and any delivery notes you add, like a gate code.</li>
        <li><b>Orders:</b> what you ordered, substitution choices, notes, receipt totals, tips and order history.</li>
        <li><b>Payment details:</b> your card is entered directly into Stripe, our payment processor. We never see or store your full card number. We only keep a reference to your saved card so we can charge it for your orders.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To shop for and deliver your orders, and to text or call you about substitutions, delays or problems.</li>
        <li>To charge your card, issue refunds, and keep records for taxes and accounting.</li>
        <li>To find the stores nearest your address and show your order history.</li>
      </ul>
      <p>We don&apos;t send marketing messages unless you ask for them, and we don&apos;t sell or rent your information to anyone.</p>

      <h2>Who else handles it</h2>
      <p>We use a few trusted services to run the site. Each one only gets what it needs:</p>
      <ul>
        <li><b>Stripe</b> processes payments and stores your card.</li>
        <li><b>Supabase</b> hosts our database and handles sign-in.</li>
        <li><b>Vercel</b> hosts this website.</li>
        <li><b>The U.S. Census Bureau&apos;s address lookup</b> turns your address into map coordinates so we can pick your nearest stores.</li>
        <li><b>Kroger</b> provides product and price information. We don&apos;t send them your personal information.</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect against fraud.</p>

      <h2>Cookies and storage</h2>
      <p>
        We use a cookie to keep you signed in, and your browser stores your cart so it&apos;s still there when you come back. We don&apos;t use
        advertising or tracking cookies.
      </p>

      <h2>Keeping and deleting your information</h2>
      <p>
        We keep your account and order history while your account is open, and order and payment records as long as needed for taxes and
        accounting. To see, correct or delete your information, update it on your Account page or contact Cody, and he&apos;ll take care of it.
      </p>

      <h2>Security</h2>
      <p>
        Your information is stored with providers that encrypt it and limit who can access it. Only Cody can see customer accounts and orders. No
        system is perfectly secure, but we take reasonable steps to protect your information.
      </p>

      <h2>Children</h2>
      <p>The service is for adults 18 and older. We don&apos;t knowingly collect information from children.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we&apos;ll update the date at the top of this page.</p>
    </LegalPage>
  );
}
