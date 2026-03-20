import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";

export default function TermsPage() {
  return (
    <PageTransition>
      <UtilityPageLayout
        eyebrow="Legal"
        title="Terms of Use"
        description="Effective date: March 4, 2026"
        className="max-w-3xl"
      >
        <UtilityPagePanel className="space-y-6 px-4 py-5 text-sm leading-7 text-foreground/90 sm:px-6">
          <section>
            <h2 className="mb-2 text-base font-bold">1. Service Scope</h2>
            <p>
              This app provides playback, library management, and account-synced personalization features. Availability
              and media sources may vary by region or upstream provider status.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">2. Account Responsibility</h2>
            <p>
              You are responsible for your account credentials and activity under your account. Do not share credentials
              or attempt to access accounts that are not yours.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">3. Acceptable Use</h2>
            <p>
              You agree not to abuse APIs, scrape private data, disrupt service operation, or attempt unauthorized
              modifications to the platform.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">4. Availability and Changes</h2>
            <p>
              We may update, suspend, or remove features to improve reliability, security, or compliance. Material
              updates are reflected in this document with a new effective date.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">5. Limitation</h2>
            <p>
              The service is provided on an as-available basis. We do not guarantee uninterrupted operation in all
              network, browser, or provider conditions.
            </p>
          </section>
        </UtilityPagePanel>

        <UtilityPagePanel className="px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/70">
            <Link to="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link to="/legal/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
          </div>
        </UtilityPagePanel>
      </UtilityPageLayout>
    </PageTransition>
  );
}
