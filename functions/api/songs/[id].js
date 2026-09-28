export async function onRequestGet({ env, params }) {
  const db = env.video;
  if (!db) return Response.json({ error: "D1 binding video is required" }, { status: 500 });
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return Response.json({ error: "Invalid song id" }, { status: 400 });

  try {
    const row = await db.prepare("SELECT id,title,artist,year,audio_url,video_url,credits,created_at FROM songs WHERE id = ? LIMIT 1").bind(id).first();
    if (!row) return Response.json({ error: "Song not found" }, { status: 404 });
    return Response.json({ ...row, video_embed_url: youtubeEmbed(row.video_url) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error?.message || "Could not read song" }, { status: 500 });
  }
}

function youtubeEmbed(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || "";
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? "https://www.youtube.com/embed/" + id : null;
  } catch { return null; }
}
