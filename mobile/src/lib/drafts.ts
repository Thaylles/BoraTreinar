import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Rascunhos de treino guardados no aparelho (as mesmas chaves do site: "bt:treino:<aluno>:<ficha>").
 * Ficam em memória para leitura imediata e são gravados no AsyncStorage a cada alteração.
 */
const mem = new Map<string, unknown>();
let loaded: Promise<void> | null = null;

function load() {
  loaded ??= (async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("bt:treino:") || k.startsWith("bt:livre:"));
      for (const [k, v] of await AsyncStorage.multiGet(keys)) if (v) mem.set(k, JSON.parse(v));
    } catch {
      /* armazenamento indisponível */
    }
  })();
  return loaded;
}

export const draftStore = {
  ready: load,
  async get<T>(key: string): Promise<T | null> {
    await load();
    return (mem.get(key) as T) ?? null;
  },
  set(key: string, value: unknown) {
    mem.set(key, value);
    void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  },
  remove(key: string) {
    mem.delete(key);
    void AsyncStorage.removeItem(key).catch(() => {});
  },
  async list(prefixes: string[]) {
    await load();
    return [...mem.entries()].filter(([k]) => prefixes.some((p) => k.startsWith(p)));
  },
};
