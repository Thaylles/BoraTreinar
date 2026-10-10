import Link from "next/link";
import { BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsRead } from "@/app/notifications-actions";
import { cn } from "@/lib/cn";

export async function NotificationsList({ limit = 8 }: { limit?: number }) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const unread = items?.filter((n) => !n.read_at).length ?? 0;

  return (
    <section aria-labelledby="notif-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="notif-title" className="font-display text-xl font-bold">
          Novidades {unread > 0 && <span className="text-pitanga-500">({unread})</span>}
        </h2>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="text-sm font-semibold text-anil-700 hover:underline dark:text-ipe-500">
              Marcar como lidas
            </button>
          </form>
        )}
      </div>
      {!items?.length ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <BellOff className="size-4" aria-hidden /> Nada de novo por aqui.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const content = (
              <>
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.created_at)}</p>
              </>
            );
            const cls = cn(
              "block rounded-2xl border border-border bg-surface p-3",
              !n.read_at && "border-l-4 border-l-ipe-500",
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className={cn(cls, "hover:border-bandeira-500")}>
                    {content}
                  </Link>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
