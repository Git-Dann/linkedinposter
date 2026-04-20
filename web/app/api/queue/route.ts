import { NextResponse } from "next/server";
import { readQueue, writeQueue, readPosted, type Post } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ queue }, posted] = await Promise.all([readQueue(), readPosted()]);
    return NextResponse.json({ queue, posted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { queue: newQueue, message } = (await req.json()) as {
      queue: Post[];
      message?: string;
    };
    const { sha } = await readQueue();
    await writeQueue(newQueue, sha, message || "ui: update queue");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
