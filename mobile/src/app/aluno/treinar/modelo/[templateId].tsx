import { useLocalSearchParams } from "expo-router";
import { loadRunnerForTemplate } from "@/lib/runner-server";
import { RunnerScreen } from "~/components/runner-screen";
import { useProfile } from "~/lib/session";

/** Personal treinando com um dos próprios modelos ("Meu treino"). */
export default function TreinarModelo() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const profile = useProfile();
  return (
    <RunnerScreen
      queryKey={["runner", "template", templateId, profile.id]}
      load={async () => {
        const d = await loadRunnerForTemplate(templateId, profile.id);
        return d && { name: d.plan.name, planId: null, exercises: d.exercises };
      }}
      studentId={profile.id}
      kind="livre"
      storageKey={`bt:treino:${profile.id}:modelo:${templateId}`}
      backHref="/aluno"
      selfHref={`/aluno/treinar/modelo/${templateId}`}
    />
  );
}
