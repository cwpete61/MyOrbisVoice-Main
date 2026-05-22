/**
 * Bilingual catalog for the GMB Evaluation audit — shared by the partner-portal
 * screen (apps/web) and the PDF report (apps/api) so category labels, issue
 * titles, fix steps, and time estimates live in ONE place and can't drift.
 *
 * The audit engine is language-neutral: it emits issue KEYS + numeric PARAMS.
 * This catalog renders them. `{placeholders}` interpolate via gmbInterpolate().
 */
export type GmbLocale = 'en' | 'es'

export interface GmbIssueStrings { title: string; fix: string }

/** Interpolate {name} placeholders with params. */
export function gmbInterpolate(s: string, params: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`))
}

export const GMB_CATEGORY_LABELS: Record<GmbLocale, Record<string, string>> = {
  en: {
    gbpFoundation: 'Google Business Profile',
    categories: 'Categories & Services',
    reviews: 'Reviews',
    website: 'Website',
    geo: 'Local / Geo Relevance',
    topical: 'Service Content',
    citations: 'Citations & NAP',
    links: 'Backlinks & Authority',
    technical: 'Technical & Schema',
  },
  es: {
    gbpFoundation: 'Perfil de Negocio de Google',
    categories: 'Categorías y servicios',
    reviews: 'Reseñas',
    website: 'Sitio web',
    geo: 'Relevancia local / geográfica',
    topical: 'Contenido de servicios',
    citations: 'Citas y NAP',
    links: 'Backlinks y autoridad',
    technical: 'Técnico y schema',
  },
}

export const GMB_TIME_LABELS: Record<GmbLocale, Record<string, string>> = {
  en: { quick: '~15 min', medium: '1–2 hours', project: 'Multi-day project', ongoing: 'Ongoing effort' },
  es: { quick: '~15 min', medium: '1–2 horas', project: 'Proyecto de varios días', ongoing: 'Esfuerzo continuo' },
}

export const GMB_STATUS_LABELS: Record<GmbLocale, Record<string, string>> = {
  en: { measured: 'Measured', partial: 'Partially measured', deferred: 'Deeper scan available', needsConnect: 'Connect GBP to unlock' },
  es: { measured: 'Medido', partial: 'Parcialmente medido', deferred: 'Análisis profundo disponible', needsConnect: 'Conecta el GBP para desbloquear' },
}

/** Section/label chrome for the audit screen + report. */
export const GMB_UI: Record<GmbLocale, Record<string, string>> = {
  en: {
    overallScore: 'Overall Score',
    reportTitle: 'Local Visibility Report',
    mapPackHeadline: 'Ranks #{position} in the Google Map Pack',
    notRanking: 'Not appearing in the Google Map Pack',
    topGaps: 'Top priorities to fix',
    competitors: 'Who is winning the Map Pack',
    target: 'Target {expected}',
    fix: 'Fix',
    estTime: 'Est. time',
    dataSources: 'Data sources',
    reviewsCount: '{count} reviews',
    execSummary: 'The bottom line',
    heatMapTitle: 'Local rank heat map',
    heatMapSub: 'Where you rank for “{keyword}” across the area',
    avgRank: 'Avg rank',
    bestRank: 'Best',
    top3Coverage: 'Top-3 coverage',
    top10Coverage: 'Top-10 coverage',
    invisible: 'Invisible',
    whoBeating: 'Who’s beating you',
    beatingWhy: '{leader} is outranking you — they have {why}.',
    scorecard: 'Competitor scorecard',
    metric: 'Metric',
    youLabel: 'You',
    gap: 'Gap',
    fastWins: '{count} fast wins',
    heatGreen: 'Top 3 (1–3)',
    heatYellow: 'Close (4–8)',
    heatOrange: 'Weak (9–15)',
    heatRed: 'Poor (16+)',
    heatGray: 'Not found',
    summaryInvisible: 'You’re invisible in {pct}% of your local market.',
    summaryTop3: 'You rank in the top 3 across only {pct}% of the area.',
    summaryFastWins: 'The good news: {count} of your gaps are fast wins.',
    fastWinsNote: 'Yellow points are the fastest wins — you’re close to the top 3 there. Red points need more content, reviews, and authority.',
    categoryScores: 'Category scores',
    lostRevenueLabel: 'Estimated revenue going to competitors every month',
    lostRevenuePerYear: '≈ {amount} a year walking out the door',
    lostRevenueDisclaimer: 'Estimate based on your Map Pack visibility and industry-average search, conversion, and job-value assumptions. Not a guarantee.',
    mapHint: 'Each point is a search location near the business — the color shows where you rank there.',
    bookCta: 'Book a free strategy call',
    bookCtaSub: 'See exactly how to climb into the top 3 and stop losing these jobs to competitors.',
    bookCtaButton: 'Book my call',
    actionPlan: 'Recommended action plan',
    actionPlanLead: 'Start at Priority 1 — the fastest moves into the top 3. Priorities 2–4 build durable ranking over the next 90 days.',
    priority1: 'Priority 1 — fastest path into the top 3',
    priority2: 'Priority 2 — service & content gaps',
    priority3: 'Priority 3 — citations & authority',
    priority4: 'Priority 4 — long-term growth',
    thirtyDay: '~30-day focus',
    ninetyDay: '~90-day build',
  },
  es: {
    overallScore: 'Puntuación general',
    reportTitle: 'Informe de Visibilidad Local',
    mapPackHeadline: 'Aparece en el puesto #{position} del paquete de mapas de Google',
    notRanking: 'No aparece en el paquete de mapas de Google',
    topGaps: 'Prioridades a corregir',
    competitors: 'Quién domina el paquete de mapas',
    target: 'Meta {expected}',
    fix: 'Solución',
    estTime: 'Tiempo est.',
    dataSources: 'Fuentes de datos',
    reviewsCount: '{count} reseñas',
    execSummary: 'En resumen',
    heatMapTitle: 'Mapa de calor de posicionamiento local',
    heatMapSub: 'Dónde apareces para “{keyword}” en la zona',
    avgRank: 'Posición prom.',
    bestRank: 'Mejor',
    top3Coverage: 'Cobertura top 3',
    top10Coverage: 'Cobertura top 10',
    invisible: 'Invisible',
    whoBeating: 'Quién te está superando',
    beatingWhy: '{leader} te está superando — tienen {why}.',
    scorecard: 'Comparativa de competidores',
    metric: 'Métrica',
    youLabel: 'Tú',
    gap: 'Diferencia',
    fastWins: '{count} victorias rápidas',
    heatGreen: 'Top 3 (1–3)',
    heatYellow: 'Cerca (4–8)',
    heatOrange: 'Débil (9–15)',
    heatRed: 'Pobre (16+)',
    heatGray: 'No aparece',
    summaryInvisible: 'Eres invisible en el {pct}% de tu mercado local.',
    summaryTop3: 'Apareces en el top 3 solo en el {pct}% de la zona.',
    summaryFastWins: 'La buena noticia: {count} de tus brechas son victorias rápidas.',
    fastWinsNote: 'Los puntos amarillos son las victorias más rápidas — estás cerca del top 3. Los rojos necesitan más contenido, reseñas y autoridad.',
    categoryScores: 'Puntuaciones por categoría',
    lostRevenueLabel: 'Ingresos estimados que van a los competidores cada mes',
    lostRevenuePerYear: '≈ {amount} al año que se escapan',
    lostRevenueDisclaimer: 'Estimación basada en tu visibilidad en el paquete de mapas y supuestos promedio de búsquedas, conversión y valor de trabajo. No es una garantía.',
    mapHint: 'Cada punto es una ubicación de búsqueda cerca del negocio — el color muestra tu posición ahí.',
    bookCta: 'Agenda una llamada de estrategia gratis',
    bookCtaSub: 'Descubre exactamente cómo llegar al top 3 y dejar de perder estos trabajos ante la competencia.',
    bookCtaButton: 'Agendar mi llamada',
    actionPlan: 'Plan de acción recomendado',
    actionPlanLead: 'Empieza por la Prioridad 1 — los movimientos más rápidos hacia el top 3. Las Prioridades 2–4 construyen posicionamiento duradero en los próximos 90 días.',
    priority1: 'Prioridad 1 — camino más rápido al top 3',
    priority2: 'Prioridad 2 — brechas de servicios y contenido',
    priority3: 'Prioridad 3 — citas y autoridad',
    priority4: 'Prioridad 4 — crecimiento a largo plazo',
    thirtyDay: 'Enfoque ~30 días',
    ninetyDay: 'Construcción ~90 días',
  },
}

/** "Why they're beating you" reason fragments (joined into the callout sentence). */
export const GMB_REASON_LABELS: Record<GmbLocale, Record<string, string>> = {
  en: { reviews: 'more reviews', categories: 'more categories', servicePages: 'more service pages', geoPages: 'better local page coverage', schema: 'structured data markup' },
  es: { reviews: 'más reseñas', categories: 'más categorías', servicePages: 'más páginas de servicio', geoPages: 'mejor cobertura de páginas locales', schema: 'datos estructurados' },
}

/** Competitor-scorecard row labels. */
export const GMB_SCORECARD_LABELS: Record<GmbLocale, Record<string, string>> = {
  en: { reviews: 'Reviews', rating: 'Avg rating', categories: 'GBP categories', servicePages: 'Service pages', locationPages: 'Location pages', mapPack: 'Map Pack position' },
  es: { reviews: 'Reseñas', rating: 'Calificación prom.', categories: 'Categorías GBP', servicePages: 'Páginas de servicio', locationPages: 'Páginas de ubicación', mapPack: 'Posición en el paquete' },
}

export const GMB_DATA_SOURCE_LABELS: Record<GmbLocale, Record<string, string>> = {
  en: { serper: 'Google Maps data', 'serper-reviews': 'Reviews', website: 'Website scan', pagespeed: 'PageSpeed Insights', heatmap: 'Rank-grid heat map', competitors: 'Competitor analysis' },
  es: { serper: 'Datos de Google Maps', 'serper-reviews': 'Reseñas', website: 'Análisis del sitio', pagespeed: 'PageSpeed Insights', heatmap: 'Mapa de calor', competitors: 'Análisis de competidores' },
}

const EN_ISSUES: Record<string, GmbIssueStrings> = {
  // GBP foundation
  noWebsite: { title: 'No website on the profile', fix: 'Add the business website to the Google Business Profile.' },
  noPhone: { title: 'No phone number', fix: 'Add a local phone number that rings the business directly.' },
  noAddress: { title: 'No address shown', fix: 'Add or verify the business address (or set a service area).' },
  noHours: { title: 'Hours not set', fix: 'Add regular hours, plus holiday and special hours.' },
  noPhotos: { title: 'Few or no photos', fix: 'Upload exterior, interior, team, and work photos.' },
  // Categories
  noCategory: { title: 'No primary category', fix: 'Set the most specific primary category for the business.' },
  fewCategories: { title: 'Only {count} category set', fix: 'Add the relevant secondary categories competitors use.' },
  addSecondary: { title: 'Room for more categories', fix: 'Add 1–2 more relevant secondary categories ({count} set today).' },
  // Reviews
  lowVolume: { title: 'Low review volume ({count})', fix: 'Run a review-request campaign to recent customers (market median is {marketMedian}).' },
  lowRating: { title: 'Rating below 4.0 ({rating}★)', fix: 'Resolve service issues, then ask satisfied customers for honest reviews.' },
  staleReviews: { title: 'Reviews are stale ({days} days old)', fix: 'Restart steady review requests — recency is a ranking signal.' },
  lowVelocity: { title: 'Slow review growth (~{perMonth}/mo)', fix: 'Build a habit of requesting a few new reviews every week.' },
  noResponses: { title: 'Few owner responses ({pct}%)', fix: 'Reply to every review — it signals an active, engaged business.' },
  // Website
  noWebsiteListed: { title: 'No website to analyze', fix: 'Add a website — it is the strongest ranking asset outside the GBP.' },
  unreachable: { title: 'Website is unreachable', fix: 'Fix hosting or DNS so the site loads reliably for visitors and Google.' },
  noHttps: { title: 'Site is not on HTTPS', fix: 'Install an SSL certificate and force all traffic to HTTPS.' },
  noNapOnSite: { title: 'Name/address/phone not found on the site', fix: 'Show full NAP on every page (the footer is fine).' },
  noClickToCall: { title: 'No click-to-call link', fix: 'Make the phone number a tap-to-call link on mobile.' },
  noServicePages: { title: 'No dedicated service pages', fix: 'Build one focused page per core service.' },
  weakTitle: { title: 'Weak homepage title', fix: 'Write a page title with the main service and city.' },
  noH1: { title: 'Missing H1 heading', fix: 'Add a clear H1 naming the primary service.' },
  // Geo
  notInPack: { title: 'Not in the local map pack', fix: 'Build local relevance: a city page, consistent NAP, and proximity signals.' },
  outsideTop3: { title: 'Ranks #{position}, outside the top 3', fix: 'Strengthen geo signals and reviews to climb into the 3-pack.' },
  cityNotMentioned: { title: 'City not mentioned on the homepage', fix: 'Reference {city} in the title, H1, and body copy.' },
  noLocationPage: { title: 'No location / service-area page', fix: 'Add a city or service-area page with genuine local detail.' },
  // Topical
  siteNeededForTopical: { title: 'Service content not assessed', fix: 'A reachable website is required to assess service content.' },
  noServiceContent: { title: 'No service content found', fix: 'Add pages that explain each service in depth.' },
  thinServiceCoverage: { title: 'Thin service coverage ({count} pages)', fix: 'Expand to a dedicated page per major service.' },
  thinContent: { title: 'Thin homepage content', fix: 'Add helpful, specific content (aim for 300+ words).' },
  noFaq: { title: 'No FAQ content or schema', fix: 'Add an FAQ section marked up with FAQPage schema.' },
  // Citations
  fullCitationScanDeferred: { title: 'Full directory citation audit available', fix: 'A deeper scan checks NAP across Yelp, Apple, Bing, BBB, and data aggregators.' },
  phoneNotOnSite: { title: 'Phone not found on the website', fix: 'Show the GBP phone number on the site for NAP consistency.' },
  addressNotOnSite: { title: 'Address not found on the website', fix: 'Show the GBP address on the site for NAP consistency.' },
  // Links
  backlinkScanDeferred: { title: 'Backlink & authority scan available', fix: 'A deeper scan measures local backlinks, citations, and domain authority.' },
  // Technical
  siteNeededForTechnical: { title: 'Technical health not assessed', fix: 'A reachable website is required to assess technical health.' },
  noSchema: { title: 'No schema.org markup', fix: 'Add LocalBusiness and Service structured data.' },
  slowSite: { title: 'Slow page speed ({score}/100)', fix: 'Optimize images, caching, and scripts to speed up the site.' },
  poorLcp: { title: 'Slow loading ({lcp}s)', fix: 'Reduce the largest content element’s load time below 2.5 seconds.' },
  layoutShift: { title: 'Layout shifts while loading ({cls})', fix: 'Reserve space for images and ads so content stops jumping.' },
  notMobileFriendly: { title: 'Not mobile-friendly', fix: 'Fix the mobile layout and tap-target sizing.' },
}

const ES_ISSUES: Record<string, GmbIssueStrings> = {
  noWebsite: { title: 'Sin sitio web en el perfil', fix: 'Agrega el sitio web del negocio al Perfil de Negocio de Google.' },
  noPhone: { title: 'Sin número de teléfono', fix: 'Agrega un teléfono local que suene directamente en el negocio.' },
  noAddress: { title: 'Sin dirección visible', fix: 'Agrega o verifica la dirección (o define un área de servicio).' },
  noHours: { title: 'Horario no configurado', fix: 'Agrega el horario regular, festivos y horarios especiales.' },
  noPhotos: { title: 'Pocas o ninguna foto', fix: 'Sube fotos del exterior, interior, equipo y trabajos.' },
  noCategory: { title: 'Sin categoría principal', fix: 'Define la categoría principal más específica para el negocio.' },
  fewCategories: { title: 'Solo {count} categoría configurada', fix: 'Agrega las categorías secundarias relevantes que usan los competidores.' },
  addSecondary: { title: 'Espacio para más categorías', fix: 'Agrega 1–2 categorías secundarias relevantes ({count} configuradas hoy).' },
  lowVolume: { title: 'Pocas reseñas ({count})', fix: 'Haz una campaña de solicitud de reseñas a clientes recientes (la mediana del mercado es {marketMedian}).' },
  lowRating: { title: 'Calificación por debajo de 4.0 ({rating}★)', fix: 'Resuelve problemas de servicio y pide reseñas honestas a clientes satisfechos.' },
  staleReviews: { title: 'Reseñas antiguas (hace {days} días)', fix: 'Reactiva las solicitudes de reseñas — la recencia es una señal de posicionamiento.' },
  lowVelocity: { title: 'Crecimiento lento de reseñas (~{perMonth}/mes)', fix: 'Adquiere el hábito de pedir algunas reseñas nuevas cada semana.' },
  noResponses: { title: 'Pocas respuestas del propietario ({pct}%)', fix: 'Responde a cada reseña — demuestra un negocio activo y comprometido.' },
  noWebsiteListed: { title: 'Sin sitio web para analizar', fix: 'Agrega un sitio web — es el activo de posicionamiento más fuerte fuera del GBP.' },
  unreachable: { title: 'El sitio web no responde', fix: 'Corrige el hosting o DNS para que el sitio cargue de forma confiable.' },
  noHttps: { title: 'El sitio no usa HTTPS', fix: 'Instala un certificado SSL y fuerza todo el tráfico a HTTPS.' },
  noNapOnSite: { title: 'Nombre/dirección/teléfono no aparecen en el sitio', fix: 'Muestra el NAP completo en cada página (el pie de página sirve).' },
  noClickToCall: { title: 'Sin enlace de clic para llamar', fix: 'Convierte el teléfono en un enlace para llamar con un toque en móvil.' },
  noServicePages: { title: 'Sin páginas de servicio dedicadas', fix: 'Crea una página enfocada por cada servicio principal.' },
  weakTitle: { title: 'Título de la página de inicio débil', fix: 'Escribe un título con el servicio principal y la ciudad.' },
  noH1: { title: 'Falta el encabezado H1', fix: 'Agrega un H1 claro que nombre el servicio principal.' },
  notInPack: { title: 'No aparece en el paquete de mapas local', fix: 'Construye relevancia local: página de ciudad, NAP consistente y señales de proximidad.' },
  outsideTop3: { title: 'Aparece en el puesto #{position}, fuera del top 3', fix: 'Refuerza señales geográficas y reseñas para entrar al top 3.' },
  cityNotMentioned: { title: 'La ciudad no se menciona en la página de inicio', fix: 'Menciona {city} en el título, el H1 y el contenido.' },
  noLocationPage: { title: 'Sin página de ubicación / área de servicio', fix: 'Agrega una página de ciudad o área de servicio con detalle local real.' },
  siteNeededForTopical: { title: 'Contenido de servicios no evaluado', fix: 'Se requiere un sitio web accesible para evaluar el contenido de servicios.' },
  noServiceContent: { title: 'No se encontró contenido de servicios', fix: 'Agrega páginas que expliquen cada servicio en profundidad.' },
  thinServiceCoverage: { title: 'Cobertura de servicios escasa ({count} páginas)', fix: 'Amplía a una página dedicada por servicio principal.' },
  thinContent: { title: 'Contenido escaso en la página de inicio', fix: 'Agrega contenido útil y específico (apunta a 300+ palabras).' },
  noFaq: { title: 'Sin contenido ni schema de FAQ', fix: 'Agrega una sección de preguntas frecuentes con schema FAQPage.' },
  fullCitationScanDeferred: { title: 'Auditoría completa de citas disponible', fix: 'Un análisis profundo revisa el NAP en Yelp, Apple, Bing, BBB y agregadores de datos.' },
  phoneNotOnSite: { title: 'El teléfono no aparece en el sitio web', fix: 'Muestra el teléfono del GBP en el sitio para mantener consistencia del NAP.' },
  addressNotOnSite: { title: 'La dirección no aparece en el sitio web', fix: 'Muestra la dirección del GBP en el sitio para mantener consistencia del NAP.' },
  backlinkScanDeferred: { title: 'Análisis de backlinks y autoridad disponible', fix: 'Un análisis profundo mide backlinks locales, citas y autoridad del dominio.' },
  siteNeededForTechnical: { title: 'Salud técnica no evaluada', fix: 'Se requiere un sitio web accesible para evaluar la salud técnica.' },
  noSchema: { title: 'Sin marcado schema.org', fix: 'Agrega datos estructurados de LocalBusiness y Service.' },
  slowSite: { title: 'Velocidad de página lenta ({score}/100)', fix: 'Optimiza imágenes, caché y scripts para acelerar el sitio.' },
  poorLcp: { title: 'Carga lenta ({lcp}s)', fix: 'Reduce el tiempo de carga del elemento principal por debajo de 2.5 segundos.' },
  layoutShift: { title: 'Cambios de diseño al cargar ({cls})', fix: 'Reserva espacio para imágenes y anuncios para que el contenido no salte.' },
  notMobileFriendly: { title: 'No es apto para móviles', fix: 'Corrige el diseño móvil y el tamaño de los botones táctiles.' },
}

export const GMB_ISSUE_CATALOG: Record<GmbLocale, Record<string, GmbIssueStrings>> = {
  en: EN_ISSUES,
  es: ES_ISSUES,
}

/** Minimal issue shape the action-plan grouper needs (decoupled from the
 *  engine's Issue type so this package stays dependency-free). */
export interface GmbActionIssue {
  key: string
  category: string
  severity: string
  timeTier: string
  params: Record<string, string | number>
}

/** Group the audit's issues into the prioritized action plan (Priority 1–4),
 *  the spec's "what to do first" close. Deterministic, pure. Excludes
 *  informational/deferred placeholders. Each issue lands in exactly one bucket:
 *   P1 fastest path  — quick/medium impactful fixes (lift map-pack now)
 *   P2 content gaps  — project-scale service/content/category builds
 *   P3 authority     — citations & backlinks
 *   P4 long-term     — ongoing effort + everything else
 */
export function buildActionPlan(issues: GmbActionIssue[]): {
  p1: GmbActionIssue[]; p2: GmbActionIssue[]; p3: GmbActionIssue[]; p4: GmbActionIssue[]
} {
  const p1: GmbActionIssue[] = [], p2: GmbActionIssue[] = [], p3: GmbActionIssue[] = [], p4: GmbActionIssue[] = []
  for (const it of issues) {
    if (it.key.endsWith('Deferred') || it.key.startsWith('siteNeeded')) continue
    if (it.category === 'citations' || it.category === 'links') p3.push(it)
    else if ((it.timeTier === 'quick' || it.timeTier === 'medium') && it.severity !== 'minor') p1.push(it)
    else if (it.timeTier === 'project') p2.push(it)
    else p4.push(it)
  }
  return { p1, p2, p3, p4 }
}

/** Resolve an issue's localized title + fix with params applied. Falls back to
 *  the key itself if an issue is missing (defensive against engine/catalog drift). */
export function gmbIssueText(locale: GmbLocale, key: string, params: Record<string, string | number> = {}): GmbIssueStrings {
  const entry = GMB_ISSUE_CATALOG[locale][key] ?? GMB_ISSUE_CATALOG.en[key]
  if (!entry) return { title: key, fix: '' }
  return { title: gmbInterpolate(entry.title, params), fix: gmbInterpolate(entry.fix, params) }
}
