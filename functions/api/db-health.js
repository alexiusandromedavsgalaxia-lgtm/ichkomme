export async function onRequestGet({ env }) {
  const bindings = [
    { key: "artist", database: "artist", db: env.artist },
    { key: "artistdata", database: "artist-data", db: env.artistdata },
    { key: "video", database: "songsave", db: env.video }
  ];

  const results = await Promise.all(bindings.map(async ({ key, database, db }) => {
    if (!db) {
      return { key, database, connected: false, error: "Binding is missing" };
    }

    try {
      await db.prepare("SELECT 1").first();
      return { key, database, connected: true };
    } catch (error) {
      return {
        key,
        database,
        connected: false,
        error: error?.message || "D1 query failed"
      };
    }
  }));

  return Response.json({
    ok: results.every(item => item.connected),
    bindings: results
  }, {
    headers: { "cache-control": "no-store" }
  });
}
