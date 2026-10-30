// Clean JioTV playlist Worker — personal use only.
//
// What this does, and what it does NOT do:
// - It fetches ONE playlist: your OWN JioTV Go server (Voroa /
//   AlwaysData / Render), set as the PLAYLIST_URL Worker secret.
//   That server is where you log in with your own Jio account.
// - It optionally filters that playlist by group and passes
//   through quality/language query params to your server.
// - It does NOT log in to Jio itself, does NOT use shared
//   cookies or tokens from other repos, and does NOT contain
//   any DRM keys, channel URLs, or credentials in code.
//   Everything sensitive lives in Worker secrets, never in git.
//
// Routes:
//   GET /             -> short info (no playlist, no secrets)
//   GET /health       -> "ok" (for a quick uptime check)
//   GET /playlist.m3u -> your filtered playlist, as text
//     Query params (all optional, passed to your server too):
//       ?group=News,Movies     keep only these group-titles
//       ?q=low|medium|high     quality, if your server supports it
//       ?l=Malayalam,English   language filter, if supported

function parseGroups(param) {
  if (!param) return null;
  const groups = param
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);
  return groups.length ? new Set(groups) : null;
}

// Keep only #EXTINF entries whose group-title is in `groups`.
// An #EXTINF line and the stream URL line after it are one entry.
function filterByGroup(m3u, groups) {
  const lines = m3u.split(/\r?\n/);
  const out = [];
  let keep = true;
  for (const line of lines) {
    if (line.startsWith("#EXTM3U")) {
      out.push(line);
      continue;
    }
    if (line.startsWith("#EXTINF")) {
      const match = line.match(/group-title="([^"]*)"/i);
      const group = match ? match[1].toLowerCase() : "";
      keep = !groups || groups.has(group);
      if (keep) out.push(line);
      continue;
    }
    if (line.startsWith("#")) {
      if (keep) out.push(line);
      continue;
    }
    // Stream URL line (or blank line).
    if (keep) out.push(line);
  }
  return out.join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (url.pathname !== "/playlist.m3u") {
      return new Response(
        "JioTV playlist Worker.\n\n" +
          "Use /playlist.m3u in your IPTV player.\n" +
          "Optional: /playlist.m3u?group=News,Movies\n",
        { headers: { "Content-Type": "text/plain" } },
      );
    }

    if (!env.PLAYLIST_URL) {
      return new Response(
        "PLAYLIST_URL is not set. Set it as a Worker secret " +
          "(see README.md), then redeploy.",
        { status: 500, headers: { "Content-Type": "text/plain" } },
      );
    }

    // Pass the caller's query string through to your own server,
    // so ?q= and ?l= keep working the way your server defines them.
    const upstream = new URL(env.PLAYLIST_URL);
    for (const [key, value] of url.searchParams) {
      if (key !== "group") upstream.searchParams.set(key, value);
    }

    let response;
    try {
      response = await fetch(upstream.toString(), {
        headers: { "Cache-Control": "no-cache" },
        cf: { cacheTtl: 0, cacheEverything: false },
      });
    } catch (e) {
      return new Response(
        "Could not reach your JioTV Go server. Is it awake " +
          "and logged in? Error: " + e.message,
        { status: 502, headers: { "Content-Type": "text/plain" } },
      );
    }

    if (!response.ok) {
      return new Response(
        "Your JioTV Go server returned " + response.status +
          ". Check that it is awake and you are logged in on it.",
        { status: 502, headers: { "Content-Type": "text/plain" } },
      );
    }

    let m3u = await response.text();
    const groups = parseGroups(url.searchParams.get("group"));
    if (groups) m3u = filterByGroup(m3u, groups);

    return new Response(m3u, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache",
      },
    });
  },
};
