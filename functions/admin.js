import { keyOk } from "../lib/stats.js";

// GET /admin?k=<ADMIN_KEY>: the website's numbers, in Korean. Without the right key it is a plain 404.
// The page holds no key, no link back to itself and no script; only this Function talks to GitHub's API.
// ponytail: per_page=100 sums the newest 100 releases only; page through them if there are ever more.
const RELEASES = "https://api.github.com/repos/morningverse67-wq/carryon-app/releases?per_page=100";
const LANG = { en: "영어", ko: "한국어", ja: "일본어", zh: "중국어" };
const D30 = "date('now', '-29 days')";  // the last 30 days, today included (UTC)
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const num = n => Number(n || 0).toLocaleString("ko-KR");
let regions;
try { regions = new Intl.DisplayNames(["ko"], { type: "region" }); } catch {}
const country = c => { try { return c ? regions?.of(c) || c : "알 수 없음"; } catch { return c; } };
const ref = k => k || "직접·알 수 없음";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!keyOk(url.searchParams.get("k"), env.ADMIN_KEY)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const q = sql => env.DB.prepare(sql);
  const totals = t => q(`SELECT COUNT(*) AS total, COALESCE(SUM(day = date('now')), 0) AS today, COALESCE(SUM(day >= date('now', '-6 days')), 0) AS d7, COALESCE(SUM(day >= ${D30}), 0) AS d30 FROM ${t}`);
  const perDay = t => q(`SELECT day, COUNT(*) AS n FROM ${t} WHERE day >= ${D30} GROUP BY day`);
  const top = (t, col) => q(`SELECT ${col} AS k, COUNT(*) AS n FROM ${t} WHERE day >= ${D30} GROUP BY k ORDER BY n DESC LIMIT 10`);
  const [gh, res] = await Promise.all([releases(), env.DB.batch([
    totals("hits"), totals("downloads"), perDay("hits"), perDay("downloads"),
    top("hits", "ref"), top("hits", "lang"), top("downloads", "ref"), top("downloads", "os"),
    q(`SELECT country AS k, SUM(v) AS n, SUM(d) AS m FROM (SELECT country, 1 AS v, 0 AS d FROM hits WHERE day >= ${D30} UNION ALL SELECT country, 0, 1 FROM downloads WHERE day >= ${D30}) GROUP BY k ORDER BY SUM(v) + SUM(d) DESC LIMIT 10`),
    q(`SELECT kind, SUM(count) AS n FROM gh_daily WHERE day >= ${D30} GROUP BY kind`),
    q("SELECT referrer AS k, uniques AS n FROM gh_referrers WHERE day = (SELECT MAX(day) FROM gh_referrers) ORDER BY n DESC LIMIT 10"),
  ])]);
  const [visits, downloads, vDays, dDays, vRefs, vLangs, dRefs, dOs, countries, ghDaily, ghRefs] = res.map(r => r.results);
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
  const v = Object.fromEntries(vDays.map(r => [r.day, r.n])), d = Object.fromEntries(dDays.map(r => [r.day, r.n]));
  const traffic = Object.fromEntries(ghDaily.map(r => [r.kind, num(r.n)]));
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>CarryOn 통계</title><style>${CSS}</style></head>
<body><main>
<h1>CarryOn 통계</h1>
<p class="note">날짜는 UTC 기준이라 한국 시간 오전 9시에 하루가 바뀌어요. 쿠키·IP 없이 센 숫자이고 봇은 뺐어요.</p>
<h2>방문</h2>${tiles(visits[0])}
<h2>다운로드 <small>사이트의 다운로드 버튼으로 받은 수</small></h2>${tiles(downloads[0])}
<h2>최근 30일</h2>
<div class="grid">${chart("방문", days, v)}${chart("다운로드", days, d)}</div>
<details class="card"><summary>표로 보기</summary><table><tr><th>날짜</th><th class="n">방문</th><th class="n">다운로드</th></tr>${days.slice().reverse().map(x => `<tr><td>${x}</td><td class="n">${num(v[x])}</td><td class="n">${num(d[x])}</td></tr>`).join("")}</table></details>
<div class="grid">
${list("방문 유입 경로", vRefs, ref)}
${list("방문 언어", vLangs, k => LANG[k] || "알 수 없음")}
${list("나라", countries, country, [["n", "방문"], ["m", "다운로드"]])}
${list("다운로드 경로", dRefs, k => k === url.hostname ? "이 사이트" : ref(k))}
${list("다운로드 기기", dOs, k => k === "mac" ? "Mac" : "다른 기기")}
</div>
<h2>GitHub <small>사이트 버튼으로 받은 것도 들어간 GitHub 집계</small></h2>
<div class="tiles">${tile("릴리스 다운로드 · 전체", gh)}${tile("저장소 조회 · 30일", traffic.views ?? "–")}${tile("clone · 30일", traffic.clones ?? "–")}</div>
${ghRefs.length ? `<div class="grid">${list("저장소 유입 경로 · 최근 14일 순방문", ghRefs, k => k)}</div>` : ""}
${ghDaily.length ? "" : `<p class="note">저장소 조회·clone은 tools/gh-traffic.sh가 매일 넣어요. 아직 들어온 값이 없어요.</p>`}
</main></body></html>`;
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  } });
}

async function releases() {
  try {
    const r = await fetch(RELEASES, { headers: { "User-Agent": "carryon-stats", Accept: "application/vnd.github+json" } });
    if (r.status === 404) return "아직 공개 전";
    if (!r.ok) return `불러오지 못함 (${r.status}) · 새로고침해 보세요`;  // 403 now and then: GitHub's limit for Cloudflare's shared IPs
    const list = await r.json();
    return list.length ? num(list.reduce((s, x) => s + x.assets.reduce((a, y) => a + y.download_count, 0), 0)) : "아직 공개 전";
  } catch { return "불러오지 못함"; }
}

const tile = (label, value) => `<div class="tile"><span>${esc(label)}</span><b${/^[\d,–]+$/.test(value) ? "" : ' class="txt"'}>${esc(value)}</b></div>`;
const tiles = t => `<div class="tiles">${tile("오늘", num(t.today))}${tile("7일", num(t.d7))}${tile("30일", num(t.d30))}${tile("전체", num(t.total))}</div>`;

// One series per chart, each on its own scale; the hovered or focused day shows its number, the table has them all.
function chart(title, days, by) {
  const max = Math.max(0, ...days.map(x => by[x] || 0));
  const cols = days.map(x => {
    const n = by[x] || 0;
    return `<span class="col" tabindex="0"><i style="height:${n ? `max(2px,${(n / max * 100).toFixed(1)}%)` : 0}"></i><em><b>${num(n)}</b> ${x.slice(5)}</em></span>`;
  }).join("");
  return `<section class="card"><h3>일별 ${title} <small>하루 최대 ${num(max)}</small></h3><div class="plot">${cols}</div><div class="axis"><span>${days[0].slice(5)}</span><span>오늘</span></div></section>`;
}

function list(title, rows, name, cols = [["n"]]) {
  const head = cols.length > 1 ? `<tr><th></th>${cols.map(c => `<th class="n">${c[1]}</th>`).join("")}</tr>` : "";
  const body = rows.map(r => `<tr><td>${esc(name(r.k))}</td>${cols.map(c => `<td class="n">${num(r[c[0]])}</td>`).join("")}</tr>`).join("");
  return `<section class="card"><h3>${esc(title)}</h3><table>${head}${body || '<tr><td class="none">아직 없어요</td></tr>'}</table></section>`;
}

const CSS = `:root{color-scheme:light dark;--bg:#f3f3f1;--card:#fcfcfb;--line:#e3e2de;--text:#0b0b0b;--muted:#52514e;--bar:#2a78d6}
@media (prefers-color-scheme:dark){:root{--bg:#111110;--card:#1a1a19;--line:#2e2e2b;--text:#f0efec;--muted:#c3c2b7;--bar:#3987e5}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;word-break:keep-all;-webkit-text-size-adjust:100%}
main{max-width:960px;margin:0 auto;padding:28px 16px 56px}
h1{font-size:24px;line-height:1.3;margin:0}
h2{font-size:17px;margin:36px 0 10px}
h3{font-size:15px;margin:0 0 12px}
small,.note,th,.axis,summary,.none{font-size:14px;font-weight:400;color:var(--muted)}
.note{margin:8px 0 0}
.tiles,.grid{display:grid;gap:10px}
.tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
.grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));margin-top:10px}
.tile,.card{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.tile span{display:block;font-size:14px;color:var(--muted)}
.tile b{display:block;font-size:30px;font-weight:600;line-height:1.3}
.tile b.txt{font-size:18px;line-height:1.5;padding-top:6px}
.plot{display:flex;align-items:flex-end;gap:2px;height:120px;border-bottom:1px solid var(--line)}
.col{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;justify-content:center;outline:0}
.col i{width:100%;max-width:24px;background:var(--bar);border-radius:4px 4px 0 0}
.col:hover i,.col:focus i{opacity:.7}
.col:focus-visible{outline:2px solid var(--bar);outline-offset:1px;border-radius:3px}
.col em{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:1;white-space:nowrap;padding:3px 8px;border-radius:6px;background:var(--text);color:var(--card);font-size:13px;font-style:normal}
.col:nth-child(-n+4) em{left:0;transform:none}
.col:nth-last-child(-n+4) em{left:auto;right:0;transform:none}
.col:hover em,.col:focus em{display:block}
.axis{display:flex;justify-content:space-between;margin-top:4px;font-variant-numeric:tabular-nums}
details{margin-top:10px}
summary{cursor:pointer}
details table{margin-top:10px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
td,th{padding:7px 0;border-top:1px solid var(--line);text-align:left;font-weight:400;overflow-wrap:anywhere}
tr:first-child>*{border-top:0}
.n{text-align:right;padding-left:12px;white-space:nowrap}
@media (max-width:640px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.tile b{font-size:26px}}`;
