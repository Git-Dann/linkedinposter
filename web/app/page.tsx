"use client";

import { useEffect, useState } from "react";

type Post = {
  id: string;
  topic: string;
  text: string;
  status: "draft" | "ready" | "posted";
  created_at: string;
  posted_at?: string;
  image?: string;
};

export default function Dashboard() {
  const [queue, setQueue] = useState<Post[]>([]);
  const [posted, setPosted] = useState<Post[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [newTopic, setNewTopic] = useState("");
  const [manualText, setManualText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [q, i] = await Promise.all([
        fetch("/api/queue").then((r) => r.json()),
        fetch("/api/images").then((r) => r.json()),
      ]);
      if (q.error) throw new Error(q.error);
      setQueue(q.queue || []);
      setPosted(q.posted || []);
      setImages(i.images || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveQueue(next: Post[], message: string) {
    setSaving(true);
    setError(null);
    const prev = queue;
    setQueue(next);
    try {
      const res = await fetch("/api/queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue: next, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save failed");
    } catch (e: any) {
      setError(e.message);
      setQueue(prev); // rollback
    } finally {
      setSaving(false);
    }
  }

  async function draftNow() {
    if (!newTopic.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newTopic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "draft failed");

      const newPost: Post = {
        id: Math.random().toString(36).slice(2, 10),
        topic: newTopic.trim(),
        text: data.text,
        status: "draft",
        created_at: new Date().toISOString(),
      };
      await saveQueue([...queue, newPost], `ui: draft "${newPost.topic.slice(0, 40)}"`);
      setNewTopic("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDrafting(false);
    }
  }

  async function addManual() {
    if (!manualText.trim()) return;
    const topic = newTopic.trim() || manualText.trim().slice(0, 60);
    const newPost: Post = {
      id: Math.random().toString(36).slice(2, 10),
      topic,
      text: manualText.trim(),
      status: "draft",
      created_at: new Date().toISOString(),
    };
    await saveQueue([...queue, newPost], `ui: manual draft "${topic.slice(0, 40)}"`);
    setNewTopic("");
    setManualText("");
  }

  async function updatePost(id: string, patch: Partial<Post>) {
    const next = queue.map((p) => (p.id === id ? { ...p, ...patch } : p));
    await saveQueue(next, `ui: update post ${id}`);
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    const next = queue.filter((p) => p.id !== id);
    await saveQueue(next, `ui: delete post ${id}`);
  }

  async function moveUp(id: string) {
    const readyIds = queue.filter((p) => p.status === "ready").map((p) => p.id);
    const i = readyIds.indexOf(id);
    if (i <= 0) return;
    const reorder = [...queue];
    const aIdx = reorder.findIndex((p) => p.id === readyIds[i - 1]);
    const bIdx = reorder.findIndex((p) => p.id === id);
    [reorder[aIdx], reorder[bIdx]] = [reorder[bIdx], reorder[aIdx]];
    await saveQueue(reorder, "ui: reorder queue");
  }

  async function uploadImage(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/images", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    refresh();
  }

  async function removeImage(name: string) {
    if (!confirm(`Delete image ${name}?`)) return;
    const res = await fetch("/api/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) setError("delete failed");
    refresh();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const drafts = queue.filter((p) => p.status === "draft");
  const ready = queue.filter((p) => p.status === "ready");

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">LinkedIn Poster</h1>
        <div className="flex items-center gap-3 text-sm">
          {saving && <span className="text-neutral-500">saving...</span>}
          <button
            onClick={refresh}
            className="text-neutral-600 hover:underline dark:text-neutral-400"
          >
            Refresh
          </button>
          <button
            onClick={logout}
            className="text-neutral-600 hover:underline dark:text-neutral-400"
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* New post */}
      <section className="mb-8 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800 w-fit">
          <button
            onClick={() => setMode("ai")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "ai"
                ? "bg-white shadow-sm dark:bg-neutral-950"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            Draft with AI
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "manual"
                ? "bg-white shadow-sm dark:bg-neutral-950"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            Write manually
          </button>
        </div>

        {mode === "ai" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="Topic, e.g. Why most B2B onboarding is broken"
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
              disabled={drafting}
            />
            <button
              onClick={draftNow}
              disabled={drafting || !newTopic.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {drafting ? "Drafting..." : "Draft with AI"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="Label (optional - for your reference in the queue)"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
            />
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={8}
              placeholder="Write your post here..."
              className="w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {manualText.length} chars
              </span>
              <button
                onClick={addManual}
                disabled={!manualText.trim()}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                Add to drafts
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Drafts */}
      <Section title="Drafts" count={drafts.length}>
        {loading && <p className="text-sm text-neutral-500">loading...</p>}
        {!loading && drafts.length === 0 && (
          <p className="text-sm text-neutral-500">No drafts. Start by writing a topic above.</p>
        )}
        {drafts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onUpdate={(patch) => updatePost(p.id, patch)}
            onDelete={() => deletePost(p.id)}
          >
            <button
              onClick={() => updatePost(p.id, { status: "ready" })}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Approve → Ready
            </button>
          </PostCard>
        ))}
      </Section>

      {/* Ready */}
      <Section title="Ready (next up first)" count={ready.length}>
        {!loading && ready.length === 0 && (
          <p className="text-sm text-neutral-500">Nothing queued. Approve a draft to add it here.</p>
        )}
        {ready.map((p, i) => (
          <PostCard
            key={p.id}
            post={p}
            onUpdate={(patch) => updatePost(p.id, patch)}
            onDelete={() => deletePost(p.id)}
            badge={i === 0 ? "posts next" : undefined}
          >
            <button
              onClick={() => updatePost(p.id, { status: "draft" })}
              className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Back to draft
            </button>
            <button
              onClick={() => moveUp(p.id)}
              disabled={i === 0}
              className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Move up
            </button>
          </PostCard>
        ))}
      </Section>

      {/* Posted */}
      <Section title="Posted" count={posted.length}>
        {posted.length === 0 && (
          <p className="text-sm text-neutral-500">No posts yet.</p>
        )}
        {posted
          .slice()
          .reverse()
          .map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                <span>{p.topic}</span>
                <span>{p.posted_at?.slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {p.text}
              </p>
            </div>
          ))}
      </Section>

      {/* Images */}
      <Section title="Images" count={images.length}>
        <p className="mb-3 text-xs text-neutral-500">
          Posts rotate through these in alphabetical order.
        </p>
        <ul className="mb-3 space-y-1 text-sm">
          {images.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
            >
              <span className="font-mono text-xs">{name}</span>
              <button
                onClick={() => removeImage(name)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
          {images.length === 0 && <li className="text-neutral-500">No images yet.</li>}
        </ul>
        <label className="inline-block cursor-pointer rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900">
          Upload image
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(f);
              e.target.value = "";
            }}
          />
        </label>
      </Section>
    </main>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
        {title}
        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {count}
        </span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PostCard({
  post,
  onUpdate,
  onDelete,
  badge,
  children,
}: {
  post: Post;
  onUpdate: (patch: Partial<Post>) => void;
  onDelete: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  const [text, setText] = useState(post.text);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setText(post.text);
    setDirty(false);
  }, [post.text]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">{post.topic}</p>
          {badge && (
            <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-400">{text.length} chars</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        rows={Math.max(6, Math.ceil(text.length / 80))}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dirty && (
          <button
            onClick={() => onUpdate({ text })}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Save edits
          </button>
        )}
        {children}
        <button
          onClick={onDelete}
          className="ml-auto text-xs text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
