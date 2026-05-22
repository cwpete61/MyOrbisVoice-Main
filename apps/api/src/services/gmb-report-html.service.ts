/**
 * GMB Evaluation — beautiful HTML report template. ONE template drives two
 * outputs: the customer-facing shareable web link (interactive, live 3D charts)
 * and the PDF (this HTML rendered by headless Chromium in the render service).
 *
 * Self-contained: inline CSS + ECharts/echarts-gl from CDN. Data + localized
 * strings are baked in server-side (the engine is language-neutral; we resolve
 * the catalog here). Brand-parameterized → white-label ready.
 */
import {
  GMB_CATEGORY_LABELS, GMB_TIME_LABELS, GMB_STATUS_LABELS, GMB_UI,
  GMB_DATA_SOURCE_LABELS, GMB_REASON_LABELS, GMB_SCORECARD_LABELS,
  gmbIssueText, gmbInterpolate, buildActionPlan, type GmbLocale,
} from '@voiceautomation/types'
import type { AuditResult, CategoryResult } from './gmb-audit/index.js'

export interface GmbReportBrand {
  companyName: string
  contactName: string | null
  phone: string | null
  logoUrl: string | null
}
export interface GmbReportHtmlInput {
  evaluation: { businessName: string; city: string; website: string | null; overallScore: number; createdAt: Date; result: AuditResult }
  brand: GmbReportBrand
  locale: GmbLocale
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function scoreColor(s: number | null): string {
  return s === null ? '#94a3b8' : s >= 75 ? '#16a34a' : s >= 45 ? '#d97706' : '#dc2626'
}
const HEAT: Record<string, string> = { green: '#16a34a', yellow: '#eab308', orange: '#ea8a2f', red: '#dc2626', none: '#e2e8f0' }

export function renderReportHtml(input: GmbReportHtmlInput): string {
  const { evaluation, brand, locale } = input
  const r = evaluation.result
  const ui = (k: string, p: Record<string, string | number> = {}) => gmbInterpolate(GMB_UI[locale][k] ?? k, p)
  const catLabel = (k: string) => GMB_CATEGORY_LABELS[locale][k] ?? k
  const sub = r.summary
  const cg = r.competitorGap
  const cats = (r.categories ?? []).filter((c) => c.score !== null)
  const lang = locale === 'es' ? 'es' : 'en'

  // ── data for charts (baked into the page) ──
  const radarData = cats.map((c) => ({ name: catLabel(c.key), score: c.score as number, expected: c.expected }))
  const heat = r.heatMap
  const comps = r.competitorDetails ?? []
  const plan = buildActionPlan((r.categories ?? []).flatMap((c) => c.issues))

  const scorecardRows = cg ? (() => {
    const cl = cg.client
    const rows = [
      { k: 'reviews', you: cl.reviews, c: comps.map((x) => x.reviewCount), higher: true },
      { k: 'rating', you: cl.rating, c: comps.map((x) => x.rating), higher: true, dec: 1 },
      { k: 'categories', you: cl.categories, c: comps.map((x) => x.categoryCount), higher: true },
      { k: 'servicePages', you: cl.servicePages, c: comps.map((x) => x.servicePageCount), higher: true },
      { k: 'locationPages', you: cl.locationPages, c: comps.map((x) => x.locationPageCount), higher: true },
      { k: 'mapPack', you: r.mapPackPosition, c: comps.map((x) => x.mapPackPosition), higher: false },
    ]
    const fmt = (v: number | null | undefined, dec?: number) => v == null ? '—' : dec ? v.toFixed(dec) : String(v)
    return rows.map((row) => {
      const cs = row.c.filter((x): x is number => x != null)
      let gap: number | null = null, lose = false
      if (row.you != null && cs.length) { const best = row.higher ? Math.max(...cs) : Math.min(...cs); gap = row.higher ? row.you - best : best - row.you; lose = gap < 0 }
      return `<tr><td>${esc(GMB_SCORECARD_LABELS[locale][row.k] ?? row.k)}</td>
        <td class="you">${esc(fmt(row.you, row.dec))}</td>
        ${row.c.map((c) => `<td>${esc(fmt(c, row.dec))}</td>`).join('')}
        <td class="${lose ? 'gap-bad' : 'gap-good'}">${gap == null ? '—' : `${gap > 0 ? '+' : ''}${row.dec ? gap.toFixed(row.dec) : gap}`}</td></tr>`
    }).join('')
  })() : ''

  const heatCells = heat ? [...heat.points].sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => `<div class="hc" style="background:${HEAT[p.bucket] ?? '#e2e8f0'};color:${p.bucket === 'yellow' || p.bucket === 'none' ? '#334155' : '#fff'}">${p.rank ?? ''}</div>`).join('') : ''

  const issueLi = (it: { key: string; severity: string; timeTier: string; params: Record<string, string | number> }) => {
    const t = gmbIssueText(locale, it.key, it.params)
    const sc = it.severity === 'critical' ? '#dc2626' : it.severity === 'warn' ? '#d97706' : '#94a3b8'
    return `<li><span class="dot" style="background:${sc}"></span><div><div class="it-title">${esc(t.title)}<span class="chip">${esc(ui('estTime'))}: ${esc(GMB_TIME_LABELS[locale][it.timeTier] ?? it.timeTier)}</span></div>${t.fix ? `<div class="it-fix"><b>${esc(ui('fix'))}:</b> ${esc(t.fix)}</div>` : ''}</div></li>`
  }

  const planBucket = (key: string, list: typeof plan.p1, tag: string) =>
    list.length ? `<div class="pri"><div class="pri-h"><span>${esc(ui(key))}</span><span class="chip">${esc(tag)}</span></div><ul class="issues">${list.map(issueLi).join('')}</ul></div>` : ''

  const catCards = (r.categories ?? []).map((c: CategoryResult) => {
    const col = scoreColor(c.score)
    const pct = c.score ?? 0
    return `<div class="cat">
      <div class="cat-top"><span class="cat-name">${esc(catLabel(c.key))}</span>
        <span class="cat-score" style="color:${col}">${c.score === null ? '—' : c.score}<small>${c.score === null ? '' : '/100'}</small></span></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="cat-meta">${esc(ui('target', { expected: c.expected }))} · ${esc(GMB_STATUS_LABELS[locale][c.status])}</div>
      ${c.issues.length ? `<ul class="issues sm">${c.issues.map(issueLi).join('')}</ul>` : ''}
    </div>`
  }).join('')

  const sources = (r.meta?.dataSources ?? []).map((s) => GMB_DATA_SOURCE_LABELS[locale][s] ?? s).join(' · ')
  const dateStr = evaluation.createdAt.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const data = { radar: radarData, comps: comps.map((c) => ({ name: c.name, reviews: c.reviewCount ?? 0 })), clientReviews: cg?.client.reviews ?? 0 }

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/>
<title>${esc(brand.companyName)} — ${esc(evaluation.businessName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--teal:#127a7a;--teal2:#1aa3a3;--ink:#0f172a;--muted:#64748b;--hair:#e2e8f0;--accent:#e8804d;--bg:#f4f7f8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:920px;margin:0 auto;background:#fff}
h1,h2,h3{font-family:Sora,sans-serif;letter-spacing:-.01em}
.hero{background:linear-gradient(135deg,#0e6b6b,#16a3a3 75%);color:#fff;padding:40px 48px 110px;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;right:-80px;top:-80px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)}
.hero .brand{font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;font-weight:600}
.hero h1{font-size:30px;font-weight:800;margin-top:6px}
.hero .sub{opacity:.9;margin-top:4px;font-size:14px}
.hero .biz{margin-top:22px;font-size:20px;font-weight:700}
.hero .date{opacity:.8;font-size:13px;margin-top:2px}
.scorecard-hero{display:flex;gap:28px;align-items:center;margin:-72px 48px 0;position:relative;z-index:2;background:#fff;border-radius:18px;padding:26px 30px;box-shadow:0 18px 50px rgba(15,23,42,.12)}
.ring{flex:0 0 auto}
.score-meta .lbl{font-size:13px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.score-meta .big{font-size:15px;font-weight:600;margin-top:4px}
.section{padding:30px 48px}
.section h2{font-size:21px;font-weight:700;margin-bottom:4px}
.rule{width:46px;height:4px;border-radius:3px;background:var(--accent);margin-bottom:16px}
.lead{color:var(--muted);margin-bottom:16px;max-width:60ch}
.summary{background:linear-gradient(180deg,#fff5f1,#fff);border:1px solid #ffe2d4;border-left:4px solid var(--accent);border-radius:12px;padding:18px 22px}
.summary li{margin:7px 0;list-style:none;padding-left:22px;position:relative}
.summary li::before{content:"›";position:absolute;left:6px;color:var(--accent);font-weight:700}
.summary li.win{color:#16a34a;font-weight:600}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.card{background:#fff;border:1px solid var(--hair);border-radius:14px;padding:18px 20px}
.chart{width:100%;height:300px}
.heatwrap{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}
.heat{display:grid;gap:5px}
.hc{width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.metrics{display:flex;gap:22px;flex-wrap:wrap;margin:6px 0 14px}
.metric .n{font-family:Sora;font-size:22px;font-weight:700}
.metric .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}
.legend span{display:flex;align-items:center;gap:6px}
.legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
table{width:100%;border-collapse:collapse;font-size:14px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--hair)}
th{background:var(--teal);color:#fff;text-align:right;padding:11px 14px;font-weight:600;font-size:13px}
th:first-child{text-align:left}
td{padding:10px 14px;text-align:right;border-top:1px solid var(--hair)}
td:first-child{text-align:left;color:var(--muted)}
tr:nth-child(even){background:#f8fafc}
td.you{color:var(--teal2);font-weight:700}
.gap-bad{color:#dc2626;font-weight:700}.gap-good{color:#16a34a;font-weight:700}
.cat{padding:14px 0;border-bottom:1px solid var(--hair)}
.cat-top{display:flex;justify-content:space-between;align-items:baseline}
.cat-name{font-weight:600}.cat-score{font-family:Sora;font-weight:700;font-size:17px}.cat-score small{font-size:11px;color:var(--muted);font-weight:400}
.bar{height:7px;background:#eef2f5;border-radius:5px;margin:7px 0;overflow:hidden}.bar-fill{height:100%;border-radius:5px}
.cat-meta{font-size:12px;color:var(--muted)}
.issues{list-style:none;margin-top:10px}.issues.sm{margin-top:8px}
.issues li{display:flex;gap:10px;padding:6px 0}
.dot{flex:0 0 9px;width:9px;height:9px;border-radius:50%;margin-top:6px}
.it-title{font-weight:600;font-size:14px;display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.it-fix{font-size:13px;color:var(--muted);margin-top:2px}.it-fix b{color:var(--teal)}
.chip{font-size:11px;color:var(--muted);background:#eef2f5;border-radius:20px;padding:2px 9px;white-space:nowrap;font-weight:500}
.pri{border:1px solid var(--hair);border-radius:12px;padding:14px 18px;margin-bottom:12px}
.pri-h{display:flex;justify-content:space-between;align-items:center;font-family:Sora;font-weight:700;color:var(--teal);margin-bottom:4px}
.comp-list{display:flex;flex-direction:column;gap:6px}
.comp-row{display:flex;gap:10px;align-items:center;font-size:14px}.comp-row .pos{font-weight:700;color:var(--teal);width:26px}
.foot{padding:20px 48px 40px;color:var(--muted);font-size:12px;border-top:1px solid var(--hair)}
.foot .by{font-size:13px;color:var(--ink);font-weight:600;margin-bottom:3px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}.section,.hero{padding-left:24px;padding-right:24px}.scorecard-hero{margin-left:20px;margin-right:20px}}
@media print{.section{break-inside:avoid}}
</style></head>
<body><div class="wrap">
  <div class="hero">
    <div class="brand">${esc(brand.companyName)}</div>
    <h1>${esc(ui('reportTitle'))}</h1>
    <div class="sub">${esc(ui('heatMapSub', { keyword: heat?.keyword ?? evaluation.businessName }))}</div>
    <div class="biz">${esc(evaluation.businessName)} — ${esc(evaluation.city)}</div>
    <div class="date">${esc(dateStr)}</div>
  </div>

  <div class="scorecard-hero">
    <div class="ring"><div id="ring" style="width:118px;height:118px"></div></div>
    <div class="score-meta">
      <div class="lbl">${esc(ui('overallScore'))}</div>
      <div class="big">${r.mapPackPosition ? esc(ui('mapPackHeadline', { position: r.mapPackPosition })) : esc(ui('notRanking'))}</div>
    </div>
  </div>

  ${sub ? `<div class="section"><div class="summary"><ul>
    ${sub.invisiblePct !== null && sub.invisiblePct > 0 ? `<li>${esc(ui('summaryInvisible', { pct: sub.invisiblePct }))}</li>` : ''}
    ${sub.top3Pct !== null ? `<li>${esc(ui('summaryTop3', { pct: sub.top3Pct }))}</li>` : ''}
    ${cg?.leaderName && cg.reasons.length ? `<li>${esc(ui('beatingWhy', { leader: cg.leaderName, why: cg.reasons.map((rk) => GMB_REASON_LABELS[locale][rk] ?? rk).join(', ') }))}</li>` : ''}
    ${sub.fastWinCount > 0 ? `<li class="win">${esc(ui('summaryFastWins', { count: sub.fastWinCount }))}</li>` : ''}
  </ul></div></div>` : ''}

  ${radarData.length ? `<div class="section"><h2>${esc(ui('categoryScores'))}</h2><div class="rule"></div>
    <div id="radar" class="chart"></div></div>` : ''}

  ${heat ? `<div class="section"><h2>${esc(ui('heatMapTitle'))}</h2><div class="rule"></div>
    <div class="metrics">
      <div class="metric"><div class="n">${heat.avgRank ?? '—'}</div><div class="l">${esc(ui('avgRank'))}</div></div>
      <div class="metric"><div class="n" style="color:${scoreColor(heat.top3Pct)}">${heat.top3Pct}%</div><div class="l">${esc(ui('top3Coverage'))}</div></div>
      <div class="metric"><div class="n">${heat.top10Pct}%</div><div class="l">${esc(ui('top10Coverage'))}</div></div>
      <div class="metric"><div class="n" style="color:${heat.invisiblePct > 0 ? '#dc2626' : 'inherit'}">${heat.invisiblePct}%</div><div class="l">${esc(ui('invisible'))}</div></div>
    </div>
    <div class="heatwrap"><div class="heat" style="grid-template-columns:repeat(${heat.gridSize},30px)">${heatCells}</div></div>
    <div class="legend">${(['green', 'yellow', 'orange', 'red', 'none'] as const).map((b) => `<span><i style="background:${HEAT[b]}"></i>${esc(ui(b === 'green' ? 'heatGreen' : b === 'yellow' ? 'heatYellow' : b === 'orange' ? 'heatOrange' : b === 'red' ? 'heatRed' : 'heatGray'))}</span>`).join('')}</div>
    <p class="lead" style="margin-top:10px">${esc(ui('fastWinsNote'))}</p></div>` : ''}

  ${comps.length && cg ? `<div class="section"><h2>${esc(ui('whoBeating'))}</h2><div class="rule"></div>
    ${cg.leaderName && cg.reasons.length ? `<p class="lead">${esc(ui('beatingWhy', { leader: cg.leaderName, why: cg.reasons.map((rk) => GMB_REASON_LABELS[locale][rk] ?? rk).join(', ') }))}</p>` : ''}
    <div id="compchart" class="chart" style="height:240px"></div>
    <table><thead><tr><th>${esc(ui('metric'))}</th><th>${esc(ui('youLabel'))}</th>${comps.map((c) => `<th>${esc(c.name)}</th>`).join('')}<th>${esc(ui('gap'))}</th></tr></thead><tbody>${scorecardRows}</tbody></table></div>` : ''}

  ${(r.categories ?? []).length ? `<div class="section"><h2>${esc(ui('actionPlan'))}</h2><div class="rule"></div><p class="lead">${esc(ui('actionPlanLead'))}</p>
    ${planBucket('priority1', plan.p1, ui('thirtyDay'))}${planBucket('priority2', plan.p2, ui('ninetyDay'))}${planBucket('priority3', plan.p3, ui('ninetyDay'))}${planBucket('priority4', plan.p4, ui('ninetyDay'))}</div>` : ''}

  ${(r.categories ?? []).length ? `<div class="section"><h2>${esc(ui('overallScore'))}</h2><div class="rule"></div>${catCards}</div>` : ''}

  <div class="foot"><div class="by">${esc([brand.contactName || brand.companyName, brand.phone].filter(Boolean).join(' · '))}</div>
    ${esc(ui('dataSources'))}: ${esc(sources)}</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-gl@2.0.9/dist/echarts-gl.min.js"></script>
<script>
const D=${JSON.stringify(data)};const SCORE=${evaluation.overallScore};const RC="${scoreColor(evaluation.overallScore)}";
window.__charts=[];function mk(el){const c=echarts.init(el);window.__charts.push(c);return c}
// overall score ring
(function(){const c=mk(document.getElementById('ring'));c.setOption({series:[{type:'pie',radius:['72%','100%'],silent:true,label:{show:false},data:[{value:SCORE,itemStyle:{color:RC}},{value:100-SCORE,itemStyle:{color:'#eef2f5'}}]},{type:'pie',radius:[0,'70%'],silent:true,label:{position:'center',formatter:'{a|'+SCORE+'}\\n{b|/100}',rich:{a:{fontSize:30,fontWeight:800,fontFamily:'Sora',color:RC},b:{fontSize:12,color:'#94a3b8'}}},data:[{value:1,itemStyle:{color:'#fff'}}]}]})})();
// 3D category bar (echarts-gl) — the wow chart
(function(){const el=document.getElementById('radar');if(!el||!D.radar.length)return;const c=mk(el);
const names=D.radar.map(d=>d.name),vals=D.radar.map(d=>d.score);
c.setOption({tooltip:{},visualMap:{show:false,min:0,max:100,inRange:{color:['#dc2626','#d97706','#16a34a']}},
xAxis3D:{type:'category',data:names,axisLabel:{interval:0,rotate:35,fontSize:9}},yAxis3D:{type:'category',data:['']},zAxis3D:{type:'value',max:100},
grid3D:{boxWidth:150,boxDepth:18,boxHeight:60,viewControl:{distance:200,alpha:18,beta:18,autoRotate:false},light:{main:{intensity:1.1,shadow:true},ambient:{intensity:.35}}},
series:[{type:'bar3D',data:D.radar.map((d,i)=>[i,0,d.score]),shading:'realistic',bevelSize:.4,label:{show:false},itemStyle:{opacity:.95}}]})})();
// competitor reviews comparison (gradient bars)
(function(){const el=document.getElementById('compchart');if(!el)return;const c=mk(el);
const cats=['${esc(ui('youLabel'))}',...D.comps.map(x=>x.name)],vals=[D.clientReviews,...D.comps.map(x=>x.reviews)];
const colors=cats.map((_,i)=>i===0?'#1aa3a3':'#cbd5e1');
c.setOption({grid:{left:10,right:20,top:30,bottom:20,containLabel:true},title:{text:'${esc(GMB_SCORECARD_LABELS[locale]['reviews'] ?? 'Reviews')}',textStyle:{fontSize:13,color:'#64748b',fontFamily:'Sora'}},tooltip:{},
xAxis:{type:'category',data:cats,axisLabel:{fontSize:11}},yAxis:{type:'value'},
series:[{type:'bar',data:vals.map((v,i)=>({value:v,itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:colors[i]},{offset:1,color:i===0?'#0e6b6b':'#94a3b8'}]),borderRadius:[6,6,0,0]}})),barWidth:'46%',label:{show:true,position:'top',fontWeight:600}}]})})();
window.addEventListener('resize',()=>window.__charts.forEach(c=>c.resize()));
window.__chartsReady=true;
</script></body></html>`
}
