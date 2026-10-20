/**
 * Fila local de treinos finalizados que ainda não chegaram ao servidor
 * (internet caiu na academia). Sincronizada pelo <OutboxSync/>.
 */
export type SessionPayload = {
  client_id: string;
  student_id: string;
  plan_id: string | null;
  plan_name: string | null;
  kind: "ficha" | "livre";
  started_at: string;
  finished_at: string;
  notes?: string;
  exercises: {
    equipment_id: string;
    sets: {
      load_kg: number;
      reps: number;
      done: boolean;
      // Cardio (opcionais)
      duration_min?: number | null;
      distance_km?: number | null;
      speed_kmh?: number | null;
      incline_pct?: number | null;
      level?: number | null;
      /** Exercício da ficha que esta série substituiu (aparelho ocupado). */
      replaced_equipment_id?: string | null;
    }[];
  }[];
};

const KEY = "bt:outbox";

function read(): SessionPayload[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(items: SessionPayload[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* armazenamento indisponível */
  }
}

export const outbox = {
  list: read,
  add(p: SessionPayload) {
    write([...read().filter((i) => i.client_id !== p.client_id), p]);
  },
  remove(clientId: string) {
    write(read().filter((i) => i.client_id !== clientId));
  },
};

/** Estado do treino em andamento, salvo a cada alteração. */
export const draftStore = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* armazenamento indisponível */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* armazenamento indisponível */
    }
  },
};
