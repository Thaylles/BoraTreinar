"use client";

import { startTransition, useActionState } from "react";
import { saveServiceCities } from "@/app/perfil-actions";
import { CityPicker } from "@/components/cities/city-picker";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Personal escolhe as cidades onde atende (aparece na busca de Personais dos alunos). */
export function ServiceCitiesForm({ cities }: { cities: number[] }) {
  const [state, action, pending] = useActionState(saveServiceCities, undefined);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <p className="font-display text-lg font-bold">📍 Cidades onde você atende</p>
      <p className="text-sm text-muted">
        Alunos procurando Personal filtram pela cidade deles. Inclua as cidades onde você mora e as que consegue ir até o aluno. Por
        enquanto, só cidades do Rio Grande do Sul.
      </p>
      <CityPicker name="city" initial={cities} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Salvando…" : "Salvar cidades"}
      </Button>
    </form>
  );
}
