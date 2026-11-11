import { keyOk } from "../../lib/stats.js";

// POST /api/gh-traffic from tools/gh-traffic.sh: {k, views, clones, referrers, assets}; the middle three as `gh api` returns them.
// GitHub keeps 14 days of repo traffic; here a day keeps its row (a later copy of the same day replaces it).
// Views and clones keep GitHub's own (UTC) days; the referrers and the files' counts are filed under the Korean day of the copy,
// so a copy made before 9 a.m. Korean time does not replace the day before's.
// Anything without the INGEST_KEY secret gets the same 404 as a page that is not there.
const DAY = /^\d{4}-\d{2}-\d{2}T/;
export async function onRequestPost({ request, env }) {
  let b = null;
  try { b = await request.json(); } catch {}
  if (!keyOk(b?.k, env.INGEST_KEY)) return new Response("Not found", { status: 404 });
  const rows = [];
  for (const kind of ["views", "clones"])
    for (const d of Array.isArray(b[kind]?.[kind]) ? b[kind][kind].slice(0, 31) : [])
      if (DAY.test(d?.timestamp)) rows.push(env.DB.prepare("INSERT OR REPLACE INTO gh_daily (day, kind, count, uniques) VALUES (?, ?, ?, ?)")
        .bind(d.timestamp.slice(0, 10), kind, d.count >>> 0, d.uniques >>> 0));
  if (Array.isArray(b.referrers)) {
    rows.push(env.DB.prepare("DELETE FROM gh_referrers WHERE day = date('now', '+9 hours')"));
    for (const r of b.referrers.slice(0, 20))
      if (typeof r?.referrer === "string") rows.push(env.DB.prepare("INSERT OR REPLACE INTO gh_referrers (day, referrer, count, uniques) VALUES (date('now', '+9 hours'), ?, ?, ?)")
        .bind(r.referrer.slice(0, 80), r.count >>> 0, r.uniques >>> 0));
  }
  if (Array.isArray(b.assets))  // [{tag, name, count}]: each release file's running download count, today's copy
    for (const a of b.assets.slice(0, 300))
      if (typeof a?.tag === "string" && typeof a?.name === "string") rows.push(env.DB.prepare("INSERT OR REPLACE INTO gh_assets (day, tag, name, count) VALUES (date('now', '+9 hours'), ?, ?, ?)")
        .bind(a.tag.slice(0, 40), a.name.slice(0, 120), a.count >>> 0));
  if (rows.length) await env.DB.batch(rows);
  return Response.json({ ok: true, statements: rows.length });
}
