import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";
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
      <PageTransition>
        <UtilityPageLayout
          eyebrow="Inbox"
          title="Notifications"
          description="Playlist activity, product updates, and library events land here."
        >
          <UtilityPagePanel className="px-4 py-16 text-center sm:px-6">
            <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-base text-muted-foreground">Sign in to see your notifications.</p>
          </UtilityPagePanel>
        </UtilityPageLayout>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <UtilityPageLayout
        eyebrow="Inbox"
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} waiting.`
            : "Playlist activity, product updates, and library events land here."
        }
        actions={
          <Button
            variant="outline"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0}
            className="h-11 w-full border-white/10 bg-white/[0.04] px-4 text-sm font-semibold sm:w-auto"
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        }
      >
        {loading ? (
          <UtilityPagePanel className="flex flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Loading notifications</p>
            <p className="mt-1 text-sm text-muted-foreground">Checking for playlist activity, updates, and library events.</p>
          </UtilityPagePanel>
        ) : items.length === 0 ? (
          <UtilityPagePanel className="flex flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
            <Bell className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">You're all caught up!</p>
            <p className="mt-1 text-sm text-muted-foreground">No new notifications right now.</p>
          </UtilityPagePanel>
        ) : (
          <UtilityPagePanel className="overflow-hidden p-0">
            <div className="divide-y divide-white/10">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`w-full px-4 py-4 text-left transition-colors sm:px-5 ${
                    item.is_read ? "bg-transparent hover:bg-white/[0.03]" : "bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                  onClick={() => {
                    if (!item.is_read) void markAsRead(item.id);
                  }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${item.is_read ? "text-foreground/82" : "text-foreground"}`}>
                        {item.title}
                      </p>
                      {item.body ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-muted-foreground/85">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>

                    {!item.is_read ? (
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--dynamic-accent))]">
                        <span className="inline-flex h-2 w-2 rounded-full bg-[hsl(var(--dynamic-accent))]" />
                        New
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </UtilityPagePanel>
        )}
      </UtilityPageLayout>
    </PageTransition>
  );
}
