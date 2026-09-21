"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell, X, Check, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

export function NotificationBell({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

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
  }, [userId, supabase, queryClient]);

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
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative size-11 rounded-full bg-[#f2f3f5] hover:bg-[#e4e8ec] flex items-center justify-center transition-colors cursor-pointer outline-none"
      >
        <Bell className="size-5 text-[#242b33]" />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#ef4444] ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 z-50 w-[340px] sm:w-[380px] p-5 rounded-[12px] bg-white shadow-2xl border border-[#e4e8ec] animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#f2f3f5]">
            <h2 className="text-lg font-semibold text-[#001f3e] tracking-tight">
              Notifications
            </h2>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markRead()}
                  className="text-xs font-medium text-[#0073F3] hover:underline cursor-pointer"
                >
                  Mark as read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="text-[#6e8298] hover:text-[#242b33] transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="mt-3 flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-0.5">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#6e8298]">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const isArrival = n.type === "referral_arrived";
                const isClosed = n.type === "referral_closed";
                const referralCode =
                  (n.payload as { referral_code?: string } | null)
                    ?.referral_code ?? "Referral";

                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex items-start gap-3 p-2.5 rounded-[8px] transition-colors cursor-pointer ${
                      n.read_at ? "opacity-75" : "bg-[#f8fafc]"
                    }`}
                  >
                    {/* Icon badge */}
                    <div
                      className={`size-10 rounded-[8px] flex items-center justify-center shrink-0 ${
                        isClosed
                          ? "bg-[#e8f8ee] text-[#16a34a]"
                          : "bg-[#e5f1ff] text-[#0073f3]"
                      }`}
                    >
                      {isClosed ? (
                        <Check className="size-5 stroke-[2.2]" />
                      ) : (
                        <Send className="size-4 stroke-[2]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#242b33] leading-snug">
                        Referral{" "}
                        <span className="font-mono font-medium">
                          {referralCode}
                        </span>{" "}
                        has{" "}
                        {isArrival && <strong>arrived at REACH</strong>}
                        {isClosed && <strong>been closed</strong>}
                        {!isArrival && !isClosed && (
                          <span>
                            updated (
                            <strong>
                              {n.type.replace("referral_", "")}
                            </strong>
                            )
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#6e8298] mt-1">
                        {format(new Date(n.created_at), "MMM d'th at' HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
