import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function Page() {
  const { profile } = await requireStudent();
  return <ProfilePage profile={profile} />;
}
