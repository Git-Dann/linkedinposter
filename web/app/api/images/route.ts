import { NextResponse } from "next/server";
import { deleteImage, listImages, uploadImage } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const images = await listImages();
    return NextResponse.json({ images });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "file too large (max 5 MB)" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const saved = await uploadImage(file.name, buf);
    return NextResponse.json({ ok: true, name: saved });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    await deleteImage(name);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
