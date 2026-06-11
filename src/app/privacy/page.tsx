import type { Metadata } from "next";

import { LegalPage } from "@/components/common/LegalPage";
import { SiteFooter } from "@/components/common/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Don Carlos Rewards collects, uses, and protects your data.",
};

/**
 * Privacy Policy (PLAN.md §Phase 10 criterion 7). Placeholder copy — flagged for
 * legal review by the banner in `LegalPage`. Public route (not under the
 * `(user)`/`(admin)` guarded prefixes).
 */
export default function PrivacyPage() {
  return (
    <>
      <LegalPage title="Privacy Policy" lastUpdated="June 2026">
        <p>
          Don Carlos Rewards (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates a loyalty
          rewards program for Don Carlos Taco Shop. This policy explains what
          personal information we collect, how we use it, and the choices you have.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — your email address and, optionally, a
            display name, provided when you create an account or sign in with a
            third-party provider.
          </li>
          <li>
            <strong>Rewards activity</strong> — points earned, redeemed, and adjusted,
            along with the date and (for purchases) the amount, kept as your rewards
            ledger.
          </li>
          <li>
            <strong>Technical data</strong> — standard request metadata (such as IP
            address) used to keep the service secure and to enforce rate limits.
          </li>
        </ul>

        <h2>How we use your information</h2>
        <ul>
          <li>To operate the rewards program — tracking your points and redemptions.</li>
          <li>To authenticate you and keep your account secure.</li>
          <li>To prevent abuse, fraud, and to comply with our legal obligations.</li>
        </ul>

        <h2>How we share information</h2>
        <p>
          We do not sell your personal information. We share data only with the service
          providers that power this app (for example, our authentication and database
          provider) and only as needed to operate the service.
        </p>

        <h2>Your rights</h2>
        <p>
          You can download a copy of your data or permanently delete your account at any
          time from your profile page. Deleting your account removes your profile and
          rewards history; anonymized audit records may be retained as required for
          security and accounting.
        </p>

        <h2>Data retention</h2>
        <p>
          We keep your account and rewards data for as long as your account is active.
          When you delete your account, your personal data is removed and references in
          our internal audit log are anonymized.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Contact Don Carlos Taco Shop, 7475 W 52nd Ave,
          Arvada, CO 80002.
        </p>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
