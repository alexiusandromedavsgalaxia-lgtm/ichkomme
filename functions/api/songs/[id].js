export async function onRequestGet({ env, params }) {
  const db = env.songsave;
  const bucket = env.video;

  if (!db || !bucket) {
    return new Response("songsave and video bindings are required", { status: 500 });
  }

  const id = String(params.id || "");
  if (!id || !/^[0-9a-f-]{20,80}$/i.test(id)) {
    return new Response("Invalid song id", { status: 400 });
  }

  try {
    const row = await db.prepare(
      "SELECT object_key,title,artist,mime_type FROM songs WHERE id = ? LIMIT 1"
    ).bind(id).first();

    if (!row) return new Response("Song not found", { status: 404 });

    const object = await bucket.get(row.object_key);
    if (!object) return new Response("Audio object not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("content-disposition", `inline; filename="${safeFilename(row.artist)} - ${safeFilename(row.title)}.audio"`);

    return new Response(object.body, { headers });
  } catch (error) {
    return new Response(error?.message || "Could not read audio", { status: 500 });
  }
}

function safeFilename(value) {
  return String(value || "song")
    .replace(/[^a-z0-9 _.-]/gi, "")
    .trim()
    .slice(0, 80) || "song";
}
