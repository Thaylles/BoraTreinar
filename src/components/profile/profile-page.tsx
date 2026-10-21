import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { AvatarUploader } from "./avatar-uploader";
import { ProfileForm } from "./profile-form";
import { DirectoryToggle } from "./directory-toggle";
import { LogoUploader } from "./logo-uploader";
import { ServiceCitiesForm } from "./service-cities-form";
import type { Profile } from "@/lib/auth";

/** Aviso do recurso Premium em teste gratuito. */
export function PremiumNotice() {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
        ✨ Sua marca no app
        <span className="rounded-full bg-ipe-500 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-anil-900">Premium</span>
      </p>
      <p className="mt-2 rounded-2xl bg-ipe-100 px-3 py-2 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
        <strong>Teste grátis por tempo limitado.</strong> Este é um recurso da versão Premium e o acesso gratuito pode não ficar
        disponível por muito tempo. Aproveite para testar agora!
      </p>
    </div>
  );
}

/** "Meu perfil": foto, nome e WhatsApp (igual para Personal, aluno e admin). */
export function ProfilePage({ profile }: { profile: Profile }) {
  return (
    <>
      <PageTitle sub={profile.email}>Meu perfil</PageTitle>
      <section className="mb-6 rounded-3xl border border-border bg-surface p-5">
        <AvatarUploader userId={profile.id} name={profile.full_name} path={profile.avatar_path} />
      </section>
      <section className="rounded-3xl border border-border bg-surface p-5">
        <ProfileForm name={profile.full_name} phone={profile.phone} birthDate={profile.birth_date} requireBirth={profile.role === "personal"} />
      </section>
      {profile.role !== "personal" && (
        <Link
          href="/aluno/saude-conectada"
          className="mt-6 flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 transition hover:border-bandeira-500"
        >
          <span className="text-2xl" aria-hidden>❤️</span>
          <span className="flex-1">
            <span className="block font-display font-bold">Health Connect (app Android)</span>
            <span className="text-sm text-muted">Samsung Health, Google Fit, relógios e GymRats.</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}
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
        <>
          <section id="cidades" className="mt-6 scroll-mt-20 rounded-3xl border border-border bg-surface p-5">
            <ServiceCitiesForm cities={profile.service_cities ?? []} />
          </section>
          <section className="mt-6 rounded-3xl border border-border bg-surface p-5">
            <DirectoryToggle listed={profile.directory_listed} />
          </section>
          <section id="marca" className="mt-6 scroll-mt-20 rounded-3xl border-2 border-ipe-500 bg-surface p-5">
            <PremiumNotice />
            <p className="mb-4 mt-3 text-sm">
              Coloque o <strong>seu logo</strong> e o app dos seus alunos passa a mostrar a sua marca no topo de todas as telas, no
              lugar do logo do BoraTreinar. Seus alunos treinam com a cara da sua consultoria.
            </p>
            <LogoUploader userId={profile.id} name={profile.full_name} path={profile.logo_path ?? null} />
          </section>
        </>
      )}
    </>
  );
}
