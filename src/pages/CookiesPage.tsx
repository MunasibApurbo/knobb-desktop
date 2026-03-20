import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";

export default function CookiesPage() {
  return (
    <PageTransition>
      <UtilityPageLayout
        eyebrow="Legal"
        title="Cookie Policy"
        description="Effective date: March 4, 2026"
        className="max-w-3xl"
      >
        <UtilityPagePanel className="space-y-6 px-4 py-5 text-sm leading-7 text-foreground/90 sm:px-6">
          <section>
            <h2 className="mb-2 text-base font-bold">1. Essential Storage</h2>
            <p>
              We use browser storage to keep your session active, remember settings, and preserve player state between
              page refreshes.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">2. Functional Storage</h2>
            <p>
              Feature-level preferences, cached metadata, and UI state (for example panel layout and quality defaults)
              are stored to improve responsiveness and continuity.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">3. Diagnostics and Performance</h2>
            <p>
              We may store short-lived diagnostics records and latency snapshots to detect failures and improve playback
              reliability.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">4. Managing Cookies</h2>
            <p>
              You can clear browser storage at any time. Some features (account persistence and library syncing) may
              require storage access to function correctly.
            </p>
          </section>
        </UtilityPagePanel>

        <UtilityPagePanel className="px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/70">
            <Link to="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link to="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link>
          </div>
        </UtilityPagePanel>
      </UtilityPageLayout>
    </PageTransition>
  );
}
