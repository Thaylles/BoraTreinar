import Link from "next/link";
import { ChevronRight, Trophy, UserCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { listSessions } from "@/lib/sessions-server";
import { effortInfo } from "@/lib/effort";

type Item = Awaited<ReturnType<typeof listSessions>>[number];

export function SessionList({ sessions, href }: { sessions: Item[]; href: (id: string) => string }) {
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link href={href(s.id)} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-bandeira-500">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-semibold">
                {s.plan_name ?? "Treino livre"}
                {s.kind === "livre" && <span className="text-xs font-normal text-muted">(livre)</span>}
                {s.hasPr && <Trophy className="size-4 text-ipe-600" aria-label="Recorde" />}
                {s.byInstructor && <UserCheck className="size-4 text-anil-500" aria-label="Registrado pelo instrutor" />}
                {s.effort != null && (
                  <span className="text-sm" title={`Esforço: ${effortInfo(s.effort)?.label}`} aria-label={`Esforço: ${effortInfo(s.effort)?.label}`}>
                    {effortInfo(s.effort)?.emoji}
                  </span>
                )}
                {s.pain && <span className="rounded-full bg-pitanga-100 px-1.5 text-xs font-bold text-pitanga-600 dark:bg-pitanga-500/20">dor</span>}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(s.started_at)} · {Math.round(s.duration_seconds / 60)} min · {s.doneSets} séries
              </p>
            </div>
            <ChevronRight className="size-5 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
