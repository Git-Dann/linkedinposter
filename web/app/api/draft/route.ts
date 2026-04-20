import { NextResponse } from "next/server";
import { draftPost } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { topic, voice } = await req.json();
    if (!topic) {
      return NextResponse.json({ error: "topic required" }, { status: 400 });
    }
    const text = await draftPost(topic, voice);
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
