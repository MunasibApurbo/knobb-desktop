import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to fetch notifications", error);
      toast.error("Failed to load notifications");
      setLoading(false);
      return;
    }

    setItems((data || []) as NotificationItem[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    void loadNotifications();
  }, [loadNotifications, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, user]);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) {
      console.error("Failed to mark notification as read", error);
      toast.error("Failed to update notification");
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) {
      console.error("Failed to mark all notifications as read", error);
      toast.error("Failed to update notifications");
      return;
    }
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
  };

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0}
          className="h-8 px-3 text-xs"
        >
          <CheckCheck className="w-3.5 h-3.5 mr-1" />
          Mark all read
        </Button>
      </div>

      <section className="mb-10">
        {loading ? (
          <div className="bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center py-20 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mb-4" />
            <p className="text-foreground font-medium text-lg">You're all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No new notifications right now.</p>
          </div>
        ) : (
          <div className="border border-white/10 divide-y divide-white/10">
            {items.map((item) => (
              <button
                key={item.id}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  item.is_read ? "bg-transparent" : "bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
                onClick={() => {
                  if (!item.is_read) void markAsRead(item.id);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${item.is_read ? "text-foreground/80" : "text-foreground"}`}>
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!item.is_read && (
                    <span className="inline-flex w-2 h-2 rounded-full bg-[hsl(var(--dynamic-accent))] mt-1 shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
