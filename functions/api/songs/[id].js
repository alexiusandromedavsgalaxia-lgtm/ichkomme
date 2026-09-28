export async function onRequestGet({ env, params }) {
  const db = env.video;

  if (!db) return Response.json({ error: "D1 binding video is required" }, { status: 500 });

  const id = String(params.id || "");
  if (!/^[0-9a-f-]{20,80}$/i.test(id)) {
    return Response.json({ error: "Invalid song id" }, { status: 400 });
  }

  try {
    const row = await db.prepare(
      "SELECT id,title,artist,year,audio_url,video_url,credits,created_at FROM songs WHERE id = ? LIMIT 1"
    ).bind(id).first();

    if (!row) return Response.json({ error: "Song not found" }, { status: 404 });

    return Response.json({
      ...row,
      video_embed_url: toYouTubeEmbedUrl(row.video_url)
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error?.message || "Could not read song" }, { status: 500 });
  }
}

function isYouTubeUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host.endsWith(".youtu.be");
  } catch {
    return false;
  }
}

function toYouTubeEmbedUrl(value) {
  if (!value || !isYouTubeUrl(value)) return null;

  try {
    const url = new URL(value);
    let id = "";
    if (url.hostname.replace(/^www\./, "") === "youtu.be") id = url.pathname.slice(1);
    else if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] || "";
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] || "";
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
