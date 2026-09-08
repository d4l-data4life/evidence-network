// Serves the uploaded branding logo (public — shown on the login page).
import { prisma } from "@/lib/prisma";
import { SETTING_ID } from "@/lib/settings";

export async function GET() {
  const s = await prisma.setting.findUnique({
    where: { id: SETTING_ID },
    select: { logo: true, logoMimeType: true },
  });
  if (!s?.logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(s.logo), {
    headers: {
      "Content-Type": s.logoMimeType ?? "image/png",
      "Cache-Control": "no-store",
    },
  });
}
