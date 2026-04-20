import { Octokit } from "@octokit/rest";

const owner = process.env.GITHUB_OWNER!;
const repo = process.env.GITHUB_REPO!;
const branch = process.env.GITHUB_BRANCH || "main";

function client() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN! });
}

// --- queue.json ---

export type Post = {
  id: string;
  topic: string;
  text: string;
  status: "draft" | "ready" | "posted";
  created_at: string;
  posted_at?: string;
  post_urn?: string;
  image?: string;
};

type FileResult = { content: string; sha: string };

async function getFile(path: string): Promise<FileResult | null> {
  const octo = client();
  try {
    const res = await octo.repos.getContent({ owner, repo, path, ref: branch });
    if (Array.isArray(res.data) || res.data.type !== "file") return null;
    const content = Buffer.from(res.data.content, "base64").toString("utf-8");
    return { content, sha: res.data.sha };
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function putFile(
  path: string,
  content: string | Buffer,
  message: string,
  sha?: string
) {
  const octo = client();
  const contentStr =
    typeof content === "string"
      ? Buffer.from(content, "utf-8").toString("base64")
      : content.toString("base64");
  await octo.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: contentStr,
    sha,
    branch,
    committer: { name: "linkedinposter-ui", email: "ui@linkedinposter.local" },
    author: { name: "linkedinposter-ui", email: "ui@linkedinposter.local" },
  });
}

export async function readQueue(): Promise<{ queue: Post[]; sha: string | null }> {
  const file = await getFile("content/queue.json");
  if (!file) return { queue: [], sha: null };
  const parsed = file.content.trim() ? JSON.parse(file.content) : [];
  return { queue: parsed, sha: file.sha };
}

export async function writeQueue(queue: Post[], sha: string | null, message: string) {
  const body = JSON.stringify(queue, null, 2) + "\n";
  await putFile("content/queue.json", body, message, sha ?? undefined);
}

export async function readPosted(): Promise<Post[]> {
  const file = await getFile("content/posted.json");
  if (!file) return [];
  return file.content.trim() ? JSON.parse(file.content) : [];
}

// --- images ---

export async function listImages(): Promise<string[]> {
  const octo = client();
  try {
    const res = await octo.repos.getContent({
      owner,
      repo,
      path: "images",
      ref: branch,
    });
    if (!Array.isArray(res.data)) return [];
    return res.data
      .filter((f) => f.type === "file" && /\.(png|jpe?g|gif)$/i.test(f.name))
      .map((f) => f.name)
      .sort();
  } catch {
    return [];
  }
}

export async function uploadImage(name: string, data: Buffer) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `images/${safe}`;
  const existing = await getFile(path);
  await putFile(path, data, `ui: upload image ${safe}`, existing?.sha);
  return safe;
}

export async function deleteImage(name: string) {
  const octo = client();
  const path = `images/${name}`;
  const existing = await getFile(path);
  if (!existing) return;
  await octo.repos.deleteFile({
    owner,
    repo,
    path,
    message: `ui: remove image ${name}`,
    sha: existing.sha,
    branch,
  });
}
