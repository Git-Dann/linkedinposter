# LinkedIn Poster — Web UI

Password-protected dashboard for managing your LinkedIn post queue. Runs on
Vercel's free tier. Reads and writes `content/queue.json` and `images/` in
this same repo via the GitHub API. Posting itself still happens in GitHub
Actions (see the repo root README).

## Deploy

### 1. Push this repo to GitHub

Already done if you're reading this.

### 2. Create a GitHub personal access token

Go to https://github.com/settings/tokens?type=beta → **Generate new token**
(fine-grained).

- **Repository access**: Only select repositories → `linkedinposter`
- **Permissions → Repository permissions**:
  - Contents: **Read and write**
  - Metadata: Read-only (auto-selected)
- **Generate** and copy the token (starts with `github_pat_...`).

### 3. Deploy to Vercel

1. Sign in to https://vercel.com with your GitHub account.
2. **Add New → Project** → import `linkedinposter`.
3. **Root Directory**: click Edit and set to `web`.
4. Framework preset: Next.js (auto-detected).
5. Environment variables — add all of these:

   | Key                 | Value                                         |
   | ------------------- | --------------------------------------------- |
   | `GITHUB_TOKEN`      | `github_pat_...` from step 2                  |
   | `GITHUB_OWNER`      | `Git-Dann`                                    |
   | `GITHUB_REPO`       | `linkedinposter`                              |
   | `GITHUB_BRANCH`     | `main`                                        |
   | `ANTHROPIC_API_KEY` | your Claude API key                           |
   | `APP_PASSWORD`      | whatever password you want to use to log in   |
   | `SESSION_PASSWORD`  | 32+ char random string (see below)            |

   Generate a session password locally:

   ```bash
   openssl rand -base64 32
   ```

6. **Deploy**. Takes about a minute.

Vercel gives you a URL like `linkedinposter.vercel.app`. Open it, enter your
`APP_PASSWORD`, and you're in.

### 4. Stop Vercel redeploying on every queue commit

Optional but nice. Vercel redeploys the UI every time GitHub Actions commits
a queue update, which wastes build minutes. In Vercel:

**Project → Settings → Git → Ignored Build Step** → paste:

```bash
git diff HEAD^ HEAD --quiet -- web/ ; if [ $? = 1 ]; then exit 1; else exit 0; fi
```

That tells Vercel to skip the build unless files inside `web/` changed.

## What the UI does

- **New post from topic**: type a topic, click "Draft with AI", Claude writes a post.
- **Drafts**: edit freely. When happy, click "Approve → Ready".
- **Ready**: queued posts, first one posts tomorrow at 08:00 UTC. Reorder with "Move up".
- **Posted**: read-only archive.
- **Images**: upload/delete. Daily job rotates through them alphabetically.

Everything writes directly to GitHub, so the cron job always sees the
current state.

## Local development

```bash
cd web
cp .env.example .env.local
# fill in values
npm install
npm run dev
```

Opens on http://localhost:3000.

## Troubleshooting

- **"unauthorized" on every API call**: `SESSION_PASSWORD` missing or too
  short. Must be 32+ chars.
- **GitHub writes fail with 404**: `GITHUB_OWNER` or `GITHUB_REPO` wrong, or
  your PAT doesn't have access to this repo.
- **GitHub writes fail with 409**: someone else (you, the cron job) committed
  since the UI loaded the queue. Hit Refresh and try again.
- **Drafting fails**: `ANTHROPIC_API_KEY` missing or out of credit.
