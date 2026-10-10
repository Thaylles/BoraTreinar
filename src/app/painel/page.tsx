import { redirect } from "next/navigation";
import { getSessionProfile, homeFor } from "@/lib/auth";

export default async function PainelPage() {
  const session = await getSessionProfile();
  redirect(session ? homeFor(session.profile.role) : "/entrar");
}
