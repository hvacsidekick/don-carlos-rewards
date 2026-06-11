import type { Metadata } from "next";

import { LegalPage } from "@/components/common/LegalPage";
import { SiteFooter } from "@/components/common/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Don Carlos Rewards.",
};

/**
 * Terms of Service (PLAN.md §Phase 10 criterion 7). Placeholder copy — flagged
 * for legal review by the banner in `LegalPage`. Public route.
 */
export default function TermsPage() {
  return (
    <>
      <LegalPage title="Terms of Service" lastUpdated="June 2026">
        <p>
          These terms govern your use of the Don Carlos Rewards app. By creating an
          account or using the app, you agree to these terms.
        </p>

        <h2>The rewards program</h2>
        <ul>
          <li>
            Points are earned on qualifying purchases at Don Carlos Taco Shop and can be
            redeemed for rewards as described in the app.
          </li>
          <li>
            Points have no cash value, are not transferable, and cannot be sold or
            combined across accounts.
          </li>
          <li>
            We may adjust the earn rate, redemption thresholds, and reward values; the
            current values always govern.
          </li>
        </ul>

        <h2>Your account</h2>
        <ul>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>
            You agree to provide accurate information and to use the app only for its
            intended, lawful purpose.
          </li>
          <li>
            We may suspend or terminate accounts that abuse the program or violate these
            terms.
          </li>
        </ul>

        <h2>Acceptable use</h2>
        <p>
          You may not attempt to manipulate point balances, access other users&rsquo;
          data, or interfere with the security or operation of the service.
        </p>

        <h2>Disclaimer &amp; liability</h2>
        <p>
          The app is provided &ldquo;as is&rdquo; without warranties of any kind. To the
          fullest extent permitted by law, we are not liable for indirect or incidental
          damages arising from your use of the app.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms; material changes will be reflected by the
          &ldquo;last updated&rdquo; date above. Continued use after a change means you
          accept the updated terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Contact Don Carlos Taco Shop, 7475 W 52nd Ave, Arvada, CO 80002.
        </p>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
