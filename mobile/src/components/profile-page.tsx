import { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Camera, ImagePlus, MapPin, Trash2, X } from "lucide-react-native";
import { AVATAR_BUCKET, avatarUrl } from "@/lib/avatar";
import { CITY_STATE, cityName, searchCities } from "@/lib/cities";
import { callAction } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { queryClient } from "~/lib/query";
import { useSession, type Profile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { pickPhoto, readBytes, uuid } from "~/lib/upload";
import { useFormAction } from "~/lib/use-action";
import { Button, Card, FormMessage, Input, PageTitle, Text, useTheme } from "~/ui";
import { Avatar, ShortcutCard } from "~/ui/extras";
import { DateField, TextField } from "~/ui/forms";

/** Foto de perfil ou logo: câmera/galeria → Storage → ação do site (setAvatar / setLogo). */
function ImageUploader({ userId, path, name, kind }: { userId: string; path: string | null; name: string; kind: "avatar" | "logo" }) {
  const { reloadProfile } = useSession();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const action = kind === "avatar" ? "perfil-actions#setAvatar" : "perfil-actions#setLogo";
  async function upload(source: "camera" | "galeria") {
    setState(null);
    try {
      const f = await pickPhoto(source, kind === "avatar" ? 512 : 600, 0.82, { square: kind === "avatar", png: kind === "logo" });
      if (!f) return;
      setPreview(f.uri);
      setPending(true);
      const newPath = `${userId}/${kind === "logo" ? "logo-" : ""}${uuid()}.${f.ext}`;
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(newPath, await readBytes(f.uri), { contentType: f.mime, cacheControl: "31536000" });
      if (error) throw error;
      const r = await callAction<{ error?: string; ok?: string }>(action, newPath);
      setState(r.result ?? { error: r.error });
      await reloadProfile();
      void queryClient.invalidateQueries();
    } catch (e) {
      setPreview(null);
      setState({ error: (e as Error).message?.startsWith("Permita") ? (e as Error).message : kind === "avatar" ? "Não foi possível enviar a foto. Tenta de novo?" : "Não foi possível enviar o logo. Tenta de novo?" });
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!(await confirmAsk(kind === "avatar" ? "Remover sua foto de perfil?" : "Remover o logo?", { ok: "Remover", destructive: true }))) return;
    setPreview(null);
    setPending(true);
    const r = await callAction<{ error?: string; ok?: string }>(action, null).catch(() => ({ error: "Sem internet." }) as never);
    setState(r.result ?? { error: r.error });
    await reloadProfile();
    setPending(false);
  }
  const src = preview ?? avatarUrl(path);
  return (
    <View className="items-center gap-4">
      {kind === "avatar" ? (
        preview ? <Image source={preview} style={{ width: 128, height: 128, borderRadius: 64 }} /> : <Avatar path={path} name={name} size={128} />
      ) : src ? (
        <View className="h-24 w-full items-center justify-center rounded-2xl bg-white p-3">
          <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="contain" />
        </View>
      ) : (
        <View className="h-24 w-full items-center justify-center rounded-2xl border-2 border-dashed border-border">
          <Text className="text-sm text-muted">Sem logo ainda</Text>
        </View>
      )}
      <View className="flex-row flex-wrap justify-center gap-2">
        <Button icon={Camera} loading={pending} onPress={() => upload("camera")}>
          {kind === "avatar" ? "Tirar selfie" : "Fotografar"}
        </Button>
        <Button icon={ImagePlus} variant="secondary" disabled={pending} onPress={() => upload("galeria")}>
          Galeria
        </Button>
        {path ? (
          <Button icon={Trash2} variant="ghost" disabled={pending} onPress={remove}>
            Remover
          </Button>
        ) : null}
      </View>
      {kind === "logo" ? <Text className="text-center text-xs text-muted">PNG com fundo transparente fica melhor.</Text> : null}
      <FormMessage state={state} />
    </View>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { reloadProfile } = useSession();
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const { state, pending, submit } = useFormAction("perfil-actions#updateMyProfile");
  const personal = profile.role === "personal";
  return (
    <View className="gap-4">
      <TextField label="Nome" value={name} onChangeText={setName} maxLength={120} autoComplete="name" />
      <TextField label="WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(11) 91234-5678" hint="Com DDD. Aparece no botão de WhatsApp para quem te acompanha." autoComplete="tel" />
      <DateField label="Data de nascimento" value={birth} onChange={setBirth} hint={personal ? "Sua idade aparece para alunos que procuram um Personal." : undefined} />
      <FormMessage state={state} />
      <Button
        className="self-start"
        loading={pending}
        onPress={async () => {
          await submit({ full_name: name, phone, birth_date: birth });
          await reloadProfile();
        }}
      >
        Salvar
      </Button>
    </View>
  );
}

function CityPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const options = query ? searchCities(query).filter((c) => !value.includes(c.code)) : [];
  return (
    <View className="gap-2">
      {value.length ? (
        <View className="flex-row flex-wrap gap-2">
          {value.map((code) => (
            <View key={code} className="flex-row items-center gap-1 rounded-full bg-bandeira-50 py-1 pl-3 pr-1 dark:bg-bandeira-500/15">
              <MapPin color={t.bandeira600} size={14} />
              <Text className="text-sm font-semibold">{cityName(code)}</Text>
              <Pressable onPress={() => onChange(value.filter((x) => x !== code))} className="rounded-full p-1" accessibilityLabel={`Tirar ${cityName(code)}`}>
                <X color={t.muted} size={14} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-muted">Nenhuma cidade escolhida ainda.</Text>
      )}
      <Input value={query} onChangeText={setQuery} placeholder={`Digite o nome da cidade (${CITY_STATE})…`} autoCorrect={false} />
      {query ? (
        <View className="rounded-2xl border border-border bg-surface p-1">
          {options.length ? (
            options.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  onChange([...value, c.code]);
                  setQuery("");
                }}
                className="flex-row items-center gap-2 rounded-xl px-3 py-2 active:bg-bandeira-50"
              >
                <MapPin color={t.muted} size={16} />
                <Text className="text-sm">{c.name}</Text>
              </Pressable>
            ))
          ) : (
            <Text className="px-3 py-2 text-sm text-muted">Nenhuma cidade do {CITY_STATE} com esse nome.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function ServiceCitiesForm({ cities }: { cities: number[] }) {
  const { reloadProfile } = useSession();
  const [value, setValue] = useState(cities);
  const { state, pending, submit } = useFormAction("perfil-actions#saveServiceCities");
  return (
    <View className="gap-3">
      <Text className="font-display text-lg font-bold">📍 Cidades onde você atende</Text>
      <Text className="text-sm text-muted">
        Alunos procurando Personal filtram pela cidade deles. Inclua as cidades onde você mora e as que consegue ir até o aluno. Por enquanto, só cidades do Rio Grande do Sul.
      </Text>
      <CityPicker value={value} onChange={setValue} />
      <FormMessage state={state} />
      <Button
        className="self-start"
        loading={pending}
        onPress={async () => {
          await submit({ city: value.map(String) });
          await reloadProfile();
        }}
      >
        Salvar cidades
      </Button>
    </View>
  );
}

function DirectoryToggle({ listed }: { listed: boolean }) {
  const { reloadProfile } = useSession();
  const { state, pending, submit } = useFormAction("perfil-actions#setDirectoryListed");
  return (
    <View className="gap-3">
      <Text className="font-display text-lg font-bold">Aparecer para novos alunos</Text>
      <Text className="text-sm text-muted">
        Alunos sem Personal veem sua foto, idade, cidades de atendimento, o valor por aula dos seus pacotes (aba Financeiro) e um botão para te chamar no WhatsApp. Precisa de WhatsApp, data de nascimento e pelo menos uma cidade.
      </Text>
      <Text className="text-sm">
        Status: <Text className="text-sm font-bold">{listed ? "visível na busca ✅" : "não aparece"}</Text>
      </Text>
      <FormMessage state={state} />
      <Button
        variant={listed ? "ghost" : "primary"}
        className={listed ? "self-start border border-border" : "self-start"}
        loading={pending}
        onPress={async () => {
          await submit({ listed: listed ? "0" : "1" });
          await reloadProfile();
        }}
      >
        {listed ? "Deixar de aparecer" : "Quero aparecer"}
      </Button>
    </View>
  );
}

export function PremiumNotice() {
  return (
    <View>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-display text-lg font-bold">✨ Sua marca no app</Text>
        <View className="rounded-full bg-ipe-500 px-2.5 py-0.5">
          <Text className="text-xs font-extrabold uppercase tracking-wide text-anil-900">Premium</Text>
        </View>
      </View>
      <View className="mt-2 rounded-2xl bg-ipe-100 px-3 py-2 dark:bg-ipe-500/15">
        <Text className="text-sm text-anil-900 dark:text-ipe-400">
          <Text className="text-sm font-bold text-anil-900 dark:text-ipe-400">Teste grátis por tempo limitado.</Text> Este é um recurso da versão Premium e o acesso gratuito pode não ficar disponível por muito tempo. Aproveite para testar agora!
        </Text>
      </View>
    </View>
  );
}

/** "Meu perfil" (Personal, aluno e admin). */
export function ProfileScreenBody({ profile }: { profile: Profile }) {
  return (
    <>
      <PageTitle sub={profile.email}>Meu perfil</PageTitle>
      <Card className="mb-6">
        <ImageUploader userId={profile.id} name={profile.full_name} path={profile.avatar_path} kind="avatar" />
      </Card>
      <Card>
        <ProfileForm key={profile.full_name + profile.phone + profile.birth_date} profile={profile} />
      </Card>
      {profile.role !== "personal" ? (
        <View className="mt-6">
          <ShortcutCard href="/aluno/saude-conectada" emoji="❤️" title="Health Connect" sub="Samsung Health, Google Fit, relógios e GymRats." />
          <ShortcutCard href="/aluno/saude" emoji="🩺" title="Minha anamnese" sub="Dores, lesões, saúde e liberação médica." />
          <ShortcutCard href="/aluno/privacidade" emoji="🔒" title="Privacidade e meus dados" sub="Permissões, lembretes, baixar ou excluir a conta." />
        </View>
      ) : (
        <>
          <Card className="mt-6">
            <ServiceCitiesForm cities={profile.service_cities ?? []} />
          </Card>
          <Card className="mt-6">
            <DirectoryToggle listed={profile.directory_listed} />
          </Card>
          <Card className="mt-6 border-2 border-ipe-500">
            <PremiumNotice />
            <Text className="mb-4 mt-3 text-sm">
              Coloque o <Text className="text-sm font-bold">seu logo</Text> e o app dos seus alunos passa a mostrar a sua marca no topo de todas as telas, no lugar do logo do BoraTreinar. Seus alunos treinam com a cara da sua consultoria.
            </Text>
            <ImageUploader userId={profile.id} name={profile.full_name} path={profile.logo_path ?? null} kind="logo" />
          </Card>
        </>
      )}
    </>
  );
}
