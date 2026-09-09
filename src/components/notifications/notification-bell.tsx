"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";

const NOTIFICATION_COPY: Record<string, string> = {
  referral_created: "A new referral was created for your facility",
  referral_arrived: "A referral was marked arrived",
  referral_closed: "A referral was closed",
  referral_cancelled: "A referral was cancelled",
  sync_attention: "A device has pending changes that need attention",
};

export function NotificationBell({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, payload, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("notifications-" + userId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: ["notifications", userId],
          }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markRead(id?: string) {
    const query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() });
    if (id) {
      await query.eq("id", id);
    } else {
      await query.is("read_at", null);
    }
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unreadCount > 0 && (
            <button
              className="text-xs font-normal text-primary"
              onClick={() => markRead()}
            >
              Mark all as read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        )}
        {notifications.map((n) => (
          <DropdownMenuItem
            key={n.id}
            className="flex flex-col items-start gap-0.5"
            onClick={() => markRead(n.id)}
          >
            <span
              className={n.read_at ? "text-muted-foreground" : "font-medium"}
            >
              {NOTIFICATION_COPY[n.type] ?? n.type}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
