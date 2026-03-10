// supabase/functions/igdb-proxy/index.ts
// Edge Function — proxy IGDB pour éviter les restrictions CORS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "https://sodanexus.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query requis" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    // Récupère le token Twitch
    const clientId     = Deno.env.get("IGDB_CLIENT_ID")!;
    const clientSecret = Deno.env.get("IGDB_CLIENT_SECRET")!;

    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!tokenRes.ok) throw new Error("Token Twitch échoué");
    const { access_token } = await tokenRes.json();

    // Appel IGDB
    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID":     clientId,
        "Authorization": `Bearer ${access_token}`,
        "Content-Type":  "text/plain",
      },
      body: `search "${query}"; fields name,cover.image_id,summary,first_release_date,genres.name,involved_companies.company.name,involved_companies.developer,platforms.name; limit 6;`,
    });

    if (!igdbRes.ok) throw new Error(`IGDB HTTP ${igdbRes.status}`);
    const data = await igdbRes.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
