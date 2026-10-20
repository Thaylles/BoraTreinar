import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { AvatarUploader } from "./avatar-uploader";
import { ProfileForm } from "./profile-form";
import { DirectoryToggle } from "./directory-toggle";
import type { Profile } from "@/lib/auth";

/** "Meu perfil": foto, nome e WhatsApp (igual para Personal, aluno e admin). */
export function ProfilePage({ profile }: { profile: Profile }) {
  return (
    <>
      <PageTitle sub={profile.email}>Meu perfil</PageTitle>
      <section className="mb-6 rounded-3xl border border-border bg-surface p-5">
        <AvatarUploader userId={profile.id} name={profile.full_name} path={profile.avatar_path} />
      </section>
      <section className="rounded-3xl border border-border bg-surface p-5">
        <ProfileForm name={profile.full_name} phone={profile.phone} birthDate={profile.birth_date} />
      </section>
      {profile.role !== "personal" && (
        <Link
          href="/aluno/saude"
          className="mt-6 flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 transition hover:border-bandeira-500"
        >
          <span className="text-2xl" aria-hidden>🩺</span>
          <span className="flex-1">
            <span className="block font-display font-bold">Minha anamnese</span>
            <span className="text-sm text-muted">Dores, lesões, saúde e liberação médica.</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}
      {profile.role === "personal" && (
        <section className="mt-6 rounded-3xl border border-border bg-surface p-5">
          <DirectoryToggle listed={profile.directory_listed} />
        </section>
      )}
    </>
  );
}
