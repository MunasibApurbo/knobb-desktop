import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";

export default function TermsPage() {
  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-6 pb-32 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Legal</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground mt-2">Terms of Use</h1>
        <p className="text-sm text-muted-foreground/75 mt-3">
          Effective date: March 4, 2026
        </p>

        <div className="mt-8 space-y-6 text-sm text-foreground/90 leading-7">
          <section>
            <h2 className="text-base font-bold mb-2">1. Service Scope</h2>
            <p>
              This app provides playback, library management, and account-synced personalization features. Availability
              and media sources may vary by region or upstream provider status.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">2. Account Responsibility</h2>
            <p>
              You are responsible for your account credentials and activity under your account. Do not share credentials
              or attempt to access accounts that are not yours.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">3. Acceptable Use</h2>
            <p>
              You agree not to abuse APIs, scrape private data, disrupt service operation, or attempt unauthorized
              modifications to the platform.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">4. Availability and Changes</h2>
            <p>
              We may update, suspend, or remove features to improve reliability, security, or compliance. Material
              updates are reflected in this document with a new effective date.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">5. Limitation</h2>
            <p>
              The service is provided on an as-available basis. We do not guarantee uninterrupted operation in all
              network, browser, or provider conditions.
            </p>
          </section>
        </div>

        <div className="mt-10 text-xs text-muted-foreground/70 flex gap-4">
          <Link to="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/legal/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
        </div>
      </div>
    </PageTransition>
  );
}
