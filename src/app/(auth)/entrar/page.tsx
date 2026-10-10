import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const session = await getSessionProfile();
  if (session) redirect(homeFor(session.profile.role));
  const { next, erro } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Bora treinar!</h1>
      <p className="mb-6 text-muted">Entre com seu e-mail e senha.</p>
      <LoginForm next={next} linkError={erro === "link"} />
    </>
  );
}
