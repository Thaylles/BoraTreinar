import { Link } from "expo-router";
import { View } from "react-native";
import { Text } from "~/ui";
import { Checkbox } from "~/ui/forms";

export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="rounded-2xl bg-background p-3">
      <Checkbox checked={checked} onChange={onChange}>
        <Text className="text-sm">
          Li e aceito o{" "}
          <Link href="/termos">
            <Text className="text-sm font-semibold text-bandeira-600 underline">Termo de Uso e Política de Privacidade</Text>
          </Link>
          , incluindo o tratamento dos meus dados de treino e saúde conforme a LGPD.
        </Text>
      </Checkbox>
    </View>
  );
}
