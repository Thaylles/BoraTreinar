import { Redirect } from "expo-router";
import { homeFor, useSession } from "~/lib/session";

/** Abre a área de cada papel (aluno, Personal ou admin). */
export default function Index() {
  const { profile } = useSession();
  return <Redirect href={homeFor(profile?.role)} />;
}
