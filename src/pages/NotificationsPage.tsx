import { useAuth } from "@/contexts/AuthContext";
import { Bell, Music, Heart, ListMusic } from "lucide-react";

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
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Bell className="w-6 h-6" style={{ color: `hsl(var(--dynamic-accent))` }} />
        Notifications
      </h1>

      <div className="flex flex-col items-center justify-center py-16 text-center glass-heavy rounded-xl">
        <Bell className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-foreground font-semibold">You're all caught up!</p>
        <p className="text-sm text-muted-foreground mt-1">No new notifications right now.</p>
      </div>
    </div>
  );
}
