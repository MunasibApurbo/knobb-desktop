import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";

export default function PrivacyPage() {
  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-6 pb-32 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Legal</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground mt-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground/75 mt-3">
          Effective date: March 4, 2026
        </p>

        <div className="mt-8 space-y-6 text-sm text-foreground/90 leading-7">
          <section>
            <h2 className="text-base font-bold mb-2">1. Data We Store</h2>
            <p>
              We store account data (email, display name), library actions (liked songs, saved albums, favorite artists,
              playlists), playback history, and settings required to run your music experience across devices.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">2. How We Use Data</h2>
            <p>
              Data is used to authenticate your account, sync your library, generate listening insights, and improve app
              reliability through diagnostics and performance telemetry.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">3. Sharing</h2>
            <p>
              We do not sell your personal data. Shared playlist links and collaboration features expose only the data
              necessary for those specific features.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">4. Retention and Deletion</h2>
            <p>
              You can delete your account from Settings. Deletion removes your account-scoped library and profile records
              from our application database.
            </p>
          </section>
          <section>
            <h2 className="text-base font-bold mb-2">5. Contact</h2>
            <p>For privacy requests, contact your support channel listed in the app profile/help flow.</p>
          </section>
        </div>

        <div className="mt-10 text-xs text-muted-foreground/70 flex gap-4">
          <Link to="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/legal/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
        </div>
      </div>
    </PageTransition>
  );
}
