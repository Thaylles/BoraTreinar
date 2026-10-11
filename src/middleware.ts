import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|offline.html|icon.svg|apple-icon.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)",
  ],
};
