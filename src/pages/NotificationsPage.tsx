import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Bell className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to see your notifications.</p>
      </div>
    );
  }

  return (
    <div className="py-6 pb-32 px-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Notifications</h1>

      <section className="mb-10">
        <div className="bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center py-20 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mb-4" />
          <p className="text-foreground font-medium text-lg">You're all caught up!</p>
          <p className="text-sm text-muted-foreground mt-1">No new notifications right now.</p>
        </div>
      </section>
    </div>
  );
}
