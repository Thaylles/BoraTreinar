import { PageTitle } from "@/components/ui/card";
import { AvatarUploader } from "./avatar-uploader";
import { ProfileForm } from "./profile-form";
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
        <ProfileForm name={profile.full_name} phone={profile.phone} />
      </section>
    </>
  );
}
