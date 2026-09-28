export async function onRequestGet({ env, request }) {
  const artistDb = env.artist;
  const dataDb = env.artistdata;
  if (!artistDb || !dataDb) {
    return Response.json({ error: "D1 bindings artist and artistdata are required" }, { status: 500 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const year = url.searchParams.get("year") || "";
  const artistId = url.searchParams.get("artist") || "";

  try {
    await ensureCommunityTable(artistDb);
    const artistTables = await artistDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    const dataTables = await dataDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();

    const artists = await readBestTable(artistDb, artistTables.results || [], {
      idCandidates: ["id", "artist_id"],
      nameCandidates: ["name", "artist_name", "display_name"],
      countryCandidates: ["country", "country_name"],
    });

    const events = await readBestTable(dataDb, dataTables.results || [], {
      idCandidates: ["id", "event_id"],
      nameCandidates: ["title", "name", "event_name", "song", "song_title"],
      artistCandidates: ["artist_id", "artist", "artist_name"],
      yearCandidates: ["year", "event_year"],
      countryCandidates: ["country", "country_name"],
      dateCandidates: ["date", "event_date", "start_date"],
      typeCandidates: ["type", "event_type", "category"],
      venueCandidates: ["venue", "location", "place"],
    });

    const customRows = await artistDb.prepare("SELECT * FROM custom_artists ORDER BY created_at DESC LIMIT 1000").all();
    const normalizedArtists = artists.map(normalizeArtist).filter(a => a.name !== "Unknown artist");
    normalizedArtists.push(...(customRows.results || []).map(normalizeArtist));
    const normalizedEvents = events.map(normalizeEvent).filter(e => e.title !== "Untitled event");

    let filteredEvents = normalizedEvents;
    if (artistId) filteredEvents = filteredEvents.filter(e =>
      String(e.artistId || "") === artistId ||
      String(e.artist || "").toLowerCase() === artistId.toLowerCase()
    );
    if (year && /^20\d{2}$/.test(year)) filteredEvents = filteredEvents.filter(e => String(e.year) === year);
    if (q) {
      filteredEvents = filteredEvents.filter(e =>
        [e.title, e.artist, e.country, e.venue, e.type].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }

    return Response.json({
      artists: normalizedArtists,
      events: filteredEvents,
      tables: { artist: artistTables.results || [], artistdata: dataTables.results || [] },
      source: { artist: "env.artist", artistdata: "env.artistdata" }
    }, { headers: { "cache-control": "public, max-age=30" } });
  } catch (error) {
    return Response.json({ error: error?.message || "D1 query failed" }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  const artistDb = env.artist;
  const dataDb = env.artistdata;
  if (!artistDb || !dataDb) {
    return Response.json({ error: "D1 bindings artist and artistdata are required" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const name = clean(body.name, 100);
    const country = clean(body.country, 80);
    const photo = clean(body.photo, 1000);
    const bio = clean(body.bio, 600);
    const eurovision = clean(body.eurovision, 20);
    const songs = clean(body.songs, 600);
    const tags = clean(body.tags, 300);

    if (!name || name.length < 2) return Response.json({ error: "Artist name is required" }, { status: 400 });
    if (!country || country.length < 2) return Response.json({ error: "Country is required" }, { status: 400 });
    if (photo && !/^https?:\/\//i.test(photo)) return Response.json({ error: "Photo URL must start with http:// or https://" }, { status: 400 });

    await ensureCommunityTable(artistDb);
    const duplicate = await artistDb.prepare(
      "SELECT id FROM custom_artists WHERE lower(name)=lower(?) LIMIT 1"
    ).bind(name).first();
    if (duplicate) return Response.json({ error: "That artist has already been added." }, { status: 409 });

    const id = crypto.randomUUID();
    await artistDb.prepare(
      "INSERT INTO custom_artists (id,name,country,photo,bio,eurovision,songs,tags,created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))"
    ).bind(id, name, country, photo || null, bio || null, eurovision || null, songs || null, tags || null).run();

    return Response.json({ ok: true, artist: {
      id, name, country, photo: photo || "", bio: bio || "",
      eurovision: eurovision || "—",
      songs: splitList(songs), tags: splitList(tags),
      community: true
    }}, { status: 201 });
  } catch (error) {
    return Response.json({ error: error?.message || "Could not add artist" }, { status: 500 });
  }
}

async function ensureCommunityTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS custom_artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL,
    photo TEXT,
    bio TEXT,
    eurovision TEXT,
    songs TEXT,
    tags TEXT,
    created_at TEXT NOT NULL
  )`).run();
}

async function readBestTable(db, tables, candidates) {
  let best = [];
  let bestScore = -1;

  for (const row of tables) {
    const table = row.name;
    try {
      const pragma = await db.prepare(`PRAGMA table_info("${escapeIdent(table)}")`).all();
      const columns = (pragma.results || []).map(c => c.name);
      const score = scoreTable(columns, candidates);
      if (score <= bestScore) continue;
      const rows = await db.prepare(`SELECT * FROM "${escapeIdent(table)}" LIMIT 1000`).all();
      best = rows.results || [];
      bestScore = score;
    } catch {
      // Ignore unrelated/incompatible tables.
    }
  }
  return best;
}

function scoreTable(columns, c) {
  const lower = columns.map(x => String(x).toLowerCase());
  return [
    c.idCandidates, c.nameCandidates, c.artistCandidates, c.yearCandidates,
    c.countryCandidates, c.dateCandidates, c.typeCandidates, c.venueCandidates
  ].filter(Boolean).reduce((score, group) =>
    score + (group.some(x => lower.includes(x)) ? 2 : 0), 0
  );
}

function pick(row, names) {
  if (!names) return null;
  const key = Object.keys(row).find(k => names.includes(String(k).toLowerCase()));
  return key ? row[key] : null;
}

function splitList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
}

function clean(value, max) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, max);
}

function normalizeArtist(row) {
  const songsValue = pick(row, ["songs", "song_list", "tracks", "top_songs"]);
  const tagsValue = pick(row, ["tags", "genres", "labels"]);
  return {
    ...row,
    id: pick(row, ["id", "artist_id"]),
    name: pick(row, ["name", "artist_name", "display_name"]) || "Unknown artist",
    country: pick(row, ["country", "country_name"]) || "",
    flag: pick(row, ["flag", "country_flag", "emoji"]) || "🌍",
    photo: pick(row, ["photo", "image", "image_url", "photo_url", "avatar", "avatar_url"]) || "",
    bio: pick(row, ["bio", "description", "about", "summary"]) || "",
    eurovision: pick(row, ["eurovision", "eurovision_year", "esc_year"]) || "—",
    songs: splitList(songsValue),
    tags: splitList(tagsValue),
    website: pick(row, ["website", "official_site", "url"]) || "",
    community: String(pick(row, ["community", "source"])) === "true" || String(pick(row, ["source"])) === "community"
  };
}

function normalizeEvent(row) {
  return {
    id: pick(row, ["id", "event_id"]),
    title: pick(row, ["title", "name", "event_name", "song", "song_title"]) || "Untitled event",
    artistId: pick(row, ["artist_id"]),
    artist: pick(row, ["artist", "artist_name"]),
    year: pick(row, ["year", "event_year"]) || extractYear(pick(row, ["date", "event_date", "start_date"])),
    country: pick(row, ["country", "country_name"]),
    date: pick(row, ["date", "event_date", "start_date"]),
    type: pick(row, ["type", "event_type", "category"]) || "event",
    venue: pick(row, ["venue", "location", "place"]),
    ...row
  };
}
function extractYear(value) {
  const match = String(value || "").match(/20\d{2}/);
  return match ? match[0] : null;
}
function escapeIdent(value) {
  return String(value).replaceAll('"', '""');
}
