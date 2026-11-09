import { View } from "react-native";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowLeft } from "lucide-react-native";
import { API_URL } from "~/lib/config";
import { Button, Screen, Text } from "~/ui";

const VIDEOS = [
  { src: "/demo/aluno.mp4", title: "Para alunos", text: "Ficha no celular, carga sugerida, descanso cronometrado, evolução e busca de Personais." },
  { src: "/demo/personal.mp4", title: "Para personais", text: "Alunos, fichas com técnicas, agenda, evolução e o Financeiro (pacotes, pagamentos e cobranças)." },
];

function Demo({ src, title, text }: (typeof VIDEOS)[number]) {
  const player = useVideoPlayer(`${API_URL}${src}`);
  return (
    <View className="items-center">
      <View className="w-full max-w-[300px] overflow-hidden rounded-[2rem] border-[6px] border-anil-900 bg-anil-900">
        <VideoView player={player} style={{ width: "100%", aspectRatio: 390 / 844 }} nativeControls contentFit="contain" />
      </View>
      <Text className="mt-3 font-display text-xl font-bold">{title}</Text>
      <Text className="text-center text-sm text-muted">{text}</Text>
    </View>
  );
}

/** Vídeos curtos e narrados (os mesmos do site). */
export default function ComoUsar() {
  return (
    <Screen>
      <Button variant="ghost" icon={ArrowLeft} className="mb-2 self-start" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
        Voltar ao app
      </Button>
      <Text className="text-center font-display text-4xl font-extrabold text-anil-700 dark:text-foreground">Como usar o BoraTreinar</Text>
      <Text className="mx-auto mb-8 mt-2 text-center text-muted">Dois vídeos curtos, narrados, mostrando o app passo a passo. Ative o som para ouvir a explicação. 🔊</Text>
      <View className="gap-8">
        {VIDEOS.map((v) => (
          <Demo key={v.src} {...v} />
        ))}
      </View>
    </Screen>
  );
}
