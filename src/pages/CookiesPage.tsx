import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";

export default function CookiesPage() {
  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-6 pb-32 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Legal</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground mt-2">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground/75 mt-3">
          Effective date: March 4, 2026
        </p>

        <div className="mt-8 space-y-6 text-sm text-foreground/90 leading-7">
          <section>
            <h2 className="text-base font-bold mb-2">1. Essential Storage</h2>
            <p>
              We use browser storage to keep your session active, remember settings, and preserve player state between
              page refreshes.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">2. Functional Storage</h2>
            <p>
              Feature-level preferences, cached metadata, and UI state (for example panel layout and quality defaults)
              are stored to improve responsiveness and continuity.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">3. Diagnostics and Performance</h2>
            <p>
              We may store short-lived diagnostics records and latency snapshots to detect failures and improve playback
              reliability.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">4. Managing Cookies</h2>
            <p>
              You can clear browser storage at any time. Some features (account persistence and library syncing) may
              require storage access to function correctly.
            </p>
          </section>
        </div>

        <div className="mt-10 text-xs text-muted-foreground/70 flex gap-4">
          <Link to="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </div>
    </PageTransition>
  );
}
