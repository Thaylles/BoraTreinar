import { NextResponse } from "next/server";
import { latestAppRelease } from "@/lib/app-release";

/** Versão mais nova do app Android: o site mostra o download e o app avisa quando há atualização. */
export async function GET() {
  const release = await latestAppRelease();
  return NextResponse.json(release ?? { versionCode: 0 }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
}
