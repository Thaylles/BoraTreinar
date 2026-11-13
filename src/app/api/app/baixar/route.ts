import { NextResponse } from "next/server";
import { latestAppRelease } from "@/lib/app-release";

/** Link fixo para baixar o APK mais novo (bom para mandar aos alunos). */
export async function GET(req: Request) {
  const release = await latestAppRelease();
  return NextResponse.redirect(release?.url ?? new URL("/", req.url));
}
