import { useProfile } from "~/lib/session";
import { Screen } from "~/ui";
import { ProfileScreenBody } from "~/components/profile-page";

export default function AdminPerfil() {
  const profile = useProfile();
  return (
    <Screen edges={[]}>
      <ProfileScreenBody profile={profile} />
    </Screen>
  );
}
