import { keyOk, fileKind, ghReuploads, numbers, kstDay, rowTime, BURST_MIN, HOME, ME_COOKIE, SINCE } from "../lib/stats.js";

// GET /admin?k=<ADMIN_KEY>: the website's numbers, in Korean. Without the right key it is a plain 404.
// The page holds no key, no link back to itself and no script; only this Function talks to GitHub's API.
// Opening it with the key marks this browser (the co_me cookie) so its own visits and clicks are not counted.
// ponytail: per_page=100 sums the newest 100 releases only; page through them if there are ever more.
const RELEASES = "https://api.github.com/repos/morningverse67-wq/carryon-app/releases?per_page=100";
const LANG = { en: "영어", ko: "한국어", ja: "일본어", zh: "중국어", de: "독일어", fr: "프랑스어", es: "스페인어", it: "이탈리아어", nl: "네덜란드어", pt: "포르투갈어" };
const KIND = { mac: "Mac DMG", winzip: "Windows ZIP", android: "Android APK", winstore: "Windows · Microsoft Store", ios: "iPhone · App Store" };
const SHORT = { mac: "Mac", winzip: "Win ZIP", android: "APK", winstore: "MS Store", ios: "App Store" };  // table headers
const FILES = ["mac", "winzip", "android"], STORES = ["winstore", "ios"];  // a file to keep | a trip to a store page
const BEGAN = { winstore: "2026-11-11", ios: SINCE };  // the day a button began to be counted, shown until its first click
const DEV = { mac: "Mac", windows: "윈도우 PC", android: "안드로이드 폰", iphone: "아이폰", ipad: "아이패드", linux: "리눅스", chromeos: "크롬북", unknown: "알 수 없는 기기", other: "Mac 아닌 기기", "?": "기기 기록 전" };
const on = d => d === "?" ? DEV[d] : (DEV[d] || d) + "에서";
// The links' ?s= tags, as people read them. A tag that is not here shows as it is.
const SRC = { ytch: "YouTube 채널 링크", ig: "인스타 프로필 링크", igdm: "인스타 DM", igst: "인스타 스토리", th: "스레드", threads: "스레드", x: "X", ph: "Product Hunt", github: "GitHub README" };
const WHY = { mixed: "①", "other-device": "②", unknown: "③" };  // spelled out under the table and in 세는 법
const NEW_DAYS = 3;  // a bug report this recent gets a line at the top
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const num = n => Number(n || 0).toLocaleString("ko-KR");
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + "%" : "–";
const md = d => String(d).slice(5);  // 2026-11-10 -> 11-10
let regions;
try { regions = new Intl.DisplayNames(["ko"], { type: "region" }); } catch {}
const country = c => { try { return c ? regions?.of(c) || c : "알 수 없음"; } catch { return c; } };
const ref = k => k === HOME ? "이 사이트의 버튼" : k || "직접·알 수 없음";
// The top of a chart's scale: a clean number at or above the largest value.
const nice = n => { const p = 10 ** Math.floor(Math.log10(Math.max(1, n))); return [1, 1.5, 2, 3, 4, 5, 6, 8, 10].map(m => m * p).find(v => v >= n && Number.isInteger(v)) || n; };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!keyOk(url.searchParams.get("k"), env.ADMIN_KEY)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const now = Date.now();
  const [gh, s] = await Promise.all([releases(), numbers(env.DB, now)]);
  const days = Array.from({ length: 30 }, (_, i) => kstDay(now - (29 - i) * 864e5));
  const v = Object.fromEntries(s.visitDays.map(r => [r.day, r.n])), yt = Object.fromEntries(s.visitDays.map(r => [r.day, r.yt]));
  const d = Object.fromEntries(s.downloadDays.map(r => [r.day, r.n]));
  const sumOf = ks => ks.reduce((n, k) => n + s.kinds[k].n, 0);
  const ghSum = days.reduce((n, x) => n + (s.ghDays[x] || 0), 0), ghFrom = Object.keys(s.ghDays).sort().find(x => x >= days[0]);
  const fresh = s.reports.filter(r => kstDay(rowTime(r)) >= kstDay(now - (NEW_DAYS - 1) * 864e5)).length;
  const kMax = nice(Math.max(1, ...Object.values(s.kinds).flatMap(k => Object.values(k.days))));
  const dc = s.downloadCountries, places = s.visitCountries.map(r => ({ k: r.k, n: r.n, m: dc[r.k] || 0 }));
  for (const [k, m] of Object.entries(dc)) if (!places.some(r => String(r.k) === k)) places.push({ k: k === "null" ? null : k, n: 0, m });
  places.sort((a, b) => b.n + b.m - a.n - a.m);
  const ratio = (a, b) => b ? a / b * 100 : null, r30 = ratio(s.downloads.d30, s.visits.d30), rPrev = ratio(s.downloads.prev30, s.visits.prev30);
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>CarryOn 통계</title><style>${CSS}</style></head>
<body><main>
<h1>CarryOn 통계</h1>
<p class="note">한국 시간 ${md(s.today)} ${new Date(now + 9 * 36e5).toISOString().slice(11, 16)} · 최근 30일은 ${md(days[0])}~오늘 · 이 브라우저의 방문과 클릭은 세지 않아요</p>
${fresh ? `<a class="alert" href="#reports"><span aria-hidden="true">●</span> 새 버그 제보 ${num(fresh)}건 <small>최근 ${NEW_DAYS}일 · 아래에서 보기</small></a>` : ""}
<div class="tiles">
${tile("방문 · 30일", num(s.visits.d30), delta(s.visits.d30, s.visits.prev30), "사이트를 연 횟수")}
${tile("받기 · 30일", num(s.downloads.d30), delta(s.downloads.d30, s.downloads.prev30), `버튼을 누른 묶음 수 · 누름 ${num(s.clicks.d30)}`)}
${tile("방문 대비 받기", r30 === null ? "–" : r30.toFixed(1) + "%", rPrev === null ? delta(0, 0) : delta(r30, rPrev, "%p"), "받기 ÷ 방문")}
${tile("오늘 방문 · 받기", `${num(s.visits.today)} · ${num(s.downloads.today)}`, "", `7일 방문 ${num(s.visits.d7)} · 받기 ${num(s.downloads.d7)}`)}
</div>

<h2>방문에서 받기까지 <small>최근 30일</small></h2>
<section class="card funnel">
${stage("방문", s.visits.d30, s.visits.d30, "f1", "사이트를 연 횟수")}
${stage("받기 버튼", s.downloads.d30, s.visits.d30, "f2", `방문의 ${pct(s.downloads.d30, s.visits.d30)} · 파일 ${num(sumOf(FILES))} · 스토어 ${num(sumOf(STORES))}`)}
${stage("GitHub 파일 받기", ghFrom ? ghSum : "–", s.visits.d30, "f3", ghFrom ? `${md(ghFrom)}부터 잰 값 · 사이트 버튼 + GitHub에서 바로` : "매일 오전 10시 기록이 쌓이면 보여요")}
</section>
<p class="note">받기 버튼은 누른 순간을 세고, 파일을 실제로 받은 횟수는 GitHub가 세요. 자동 수집 의심 ${num(s.suspect.d30)}묶음은 받기에서 뺐어요.</p>

<h2>30일 추이 <small>막대에 마우스를 올리거나 눌러 보면 그날 숫자</small></h2>
<div class="grid two">
<section class="card"><h3>일별 방문</h3>${plot(days, [{ by: v }], x => `<b>${num(v[x])}</b> 방문 · ${md(x)}`)}</section>
<section class="card"><h3>일별 받기</h3><p class="legend"><span><i></i>받기</span><span><i class="sus"></i>자동 수집 의심</span></p>${plot(days, [{ by: d }, { by: s.suspectDays, cls: "sus" }], x => `<b>${num(d[x])}</b> 받기 · 의심 ${num(s.suspectDays[x])} · 누름 ${num(s.clickDays[x])} · ${md(x)}`)}</section>
</div>

<h2>종류별 받기 <small>최근 30일 · 다섯 그래프의 눈금은 같아요</small></h2>
<h3 class="grp">파일 받기 <b>${num(sumOf(FILES))}</b></h3>
<div class="grid three">${FILES.map(k => kindCard(k, s.kinds[k], days, kMax)).join("")}</div>
<h3 class="grp">스토어로 이동 <b>${num(sumOf(STORES))}</b> <small>스토어 페이지를 연 횟수예요. 설치 수는 각 스토어가 세요</small></h3>
<div class="grid three">${STORES.map(k => kindCard(k, s.kinds[k], days, kMax)).join("")}</div>
<details class="card"><summary>날짜별 표로 보기</summary>
<table><tr><th>날짜</th><th class="n">방문</th><th class="n">YouTube</th><th class="n">받기</th><th class="n">누름</th><th class="n">의심</th><th class="n">GitHub</th></tr>${days.slice().reverse().map(x => `<tr><td class="d">${md(x)}</td>${[v[x], yt[x], d[x], s.clickDays[x], s.suspectDays[x]].map(n => `<td class="n">${num(n)}</td>`).join("")}<td class="n">${x in s.ghDays ? num(s.ghDays[x]) : "–"}</td></tr>`).join("")}</table>
<table><tr><th>날짜</th>${[...FILES, ...STORES].map(k => `<th class="n">${SHORT[k]}</th>`).join("")}</tr>${days.slice().reverse().map(x => `<tr><td class="d">${md(x)}</td>${[...FILES, ...STORES].map(k => `<td class="n">${num(s.kinds[k].days[x])}</td>`).join("")}</tr>`).join("")}</table>
</details>
${s.suspects.length ? `<details class="card"><summary>자동 수집 의심 ${num(s.suspect.d30)}묶음 보기</summary><table><tr><th>한국 시간</th><th>나라</th><th>종류 · 기기</th><th class="n">누름</th><th>이유</th></tr>${s.suspects.map(b => `<tr><td class="d">${new Date(b.t + 9 * 36e5).toISOString().slice(5, 16).replace("T", " ")}</td><td class="d">${esc(country(b.country))}</td><td>${esc(KIND[b.kind])} · ${esc(DEV[b.dev] || b.dev)}</td><td class="n">${num(b.clicks)}</td><td>${WHY[b.why]}</td></tr>`).join("")}</table><p class="note">① 유입 경로 없이 같은 날 여러 플랫폼 파일 ② 유입 경로 없이 PC가 다른 기기용 파일 ③ 기기를 알 수 없음</p></details>` : ""}

<h2>어디서 왔나 <small>최근 30일</small></h2>
<div class="grid">
${rank("유입 경로", s.visitRefs, k => esc(ref(k)), [["n", "방문"]])}
${rank("링크 꼬리표", s.visitSrcs, k => k ? `${esc(SRC[k] || k)} <small>?s=${esc(k)}</small>` : "꼬리표 없음", [["n", "방문"]])}
${rank("나라", places.slice(0, 10), k => esc(country(k)), [["n", "방문"], ["m", "받기"]])}
${rank("보여 준 언어", s.visitLangs, k => esc(LANG[k] || "알 수 없음"), [["n", "방문"]])}
${rank("받기 버튼을 누른 곳", s.downloadRefs, k => esc(ref(k)), [["n", "받기"]])}
${rank("받은 기기", s.downloadOs, k => { const [f, dev] = String(k).split("@"); return `${esc(KIND[f] || f)} <small>${esc(on(dev))}</small>`; }, [["n", "받기"]])}
</div>

<h2>GitHub 릴리스 <small>GitHub가 파일마다 센 받기 횟수</small></h2>
${ghSection(gh, s, days)}

<h2>세는 법</h2>
<dl class="card defs">
<dt>방문</dt><dd>사이트를 연 횟수. 자동 프로그램, 미리보기 주소, 이 브라우저는 빼요.</dd>
<dt>받기</dt><dd>버튼을 누른 묶음 수. 같은 나라·기기·경로에서 같은 버튼을 ${BURST_MIN}분 안에 다시 누르면 1로 쳐요.</dd>
<dt>누름</dt><dd>버튼을 누른 횟수 그대로. 누른 순간을 세고, 받기를 끝낸 횟수는 GitHub 숫자예요.</dd>
<dt>자동 수집 의심</dt><dd>① 유입 경로 없이 같은 날 같은 나라·기기가 여러 플랫폼 파일을 받음 ② 유입 경로 없이 PC가 다른 기기용 파일을 받음 ③ 기기를 알 수 없음. 이런 묶음은 받기에서 빼고 따로 세요.</dd>
<dt>우리 클릭</dt><dd>이 페이지를 연 브라우저는 표시 쿠키로 빼요. 방문자에게는 쿠키를 주지 않아요. ${md(SINCE)} 전 숫자에는 우리 확인 클릭이 섞여 있어요.</dd>
<dt>날짜</dt><dd>한국 시간. 받기는 모든 기록을 한국 날짜로 바꿨고, 방문은 ${md(SINCE)} 전 기록만 오전 9시에 하루가 바뀌어요.</dd>
<dt>Windows</dt><dd>11-11부터 버튼은 Microsoft Store로 가고 ZIP은 따로 세요. 그 전 Windows는 모두 ZIP이에요.</dd>
<dt>iPhone</dt><dd>${md(SINCE)}부터 사이트의 App Store 버튼을 세요.</dd>
</dl>

<h2 id="reports">버그 제보 <small>최근 30개 · 사이트의 제보 폼</small></h2>
${s.reports.length ? s.reports.map(report).join("") : '<p class="note">아직 없어요</p>'}
</main></body></html>`;
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex", "Set-Cookie": ME_COOKIE,
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  } });
}

// The releases as rows {tag, date, pre, files: {mac, windows, android, other}, assets: [{tag, name, count, made}]}
// (days in Korean time), or a sentence when there are none to show.
async function releases() {
  try {
    const r = await fetch(RELEASES, { headers: { "User-Agent": "carryon-stats", Accept: "application/vnd.github+json" } });
    if (r.status === 404) return "아직 공개 전";
    if (!r.ok) return `불러오지 못함 (${r.status}) · 새로고침해 보세요`;  // 403 now and then: GitHub's limit for Cloudflare's shared IPs
    const list = await r.json();
    if (!list.length) return "아직 공개 전";
    const day = t => t ? kstDay(Date.parse(t)) : "";
    return list.map(x => {
      const files = { mac: 0, windows: 0, android: 0, other: 0 };
      for (const a of x.assets) files[fileKind(a.name)] += a.download_count;
      return { tag: x.tag_name, date: day(x.published_at), pre: x.prerelease, files,
        assets: x.assets.map(a => ({ tag: x.tag_name, name: a.name, count: a.download_count, made: day(a.created_at) })) };
    });
  } catch { return "불러오지 못함"; }
}

function ghSection(gh, s, days) {
  const live = typeof gh === "string" ? [] : gh.flatMap(x => x.assets), again = ghReuploads(s.ghSnaps, live), lost = again.reduce((n, a) => n + a.lost, 0);
  const first = s.ghSnaps[0]?.day, traffic = Object.fromEntries(s.ghDaily.map(r => [r.kind, num(r.n)]));
  const sum = k => gh.reduce((n, x) => n + x.files[k], 0);
  const row = x => `<tr><td>${esc(x.tag)}${x.pre ? " <small>베타</small>" : ""}</td><td class="d">${esc(md(x.date))}</td>${["mac", "windows", "android"].map(k => `<td class="n">${x.files[k] ? num(x.files[k]) : "–"}</td>`).join("")}</tr>`;
  return `${typeof gh === "string" ? `<div class="tiles">${tile("릴리스 받기", gh)}</div>` : `<div class="tiles">
${tile("앱 파일 · 누적", num(sum("mac") + sum("windows") + sum("android")), "", lost ? `다시 올려 빠진 ${num(lost)}회는 아래 표` : "GitHub의 지금 숫자")}
${tile("Mac DMG", num(sum("mac")))}${tile("Windows ZIP", num(sum("windows")))}${tile("Android APK", num(sum("android")))}</div>`}
<div class="grid two">
<section class="card"><h3>일별 GitHub 파일 받기 <small>매일 오전 10시에 잰 숫자의 하루 증가분</small></h3>${Object.keys(s.ghDays).length ? plot(days, [{ by: s.ghDays }], x => x in s.ghDays ? `<b>${num(s.ghDays[x])}</b> 받기 · ${md(x)}` : `기록 전 · ${md(x)}`) : '<p class="note">내일 오전 10시 기록부터 쌓여요</p>'}</section>
${typeof gh === "string" ? "" : `<section class="card"><h3>릴리스별</h3><table><tr><th>릴리스</th><th>날짜</th><th class="n">Mac</th><th class="n">Windows</th><th class="n">Android</th></tr>${gh.map(row).join("")}</table></section>`}
</div>
<section class="card" style="margin-top:10px"><h3>다시 올린 파일 <small>같은 이름으로 다시 올리면 GitHub가 0부터 다시 세요</small></h3>${again.length ? `<table><tr><th>파일</th><th>다시 올린 날</th><th class="n">그 전 횟수</th></tr>${again.slice().reverse().map(a => `<tr><td>${esc(a.tag)} ${esc(a.name)}</td><td class="d">${esc(a.day.split("~").map(md).join("~"))}</td><td class="n">${num(a.lost)}</td></tr>`).join("")}</table>` : '<p class="note">찾은 것이 없어요</p>'}
<p class="note">${first ? `매일 기록은 ${md(first)}부터 있어요. 그 전에 다시 올린 것은 여기 나오지 않아요.` : "매일 기록이 쌓이면 자동으로 찾아요."}</p></section>
<p class="note">횟수예요(사람 수 아님). 사이트 버튼으로 받은 것도 들어가 위 '받기'와 겹치고, 자동 프로그램과 우리가 받은 것도 들어가요. 체크섬 파일은 뺐어요.</p>
<h2>GitHub 저장소 <small>GitHub가 이틀쯤 뒤에 알려 주는 값</small></h2>
<div class="grid two"><div class="tiles t2">${tile("저장소 조회 · 30일", traffic.views ?? "–")}${tile("clone · 30일", traffic.clones ?? "–", "", "자동 프로그램 포함")}</div>
${s.ghRefs.length ? rank("저장소 유입 경로", s.ghRefs, k => esc(k), [["n", "14일 순방문"]]) : ""}</div>`;
}

const report = r => `<section class="card rep"><p class="note">${new Date(rowTime(r) + 9 * 36e5).toISOString().slice(5, 16).replace("T", " ")} · ${esc(country(r.country))} · ${esc(r.os || "기기 모름")} · ${esc(r.ver ? "버전 " + r.ver : "버전 모름")}${r.email ? ` · <a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ""}</p><p>${esc(r.body)}</p></section>`;
// A stat tile: label, value, an optional change against the 30 days before, an optional short definition.
const tile = (label, value, change = "", def = "") => `<div class="tile"><span>${esc(label)}</span><b${/^[\d,.%–· ]+$/.test(value) ? "" : ' class="txt"'}>${esc(value)}</b>${change}${def ? `<small>${esc(def)}</small>` : ""}</div>`;
function delta(cur, prev, unit = "%") {
  if (!prev) return `<em class="dl">이전 30일 기록 없음</em>`;
  const x = unit === "%" ? (cur - prev) / prev * 100 : cur - prev;
  return `<em class="dl ${x > 0 ? "up" : x < 0 ? "down" : ""}">${x > 0 ? "▲" : x < 0 ? "▼" : "–"} ${Math.abs(x).toFixed(1)}${unit} <small>이전 30일 대비</small></em>`;
}
// One step of the funnel; its bar is its share of the visits.
const stage = (label, n, of, cls, def) => `<div class="st"><span>${esc(label)}</span><b>${typeof n === "number" ? num(n) : n}</b><i class="${cls}" style="width:${n > 0 && of ? `max(4px,${Math.min(100, n / of * 100).toFixed(1)}%)` : 0}"></i><small>${esc(def)}</small></div>`;
const kindCard = (k, x, days, max) => `<section class="card"><h3>${esc(KIND[k])} <b>${num(x.n)}</b></h3>${plot(days, [{ by: x.days }], d => `<b>${num(x.days[d])}</b> 받기 · ${md(d)}`, max, 56)}<p class="note">${!x.clicks && BEGAN[k] ? `${md(BEGAN[k])}부터 세요` : `누름 ${num(x.clicks)}${x.suspect ? ` · 의심 ${num(x.suspect)}` : ""}`}</p></section>`;

// Thin columns from one baseline, one scale per chart; `series` stack bottom first. The hovered or focused day
// shows its numbers, and the table has them all.
function plot(days, series, tip, max, h = 120) {
  max ||= nice(Math.max(1, ...days.map(x => series.reduce((n, s) => n + (s.by[x] || 0), 0))));
  const cols = days.map(x => {
    const segs = series.filter(s => s.by[x]).reverse().map(s => `<i${s.cls ? ` class="${s.cls}"` : ""} style="height:max(3px,${(s.by[x] / max * 100).toFixed(1)}%)"></i>`).join("");
    return `<span class="col" tabindex="0">${segs}<em>${tip(x)}</em></span>`;
  }).join("");
  return `<div class="ymax">${num(max)}</div><div class="plot" style="height:${h}px">${cols}</div><div class="axis"><span>${md(days[0])}</span><span>오늘</span></div>`;
}

// Ranked bars, largest first, one hue: a name, its figures and a bar for the first figure.
function rank(title, rows, name, cols) {
  const max = Math.max(1, ...rows.map(r => r[cols[0][0]] || 0));
  const body = rows.map(r => `<li><span>${name(r.k)}</span>${cols.map(c => `<b>${num(r[c[0]])}</b>`).join("")}<i style="width:${((r[cols[0][0]] || 0) / max * 100).toFixed(1)}%"></i></li>`).join("");
  return `<section class="card"><h3>${esc(title)}</h3><ol class="rank c${cols.length}"><li class="hd"><span></span>${cols.map(c => `<span>${esc(c[1])}</span>`).join("")}</li>${body || '<li class="none">아직 없어요</li>'}</ol></section>`;
}

// Colors: one blue for every mark, three steps of it for the funnel's order, a neutral gray for what is set aside;
// each checked for light and dark with the dataviz validator (contrast, color-blind separation).
const CSS = `:root{color-scheme:light dark;--bg:#f6f5f2;--card:#fcfcfb;--line:#e1e0d9;--axis:#c3c2b7;--text:#0b0b0b;--muted:#52514e;--bar:#2a78d6;--f2:#5598e7;--f3:#86b6ef;--sus:#898781;--up:#006300;--down:#d03b3b;--warn:#fab219}
@media (prefers-color-scheme:dark){:root{--bg:#0d0d0d;--card:#1a1a19;--line:#2c2c2a;--axis:#383835;--text:#f0efec;--muted:#c3c2b7;--bar:#3987e5;--f2:#256abf;--f3:#184f95;--up:#0ca30c;--down:#e66767}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;word-break:keep-all;-webkit-text-size-adjust:100%}
main{max-width:960px;margin:0 auto;padding:28px 16px 56px}
h1{font-size:24px;line-height:1.3;margin:0}
h2{font-size:18px;margin:40px 0 10px}
h3{font-size:15px;font-weight:600;margin:0 0 10px}
h3 b{float:right;font-size:20px;line-height:1.1}
.grp{margin:16px 0 0}.grp b{float:none;margin-left:4px}
small,.note,th,.axis,.ymax,summary,.none,.legend,.hd,dd{font-size:14px;font-weight:400;color:var(--muted)}
.note{margin:8px 0 0}
.alert{display:block;margin-top:14px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--text);font-weight:600;text-decoration:none}
.alert span{color:var(--warn)}
.tiles,.grid{display:grid;gap:10px;margin-top:10px}
.tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
.tiles.t2{grid-template-columns:repeat(2,minmax(0,1fr));margin:0}
.grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.tile,.card{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.tile>*{display:block}
.tile span{font-size:14px;color:var(--muted)}
.tile b{font-size:30px;font-weight:600;line-height:1.3}
.tile b.txt{font-size:18px;line-height:1.5;padding-top:6px}
.dl{font-size:14px;font-style:normal;color:var(--muted)}
.up{color:var(--up)}.down{color:var(--down)}
.funnel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.st>*{display:block}
.st span{font-size:14px;color:var(--muted)}
.st b{font-size:26px;font-weight:600;line-height:1.3}
.st i{height:8px;margin:6px 0;border-radius:0 4px 4px 0;background:var(--bar)}
.st .f2{background:var(--f2)}.st .f3{background:var(--f3)}
.st+.st{position:relative}
.st+.st:before{content:"→";position:absolute;left:-19px;top:22px;color:var(--muted)}
.legend{display:flex;gap:14px;margin:0 0 4px}
.legend i{display:inline-block;width:10px;height:10px;margin-right:5px;border-radius:2px;background:var(--bar)}
.ymax{font-size:12px;line-height:1.4;font-variant-numeric:tabular-nums}
.plot{display:flex;align-items:stretch;gap:2px;border-top:1px solid var(--line);border-bottom:1px solid var(--axis)}
.col{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;outline:0}
.col i{flex:none;width:100%;max-width:24px;background:var(--bar)}
.col i:first-of-type{border-radius:4px 4px 0 0}
.col .sus,.legend .sus{background:var(--sus)}
.col:hover i,.col:focus i{opacity:.7}
.col:focus-visible{outline:2px solid var(--bar);outline-offset:1px;border-radius:3px}
.col em{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:1;white-space:nowrap;padding:3px 8px;border-radius:6px;background:var(--text);color:var(--card);font-size:13px;font-style:normal}
.col:nth-child(-n+10) em{left:0;transform:none}
.col:nth-last-child(-n+10) em{left:auto;right:0;transform:none}
.col:hover em,.col:focus em{display:block}
.axis{display:flex;justify-content:space-between;margin-top:4px;font-size:12px;font-variant-numeric:tabular-nums}
.rank{list-style:none;margin:0;padding:0}
.rank li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 14px;padding:7px 0;overflow-wrap:anywhere}
.rank.c2 li{grid-template-columns:minmax(0,1fr) 3.5em 3.5em}
.rank b,.rank .hd span{font-weight:400;text-align:right;font-variant-numeric:tabular-nums}
.rank i{grid-column:1/-1;height:4px;border-radius:0 2px 2px 0;background:var(--bar)}
.rank .hd{padding:0}
.defs{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 16px;margin:0}
.defs dt{font-weight:600;white-space:nowrap}.defs dd{margin:0}
.rep{margin-top:10px}.rep p{margin:0}.rep p+p{margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere}
details{margin-top:10px}
summary{cursor:pointer}
details table{margin-top:10px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
td,th{padding:7px 0 7px 12px;border-top:1px solid var(--line);text-align:left;font-weight:400;overflow-wrap:anywhere}
td:first-child,th:first-child{padding-left:0}
tr:first-child>*{border-top:0}
.n{text-align:right}
td.n,.d,th{white-space:nowrap}
@media (max-width:640px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.tile b{font-size:26px}.funnel{grid-template-columns:1fr;gap:14px}.st+.st:before{content:none}.defs{grid-template-columns:1fr;gap:2px}.defs dd{margin-bottom:8px}table{font-size:14px}}
@media (forced-colors:active){.col i,.rank i,.st i,.legend i{background:CanvasText}.col .sus,.legend .sus{background:GrayText}}`;
