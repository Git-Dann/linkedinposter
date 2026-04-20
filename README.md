# LinkedIn Autoposter

A free, no-limit Buffer replacement. Runs entirely on GitHub Actions. Drafts
LinkedIn posts with Claude, posts one per day with a rotating image.

## How it works

1. You write a list of topics in `content/topics.md`.
2. You run `generate_drafts.py` locally — it uses Claude to draft each post and
   appends them to `content/queue.json` with status `"draft"`.
3. You review drafts, edit the text, change `"status": "draft"` to `"ready"` for
   any post you want published.
4. You commit and push.
5. Every day at 08:00 UTC, GitHub Actions posts the first `"ready"` item in the
   queue, attaches the next image from `images/`, and commits the updated queue.

## Setup

### 1. Fork or create this repo on GitHub

Push this folder to a **private** GitHub repo. (Public works too, but tokens in
Secrets are private either way. Private keeps the queue contents private.)

### 2. Create a LinkedIn Developer app

1. Go to https://www.linkedin.com/developers/apps and click **Create app**.
2. App name: anything. Company: use your own LinkedIn page (create a free
   throwaway page if you don't have one — LinkedIn insists on a company).
3. Tick the terms box, create.
4. Open the new app, go to the **Products** tab. Request access to:
   - **Sign In with LinkedIn using OpenID Connect** (instant)
   - **Share on LinkedIn** (usually instant, occasionally a few hours)
5. Go to the **Auth** tab:
   - Copy your **Client ID** and **Client Secret**
   - Under **Authorized redirect URLs**, add `http://localhost:8000/callback`
   - Scroll down to **OAuth 2.0 scopes** and confirm you see
     `openid profile email w_member_social`. If `w_member_social` is missing,
     the Share on LinkedIn product is still pending.

### 3. Get your tokens

On your laptop:

```bash
git clone <your-repo-url>
cd linkedin-autoposter
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export LINKEDIN_CLIENT_ID=xxx
export LINKEDIN_CLIENT_SECRET=xxx
python scripts/auth.py
```

A browser opens, you approve the app, the terminal prints three values:

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_REFRESH_TOKEN` (if your app has refresh enabled)
- `LINKEDIN_AUTHOR_URN`

### 4. Add GitHub repo secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
Add each of:

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_AUTHOR_URN`

You don't strictly need `CLIENT_ID`, `CLIENT_SECRET`, or `REFRESH_TOKEN` in
Secrets unless you want to run `refresh_token.py` from Actions. Keep those in
your local `.env` for now.

### 5. Get a Claude API key (for drafting)

Sign up at https://console.anthropic.com, create an API key, add billing
(batch drafting 10 posts costs roughly 2p).

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### 6. Drop your image(s) into `images/`

Any JPG/PNG/GIF. If you want one standard image every post, just put that
one file in there. If you want rotation, put a few — they cycle
alphabetically.

## Daily use

**Draft a batch:**

```bash
# Edit content/topics.md, add some topics
python scripts/generate_drafts.py
# Opens nothing - just appends to queue.json
```

**Review and approve:**

Open `content/queue.json` in your editor. For each post you want to go out,
change `"status": "draft"` to `"status": "ready"`. Edit the `text` freely.

**Ship it:**

```bash
git add content/
git commit -m "queue up posts"
git push
```

Next cron run (or trigger manually from the repo's **Actions** tab with
"Run workflow") picks the first `ready` item and posts it.

## Token expiry

LinkedIn access tokens last ~60 days. When yours is close to expiring:

- If your app has refresh tokens enabled: run `scripts/refresh_token.py`
  locally with the refresh token set, update the GitHub Secret with the new
  access token.
- If not: re-run `scripts/auth.py` and paste the new access token into
  GitHub Secrets.

A calendar reminder every 50 days is the simplest safeguard.

## Changing the schedule

Edit the cron line in `.github/workflows/post.yml`. Examples:

```yaml
- cron: "0 8 * * 1-5"   # 08:00 UTC, weekdays only
- cron: "0 8,15 * * *"  # twice a day, 08:00 and 15:00 UTC
```

GitHub Actions cron runs in UTC. British Summer Time is UTC+1, so a
"09:00 London" post means cron `0 8` in winter and `0 9` in summer — or just
pick the time you're happiest with year-round.

## Testing without posting

```bash
DRY_RUN=1 LINKEDIN_ACCESS_TOKEN=dummy LINKEDIN_AUTHOR_URN=dummy \
  python scripts/post_to_linkedin.py
```

Prints what would be posted.

## Troubleshooting

- **`403` on posting**: `w_member_social` scope missing. Re-check the
  Products tab in your LinkedIn app.
- **`401` on posting**: Access token expired. Refresh or re-auth.
- **No image attached**: `images/` is empty, or the file isn't one of
  `.jpg/.jpeg/.png/.gif`.
- **Workflow can't push commits**: make sure the workflow has
  `permissions: contents: write` (already set in the YAML) and your repo's
  **Settings → Actions → General → Workflow permissions** is set to
  "Read and write permissions".

## What it doesn't do (yet)

- Analytics. LinkedIn's API exposes impressions/reactions on your posts —
  easy to add a weekly summary job later.
- Threaded posts, polls, documents, video. UGC API supports all of these;
  this tool sticks to text + image because that's 95% of feed posting.
- Multi-account. One set of tokens = one LinkedIn account. Fork per account
  if you need more.
