import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";

export default function PrivacyPage() {
  return (
    <PageTransition>
      <UtilityPageLayout
        eyebrow="Legal"
        title="Privacy Policy"
        description="Effective date: March 4, 2026"
        className="max-w-3xl"
      >
        <UtilityPagePanel className="space-y-6 px-4 py-5 text-sm leading-7 text-foreground/90 sm:px-6">
          <section>
            <h2 className="mb-2 text-base font-bold">1. Data We Store</h2>
            <p>
              We store account data (email, display name), library actions (liked songs, saved albums, favorite artists,
              playlists), playback history, and settings required to run your music experience across devices.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">2. How We Use Data</h2>
            <p>
              Data is used to authenticate your account, sync your library, generate listening insights, and improve app
              reliability through diagnostics and performance telemetry.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">3. Sharing</h2>
            <p>
              We do not sell your personal data. Shared playlist links and collaboration features expose only the data
              necessary for those specific features.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">4. Retention and Deletion</h2>
            <p>
              You can delete your account from Settings. Deletion removes your account-scoped library and profile records
              from our application database.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-bold">5. Contact</h2>
            <p>For privacy requests, contact your support channel listed in the app profile/help flow.</p>
          </section>
        </UtilityPagePanel>

        <UtilityPagePanel className="px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/70">
            <Link to="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link to="/legal/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
          </div>
        </UtilityPagePanel>
      </UtilityPageLayout>
    </PageTransition>
  );
}
