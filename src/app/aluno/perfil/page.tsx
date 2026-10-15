import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function Page() {
  const { profile } = await requireRole("aluno");
  return <ProfilePage profile={profile} />;
}
