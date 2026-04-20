import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_VOICE = `
Write in British English. Direct, clear, conversational tone.
Short paragraphs. Plain language. No fluff, no hype.
Sound like a smart colleague, not a corporate brochure.
No emojis unless the topic really calls for one. Max one.
No em dashes. Avoid overblown words like "crucial", "vital",
"unlock", "unleash", "dive", "delve", "journey", "navigate".
`;

const SYSTEM = `
You are drafting a single LinkedIn post. Rules:
- 700-1200 characters (LinkedIn shows ~210 chars before "see more" - hook hard).
- Open with a sharp hook. Earn the click to "see more".
- One idea per post. No listicles unless the topic is naturally a list.
- Line breaks between beats. Do not use markdown headers.
- No hashtags unless I tell you otherwise. If including, max 3, at the end.
- Do not write the post title or any preamble. Output ONLY the post body.
`;

export async function draftPost(topic: string, voice?: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM + "\n\nVOICE GUIDE:\n" + (voice || DEFAULT_VOICE),
    messages: [{ role: "user", content: `Draft a LinkedIn post on: ${topic}` }],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
  return text;
}
