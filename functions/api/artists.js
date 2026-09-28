export async function onRequestGet({ env, request }) {
  const artistDb = env.artist;
  const dataDb = env.artistdata;
  if (!artistDb || !dataDb) {
    return Response.json({ error: "D1 bindings artist and artistdata are required" }, { status: 500 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const year = url.searchParams.get("year") || "";
  const artistId = url.searchParams.get("artist") || "";

  try {
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

    const normalizedArtists = artists.map(normalizeArtist);
    const artistMap = new Map(normalizedArtists.map(a => [String(a.id), a]));
    let normalizedEvents = events.map(normalizeEvent);

    if (artistId) normalizedEvents = normalizedEvents.filter(e =>
      String(e.artistId || "") === artistId ||
      String(e.artist || "").toLowerCase() === String(artistId).toLowerCase()
    );
    if (year && /^20\\d{2}$/.test(year)) normalizedEvents = normalizedEvents.filter(e => String(e.year) === year);
    if (q) {
      const needle = q.toLowerCase();
      normalizedEvents = normalizedEvents.filter(e =>
        [e.title, e.artist, e.country, e.venue, e.type].filter(Boolean).join(" ").toLowerCase().includes(needle)
      );
    }

    return Response.json({
      artists: normalizedArtists,
      events: normalizedEvents,
      tables: { artist: artistTables.results || [], artistdata: dataTables.results || [] },
      source: { artist: "env.artist", artistdata: "env.artistdata" }
    }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (error) {
    return Response.json({ error: error?.message || "D1 query failed" }, { status: 500 });
  }
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
function normalizeArtist(row) {
  return {
    id: pick(row, ["id", "artist_id"]),
    name: pick(row, ["name", "artist_name", "display_name"]) || "Unknown artist",
    country: pick(row, ["country", "country_name"]) || "",
    ...row
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
  const match = String(value || "").match(/20\\d{2}/);
  return match ? match[0] : null;
}
function escapeIdent(value) {
  return String(value).replaceAll('"', '""');
}
