export async function onRequestGet({ env, request }) {
  const db = env.video;
  if (!db) return Response.json({ error: "D1 binding video is required" }, { status: 500 });
  try {
    await ensureSongsTable(db);
    const url = new URL(request.url);
    const artist = (url.searchParams.get("artist") || "").trim().toLowerCase();
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const rows = await db.prepare("SELECT id,title,artist,year,audio_url,video_url,credits,created_at FROM songs ORDER BY created_at DESC LIMIT 500").all();
    let songs = rows.results || [];
    if (artist) songs = songs.filter(s => String(s.artist || "").toLowerCase() === artist);
    if (q) songs = songs.filter(s => [s.title,s.artist,s.year,s.credits].filter(Boolean).join(" ").toLowerCase().includes(q));
    return Response.json({ songs: songs.map(s => ({ ...s, video_embed_url: youtubeEmbed(s.video_url) })) });
  } catch (error) {
    return Response.json({ error: error?.message || "Could not read song database" }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  const db = env.video;
  if (!db) return Response.json({ error: "D1 binding video is required" }, { status: 500 });
  try {
    const body = await request.json();
    const title = clean(body.title, 200);
    const artist = clean(body.artist, 120);
    const year = clean(body.year, 4);
    const audioUrl = clean(body.audioUrl, 2000);
    const videoUrl = clean(body.videoUrl, 2000);
    const credits = clean(body.credits, 1000);

    if (!title || !artist) return Response.json({ error: "title and artist are required" }, { status: 400 });
    if (audioUrl && !/^https:\/\//i.test(audioUrl)) return Response.json({ error: "audioUrl must use HTTPS" }, { status: 400 });
    if (videoUrl && !/^https:\/\//i.test(videoUrl)) return Response.json({ error: "videoUrl must use HTTPS" }, { status: 400 });

    await ensureSongsTable(db);
    const duplicate = await db.prepare("SELECT id FROM songs WHERE title = ? AND artist = ? LIMIT 1").bind(title, artist).first();
    if (duplicate) return Response.json({ error: "That song is already in the database." }, { status: 409 });

    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO songs (id,title,artist,year,audio_url,video_url,credits,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))")
      .bind(id, title, artist, year || null, audioUrl || null, videoUrl || null, credits || null).run();

    return Response.json({ ok: true, song: { id, title, artist, year: year || null, audioUrl: audioUrl || null, videoUrl: videoUrl || null, videoEmbedUrl: youtubeEmbed(videoUrl), credits: credits || null } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error?.message || "Could not save song" }, { status: 500 });
  }
}

async function ensureSongsTable(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS songs (id TEXT PRIMARY KEY,title TEXT NOT NULL,artist TEXT NOT NULL,year TEXT,audio_url TEXT,video_url TEXT,credits TEXT,created_at TEXT NOT NULL)").run();
}
function clean(value, max) { return String(value ?? "").trim().slice(0, max); }
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
