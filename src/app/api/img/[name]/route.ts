import { imageStorage } from "@/lib/storage";

/** 图片服务:经存储适配层(本地目录或对象存储) */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9_]+\.(png|jpe?g|webp)$/i.test(name)) {
    return new Response("bad name", { status: 400 });
  }
  const ext = name.split(".").pop()!.toLowerCase();
  const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  try {
    const buf = await imageStorage.get(name);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": MIME[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
