const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/flac"
]);

export async function onRequestGet({ env, request }) {
  const db = env.songsave;
  if (!db) {
    return Response.json({ error: "D1 binding songsave is required" }, { status: 500 });
  }

  try {
    await ensureSongsTable(db);
    const url = new URL(request.url);
    const artist = (url.searchParams.get("artist") || "").trim();
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    let rows = await db.prepare(
      "SELECT id,title,artist,year,source_url,object_key,mime_type,size_bytes,created_at FROM songs ORDER BY created_at DESC LIMIT 500"
    ).all();

    let songs = rows.results || [];
    if (artist) songs = songs.filter(song => String(song.artist || "").toLowerCase() === artist.toLowerCase());
    if (q) {
      songs = songs.filter(song =>
        [song.title, song.artist, song.year].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }

    return Response.json(
      { songs },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return Response.json({ error: error?.message || "Could not read song database" }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  const db = env.songsave;
  const bucket = env.video;

  if (!db || !bucket) {
    return Response.json(
      { error: "D1 binding songsave and R2 binding video are required" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const title = clean(body.title, 200);
    const artist = clean(body.artist, 120);
    const year = clean(body.year, 4);
    const sourceUrl = clean(body.sourceUrl, 2000);
    const license = clean(body.license, 500);

    if (!title || !artist || !sourceUrl) {
      return Response.json(
        { error: "title, artist and sourceUrl are required" },
        { status: 400 }
      );
    }

    if (!/^https:\/\//i.test(sourceUrl)) {
      return Response.json({ error: "sourceUrl must use HTTPS" }, { status: 400 });
    }

    const source = new URL(sourceUrl);
    if (isBlockedSource(source)) {
      return Response.json(
        {
          error:
            "Direct downloading from YouTube is not supported. Use an audio file you own or are authorized to store, or keep the YouTube URL as metadata."
        },
        { status: 400 }
      );
    }

    if (!license) {
      return Response.json(
        { error: "Provide a short confirmation of your right to store this audio." },
        { status: 400 }
      );
    }

    await ensureSongsTable(db);

    const duplicate = await db.prepare(
      "SELECT id FROM songs WHERE source_url = ? LIMIT 1"
    ).bind(sourceUrl).first();

    if (duplicate) {
      return Response.json({ error: "That source has already been imported." }, { status: 409 });
    }

    const upstream = await fetch(sourceUrl, {
      headers: { accept: "audio/*,application/octet-stream;q=0.8" },
      redirect: "follow"
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: `Source server returned HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = normalizeContentType(upstream.headers.get("content-type"));
    const contentLength = Number(upstream.headers.get("content-length") || 0);

    if (contentLength > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Audio file is larger than 50 MB." }, { status: 413 });
    }

    if (contentType && !ALLOWED_AUDIO_TYPES.has(contentType)) {
      return Response.json(
        { error: `Unsupported audio content type: ${contentType}` },
        { status: 415 }
      );
    }

    const extension = extensionForType(contentType);
    const id = crypto.randomUUID();
    const objectKey = `songs/${id}${extension}`;

    await bucket.put(objectKey, upstream.body, {
      httpMetadata: {
        contentType: contentType || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable"
      },
      customMetadata: {
        title,
        artist,
        year: year || "",
        sourceUrl
      }
    });

    await db.prepare(
      `INSERT INTO songs
        (id,title,artist,year,source_url,object_key,mime_type,size_bytes,license_note,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`
    ).bind(
      id,
      title,
      artist,
      year || null,
      sourceUrl,
      objectKey,
      contentType || "application/octet-stream",
      contentLength || null,
      license
    ).run();

    return Response.json(
      {
        ok: true,
        song: {
          id,
          title,
          artist,
          year: year || null,
          sourceUrl,
          objectKey,
          mimeType: contentType || "application/octet-stream",
          sizeBytes: contentLength || null,
          streamUrl: `/api/songs/${id}`
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json({ error: error?.message || "Could not import song" }, { status: 500 });
  }
}

async function ensureSongsTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    year TEXT,
    source_url TEXT NOT NULL UNIQUE,
    object_key TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    size_bytes INTEGER,
    license_note TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function isBlockedSource(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be" ||
    host.endsWith(".youtu.be");
}

function normalizeContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function extensionForType(type) {
  switch (type) {
    case "audio/mpeg": return ".mp3";
    case "audio/mp4": return ".m4a";
    case "audio/aac": return ".aac";
    case "audio/ogg": return ".ogg";
    case "audio/opus": return ".opus";
    case "audio/wav":
    case "audio/x-wav": return ".wav";
    case "audio/webm": return ".webm";
    case "audio/flac": return ".flac";
    default: return ".audio";
  }
}
