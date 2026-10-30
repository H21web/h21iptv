# Clean JioTV Playlist Worker

A small Cloudflare Worker that serves **your own** JioTV Go playlist
in a clean form for your IPTV player. This is the clean version:
no shared cookies, no third-party playlists, no DRM keys, and no
credentials in the code. Your Jio login stays on your own JioTV Go
server (Voroa / AlwaysData / Render) — this Worker only fetches
that server's playlist and optionally filters it.

## How it works

```
Your JioTV Go server (your own Jio login, Mumbai IP)
        ↓  /playlist.m3u
This Worker (Cloudflare, free)
        ↓  /playlist.m3u  (optionally filtered)
Your IPTV player (TiviMate / VLC, in India)
        ↓  streams directly from Jio CDN
Video plays
```

The Worker never streams video itself and never logs in to Jio.
If your server is asleep or logged out, the Worker will say so
instead of serving a stale playlist.

## What you need first

1. A **Cloudflare account** (free tier is enough).
2. A **GitHub account**.
3. Your **own JioTV Go server already running and logged in**
   (your Voroa pack, or your AlwaysData site). You need its
   playlist URL, for example:
   `https://<your-service>.getvoroa.com/playlist.m3u`
   - Do NOT put this URL in the code, in a public repo, or in
     chat. It goes in as a secret (step 4 below).
   - If you have not got the server playing yet, fix that first
     — this Worker cannot fix a server that returns 451 or is
     not logged in.

## Installation — Option A: GitHub Actions (recommended)

### Step 1 — Create the repo
1. On GitHub, create a **new private repo**, e.g. `jiotv-playlist`.
   Private is important: even though no secret is in the code,
   your playlist is personal.
2. On your PC, in a folder, save all the files from this pack:
   `wrangler.toml`, `package.json`, `src/index.js`,
   `.github/workflows/deploy.yml`, `.gitignore`, `README.md`.
3. Push them to the new repo:
   ```
   git init
   git add .
   git commit -m "Clean JioTV playlist worker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/jiotv-playlist.git
   git push -u origin main
   ```
   Replace `<your-username>` with your GitHub username.

### Step 2 — Get your Cloudflare API token and Account ID
1. Cloudflare dashboard → My Profile → API Tokens → Create Token.
   Use the **Edit Cloudflare Workers** template.
   Copy the token — it is shown only once.
2. Cloudflare dashboard → Account home: the Account ID is shown
   on the right-hand side of the account page. Copy it.

### Step 3 — Add GitHub secrets
In your new repo → Settings → Secrets and variables → Actions →
New repository secret. Add these three, exactly as named:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The token from Step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | The Account ID from Step 2 |
| `PLAYLIST_URL` | Your own JioTV Go playlist URL, e.g. `https://<your-service>.getvoroa.com/playlist.m3u` |

Never paste your Jio number, OTP, or any Jio token here — only
the playlist URL of your own server.

### Step 4 — Deploy
Pushing to `main` already triggers the workflow, so after Step 3
make any tiny change (or just re-run the workflow from the
Actions tab) and wait for it to go green.

Your Worker URL will be something like:
`https://jiotv-playlist.<your-cloudflare-subdomain>.workers.dev`

### Step 5 — Test
1. Open `https://jiotv-playlist.<your-subdomain>.workers.dev/health`
   — it should say `ok`.
2. Open `https://jiotv-playlist.<your-subdomain>.workers.dev/playlist.m3u`
   — it should show `#EXTM3U` and channel lines.
3. If it shows an error instead, see Troubleshooting below.

### Step 6 — Use it in your player
In TiviMate / VLC, add a playlist with this URL:
`https://jiotv-playlist.<your-subdomain>.workers.dev/playlist.m3u`

Optional filters:
- Only some groups: `.../playlist.m3u?group=News,Movies`
- Quality / language are passed through to your server, e.g.:
  `.../playlist.m3u?q=medium&l=Malayalam,English`

## Installation — Option B: Wrangler CLI (no GitHub Actions)

1. Install Node.js 20+, then in the repo folder:
   ```
   npm install
   npx wrangler login
   ```
2. Set the secret (you will be prompted to paste it — it is not
   stored in any file):
   ```
   npx wrangler secret put PLAYLIST_URL
   ```
   Paste your own playlist URL when asked.
3. Deploy:
   ```
   npm run deploy
   ```
4. Test as in Option A, Step 5.

## Keep it private

Once your server is logged in, **anyone with your Worker URL
can load your playlist** — there is no password in front of it
in this clean version. So:

- Do NOT post the Worker URL or your server URL in a group,
  channel, or public repo.
- This is for your own personal use on your own Jio account.
  Do not resell it, share it, or use it to redistribute channels.
- If a URL ever leaks, change it: redeploy the Worker with a
  new name, or log out on your JioTV Go server and log in again.

## Troubleshooting

| What you see | What it usually means | Fix |
|---|---|---|
| `PLAYLIST_URL is not set` | The Worker secret was not set, or the deploy ran before the secret was added | Add the `PLAYLIST_URL` secret (GitHub or `wrangler secret put`), then redeploy |
| `Could not reach your JioTV Go server` / server returned a non-200 | Your server is asleep, down, or not logged in | Wake it up, open it in a browser, log in with OTP on the server itself, then retry |
| Playlist loads but a channel errors in the player | The server-side stream failed (e.g. the 451 geo-block on a non-Indian server, or a subscription/DRM channel) | Check that channel on your server's own web player first — this Worker cannot fix a server-side stream failure |
| GitHub Actions deploy fails on the token step | Wrong token scope or wrong Account ID | Recreate the token with the Edit Cloudflare Workers template and double-check the Account ID |
| Empty playlist (`#EXTM3U` only) | Your server returned an empty playlist, often because it is not logged in | Log in on your server, then reload `/playlist.m3u` |

## What is deliberately NOT in this repo

- No shared Jio cookies or tokens from other people's repos.
- No channel list, stream URLs, or DRM keys hard-coded in code.
- No third-party playlists (FanCode, SonyLIV, Hotstar, etc.).
- No private playlist URLs belonging to anyone else.
- No credentials of any kind in git — only secret names.

If you want those other sources, you would have to add them
yourself, with your own accounts and your own secrets — this
clean version does not do that for you.

## Files

- `wrangler.toml` — Worker name, entry point, compatibility date
- `package.json` — Wrangler as the only dev dependency
- `src/index.js` — The whole Worker: fetch, filter, serve
- `.github/workflows/deploy.yml` — Deploy on push to `main`
- `.gitignore` — Keeps `node_modules`, `.wrangler`, `.dev.vars` out of git
