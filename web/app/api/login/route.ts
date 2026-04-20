import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  const session = await getSession();
  session.loggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
