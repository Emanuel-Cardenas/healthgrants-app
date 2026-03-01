/**
 * ═══════════════════════════════════════════════════════════════
 * AGENTE 1 — DEEP RESEARCH ENGINE (v6)
 * ═══════════════════════════════════════════════════════════════
 * YedaTech Search Agent — Investigación profunda con IA
 * 
 * MEJORAS v6:
 * - Gemini genera queries inteligentes (sinónimos, MeSH, variantes)
 * - Multi-buscador: DuckDuckGo + Bing + Brave (3x cobertura)
 * - 25+ portales oficiales (más CORDIS, AHRQ, etc.)
 * - Deep Crawling: sigue hasta 8 sub-links por sitio
 * - Análisis profundo de 25 resultados (antes 20)
 * - Sin APIs de pago, todo con web scraping + Gemini
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
let pdfParse;
try { pdfParse = require('pdf-parse'); } catch { pdfParse = null; }

let geminiModel = null;
function setGeminiModel(model) { geminiModel = model; }

const SOURCES = {
    international: [
        { name: 'NIH', url: 'https://search.grants.nih.gov/guide/api/v1/search', type: 'api', region: 'EE.UU. / Global', flag: '🇺🇸', entity: 'National Institutes of Health (NIH)' },
        { name: 'WHO', url: 'https://www.who.int', type: 'scrape', region: 'Global', flag: '🌐', entity: 'World Health Organization (WHO)' },
        { name: 'Wellcome Trust', url: 'https://wellcome.org/grant-funding', type: 'scrape', region: 'Global', flag: '🇬🇧', entity: 'Wellcome Trust' },
        { name: 'Gates Foundation', url: 'https://www.gatesfoundation.org/about/how-we-work/grant-opportunities', type: 'scrape', region: 'Global', flag: '🌐', entity: 'Bill &amp; Melinda Gates Foundation' },
        { name: 'Fogarty', url: 'https://www.fic.nih.gov/Funding/Pages/default.aspx', type: 'scrape', region: 'Global', flag: '🇺🇸', entity: 'NIH Fogarty International Center' },
        { name: 'Grants.gov', url: 'https://www.grants.gov/search-grants', type: 'scrape', region: 'EE.UU.', flag: '🇺🇸', entity: 'Grants.gov (Federal)' },
        { name: 'NIMH', url: 'https://www.nimh.nih.gov/funding', type: 'scrape', region: 'EE.UU. / Global', flag: '🇺🇸', entity: 'National Institute of Mental Health (NIMH)' },
        { name: 'NCI', url: 'https://www.cancer.gov/grants-training', type: 'scrape', region: 'EE.UU. / Global', flag: '🇺🇸', entity: 'National Cancer Institute (NCI)' },
        { name: 'AHRQ', url: 'https://www.ahrq.gov/funding/index.html', type: 'scrape', region: 'EE.UU. / Global', flag: '🇺🇸', entity: 'Agency for Healthcare Research and Quality' },
        { name: 'CDC Foundation', url: 'https://www.cdcfoundation.org/grants', type: 'scrape', region: 'EE.UU. / Global', flag: '🇺🇸', entity: 'CDC Foundation' },
    ],
    europe: [
        { name: 'Horizon Europe', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/', type: 'scrape', region: 'Europa', flag: '🇪🇺', entity: 'Comisión Europea — Horizon Europe' },
        { name: 'CORDIS', url: 'https://cordis.europa.eu/search?q=health&amp;type=programme', type: 'scrape', region: 'Europa', flag: '🇪🇺', entity: 'CORDIS — Investigación UE' },
        { name: 'UKRI', url: 'https://www.ukri.org/opportunity/', type: 'scrape', region: 'Reino Unido', flag: '🇬🇧', entity: 'UK Research and Innovation (UKRI)' },
        { name: 'DFG', url: 'https://www.dfg.de/en/research-funding/funding-opportunities', type: 'scrape', region: 'Alemania', flag: '🇩🇪', entity: 'Deutsche Forschungsgemeinschaft (DFG)' },
        { name: 'ERC', url: 'https://erc.europa.eu/apply-grant', type: 'scrape', region: 'Europa', flag: '🇪🇺', entity: 'European Research Council' },
    ],
    latam: [
        { name: 'MinCiencias', url: 'https://minciencias.gov.co/convocatorias', type: 'scrape', region: 'Colombia', flag: '🇨🇴', entity: 'Ministerio de Ciencia, Tecnología e Innovación' },
        { name: 'CONICET', url: 'https://convocatorias.conicet.gov.ar/', type: 'scrape', region: 'Argentina', flag: '🇦🇷', entity: 'CONICET Argentina' },
        { name: 'ANID', url: 'https://www.anid.cl/concursos/', type: 'scrape', region: 'Chile', flag: '🇨🇱', entity: 'ANID Chile' },
        { name: 'PAHO', url: 'https://www.paho.org/en/grants-and-fellowships', type: 'scrape', region: 'Latinoamérica', flag: '🌎', entity: 'PAHO/OPS' },
        { name: 'FONDECYT', url: 'https://www.anid.cl/fondecyt/', type: 'scrape', region: 'Chile', flag: '🇨🇱', entity: 'FONDECYT Chile' },
        { name: 'Bogotá Salud', url: 'https://bogota.gov.co/tag/salud', type: 'scrape', region: 'Colombia', flag: '🇨🇴', entity: 'Alcaldía de Bogotá — Salud' },
        { name: 'CONACYT', url: 'https://conahcyt.mx/convocatorias/', type: 'scrape', region: 'México', flag: '🇲🇽', entity: 'CONAHCYT México' },
        { name: 'FAPESP', url: 'https://fapesp.br/oportunidades', type: 'scrape', region: 'Brasil', flag: '🇧🇷', entity: 'FAPESP Brasil' },
    ]
};

const REGION_SOURCES = {
    'global': [...SOURCES.international, ...SOURCES.europe, ...SOURCES.latam],
    'norteamerica': SOURCES.international,
    'europa': [...SOURCES.international.slice(0, 1), ...SOURCES.europe],
    'latinoamerica': [...SOURCES.latam, SOURCES.international[0]],
    'colombia': [SOURCES.latam[0], SOURCES.latam[5], SOURCES.latam[3], SOURCES.international[0]],
    'argentina': [SOURCES.latam[1], SOURCES.latam[3], SOURCES.international[0]],
    'chile': [SOURCES.latam[2], SOURCES.latam[4], SOURCES.latam[3], SOURCES.international[0]],
};

const FETCH_OPTS = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
    },
    timeout: 15000,
    redirect: 'follow',
};

async function generateSmartQueries(userQuery) {
    const baseQueries = generateBasicQueries(userQuery);
    if (!geminiModel) return baseQueries;

    try {
        const prompt = `Eres un experto en búsqueda de convocatorias de investigación en salud.
El usuario busca: "${userQuery}"

Genera EXACTAMENTE 8 queries de búsqueda web optimizados para encontrar convocatorias ABIERTAS y específicas.
Las queries deben ser DIVERSAS y cubrir:
1. Términos técnicos en inglés (ej: MeSH terms, nombres oficiales de programas)
2. Variantes en español
3. Nombres de organizaciones que financian este tema
4. Términos sinónimos y relacionados

Responde SOLO con un JSON array de strings, sin markdown:
["query 1", "query 2", ...]

REGLAS:
- Incluye site:gov OR site:org para buscar en sitios oficiales
- Incluye el año actual (2025/2026)
- No repitas la misma query con variaciones menores
- Mezcla inglés y español`;

        const result = await geminiModel.generateContent(prompt);
        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`  🧠 Gemini generó ${parsed.length} queries inteligentes`);
            const combined = [...parsed.slice(0, 8), ...baseQueries.slice(0, 4)];
            return [...new Set(combined)];
        }
    } catch (err) {
        console.log(`  ⚠️ Gemini queries fallback: ${err.message}`);
    }
    return baseQueries;
}

function generateBasicQueries(userQuery) {
    const q = userQuery.trim();
    if (!q) return ['health research grants open call 2025 2026', 'convocatorias investigación salud abiertas 2025'];
    return [
        `${q} grant open call 2025 2026`,
        `${q} research funding opportunity application deadline`,
        `"${q}" grants site:.gov OR site:.edu OR site:.org`,
        `${q} call for proposals health research 2025`,
        `${q} fellowship award funding open`,
        `${q} grant application deadline eligibility`,
        `${q} convocatoria abierta investigación financiación 2025`,
        `${q} beca investigación salud convocatoria vigente`,
        `"${q}" convocatoria financiamiento site:.gov OR site:.edu OR site:.org`,
    ];
}

async function fetchPage(url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { ...FETCH_OPTS, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html') && !ct.includes('xhtml')) return null;
        const html = await res.text();
        return { html, finalUrl: res.url };
    } catch { return null; }
}

async function fetchPdf(url) {
    if (!pdfParse) return null;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(url, { ...FETCH_OPTS, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('pdf')) return null;
        const buffer = await res.buffer();
        if (buffer.length > 10 * 1024 * 1024) return null;
        const data = await pdfParse(buffer);
        return { text: data.text || '', pages: data.numpages || 0, finalUrl: url };
    } catch { return null; }
}

async function searchDuckDuckGo(query) {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, FETCH_OPTS);
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        $('.result').each((i, el) => {
            if (i >= 15) return false;
            const title = $(el).find('.result__title a').text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();
            let link = $(el).find('.result__title a').attr('href') || '';
            if (link.includes('uddg=')) {
                try { link = new URL(link, 'https://duckduckgo.com').searchParams.get('uddg') || link; } catch { }
            }
            if (title && link && link.startsWith('http')) results.push({ title, snippet, link, source: 'web_search' });
        });
        return results;
    } catch { return []; }
}

async function searchBing(query) {
    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
        const res = await fetch(url, {
            ...FETCH_OPTS,
            headers: { ...FETCH_OPTS.headers, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        $('li.b_algo').each((i, el) => {
            if (i >= 10) return false;
            const title = $(el).find('h2 a').text().trim();
            const link = $(el).find('h2 a').attr('href') || '';
            const snippet = $(el).find('.b_caption p').text().trim();
            if (title && link && link.startsWith('http')) results.push({ title, snippet, link, source: 'bing_search' });
        });
        return results;
    } catch { return []; }
}

async function searchBrave(query) {
    try {
        const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            ...FETCH_OPTS,
            headers: { ...FETCH_OPTS.headers, 'Accept': 'text/html' }
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        $('.snippet').each((i, el) => {
            if (i >= 10) return false;
            const title = $(el).find('.snippet-title').text().trim();
            const link = $(el).find('a').first().attr('href') || '';
            const snippet = $(el).find('.snippet-description').text().trim();
            if (title && link && link.startsWith('http')) results.push({ title, snippet, link, source: 'brave_search' });
        });
        return results;
    } catch { return []; }
}

async function multiSearch(query) {
    const [ddg, bing, brave] = await Promise.allSettled([
        searchDuckDuckGo(query),
        searchBing(query),
        searchBrave(query),
    ]);
    const results = [];
    if (ddg.status === 'fulfilled') results.push(...ddg.value);
    if (bing.status === 'fulfilled') results.push(...bing.value);
    if (brave.status === 'fulfilled') results.push(...brave.value);
    return results;
}

async function searchNIH(userQuery) {
    try {
        const url = `https://search.grants.nih.gov/guide/api/v1/search?query=${encodeURIComponent(userQuery)}&type=active,notice&from=0&size=20&sort=relevance`;
        const res = await fetch(url, { ...FETCH_OPTS, headers: { ...FETCH_OPTS.headers, Accept: 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        const results = [];
        if (data.data && data.data.hits) {
            data.data.hits.forEach(hit => {
                const s = hit._source || {};
                results.push({
                    title: s.title || s.primaryTitle || 'NIH Funding Opportunity',
                    link: s.docUrl || 'https://grants.nih.gov/grants/guide/',
                    snippet: s.abstract || s.synopsis || '',
                    openDate: s.openDate || null,
                    closeDate: s.expDate || s.closeDate || null,
                    source: 'NIH API',
                    sourceMeta: { entity: s.primaryIcName ? `NIH — ${s.primaryIcName}` : 'NIH', region: 'EE.UU. / Global', flag: '🇺🇸' },
                    nihData: { docNum: s.docNum, primaryIC: s.primaryIcName, activityCode: s.activityCode },
                });
            });
        }
        return results;
    } catch { return []; }
}

async function scrapeSourceWithNavigation(source, userQuery) {
    try {
        const page = await fetchPage(source.url);
        if (!page) return [];
        const $ = cheerio.load(page.html);
        const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const results = [];
        const seenUrls = new Set();

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (!text || text.length < 10) return;
            const fullUrl = resolveUrl(href, source.url);
            if (!fullUrl || seenUrls.has(fullUrl)) return;
            const combined = `${text} ${href}`.toLowerCase();
            let score = 0;
            queryWords.forEach(w => { if (combined.includes(w)) score += 5; });
            if (score > 0 || isLikelyGrant(text, href)) {
                seenUrls.add(fullUrl);
                results.push({
                    title: text.substring(0, 250), link: fullUrl, source: source.name,
                    sourceMeta: { entity: source.entity, region: source.region, flag: source.flag },
                    queryRelevance: score,
                });
            }
        });
        return results.sort((a, b) => b.queryRelevance - a.queryRelevance).slice(0, 12);
    } catch { return []; }
}

function isSpecificGrantPage($, url) {
    const bodyText = $('body').text().toLowerCase();
    const title = $('title').text().toLowerCase();
    const specificInd = ['deadline', 'fecha límite', 'fecha de cierre', 'due date', 'closing date',
        'eligibility', 'elegibilidad', 'requisitos', 'requirements', 'who may apply',
        'how to apply', 'cómo aplicar', 'application process', 'award amount', 'funding amount',
        'monto', 'call for proposals', 'request for applications', 'notice of funding',
        'submit', 'postular', 'apply now', 'letter of intent', 'activity code', 'rfa-', 'pa-', 'par-'];
    const generalInd = ['all grants', 'all opportunities', 'browse', 'search results',
        'our mission', 'about us', 'contact us', 'privacy policy', 'terms of use', 'log in', 'sign up', 'sitemap'];
    let spec = 0, gen = 0;
    specificInd.forEach(ind => { if (bodyText.includes(ind)) spec++; if (title.includes(ind)) spec += 2; });
    generalInd.forEach(ind => { if (bodyText.includes(ind) || title.includes(ind)) gen++; });
    return spec >= 2 && spec > gen;
}

async function deepCrawlSite($, baseUrl, userQuery) {
    const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const candidateLinks = [];

    $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (!text || text.length < 10 || text.length > 300) return;
        const fullUrl = resolveUrl(href, baseUrl);
        if (!fullUrl) return;
        const combined = `${text} ${href}`.toLowerCase();
        let score = 0;
        queryWords.forEach(word => { if (combined.includes(word)) score += 10; });
        const grantWords = ['grant', 'fund', 'call', 'convocatoria', 'opportunity', 'fellowship',
            'award', 'beca', 'apply', 'deadline', 'proposal', 'concurso', 'application',
            'funding', 'research', 'investigación', 'open', 'abierta', 'notice', 'announcement'];
        grantWords.forEach(gw => { if (combined.includes(gw)) score += 3; });
        const genericWords = ['about', 'contact', 'login', 'signup', 'privacy', 'terms', 'home',
            'newsletter', 'subscribe', 'cookie', 'faq', 'help', 'twitter', 'facebook', 'youtube'];
        genericWords.forEach(gw => { if (combined.includes(gw)) score -= 20; });
        if (score > 5) candidateLinks.push({ url: fullUrl, text, score });
    });

    candidateLinks.sort((a, b) => b.score - a.score);
    const topCandidates = candidateLinks.slice(0, 8);

    const pagePromises = topCandidates.map(async (candidate) => {
        try {
            const page = await fetchPage(candidate.url);
            if (!page) return null;
            const $sub = cheerio.load(page.html);
            const subText = $sub('body').text().toLowerCase();
            let relevance = 0;
            queryWords.forEach(word => { if (subText.includes(word)) relevance++; });
            if (relevance >= Math.min(2, queryWords.length) || isSpecificGrantPage($sub, candidate.url)) {
                return {
                    url: page.finalUrl, title: $sub('title').text().trim() || candidate.text,
                    $: $sub, html: page.html, isSpecific: isSpecificGrantPage($sub, candidate.url),
                    relevance, navigatedFrom: baseUrl,
                };
            }
            return null;
        } catch { return null; }
    });

    const settled = await Promise.allSettled(pagePromises);
    return settled.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
}

function extractDateFromText(text) {
    if (!text) return null;
    const patterns = [
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i,
        /\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}/i,
        /\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-,]*\d{4}/i,
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}/i,
        /\d{4}-\d{2}-\d{2}/,
        /\d{1,2}\/\d{1,2}\/\d{4}/,
        /\d{1,2}-\d{1,2}-\d{4}/,
    ];
    for (const pat of patterns) { const m = text.match(pat); if (m) return m[0].trim(); }
    return null;
}

function extractGrantData($, url) {
    const bodyText = $('body').text();
    const data = {};
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const metaDeadline = $('meta[name="deadline"]').attr('content') || $('meta[property="article:expiration_time"]').attr('content');
    const metaStart = $('meta[name="start_date"]').attr('content') || $('meta[property="article:published_time"]').attr('content');
    if (metaDeadline) data.closeDate = metaDeadline;
    if (metaStart) data.openDate = metaStart;

    $('table tr, dl, .deadline, .date, [class*="date"], [class*="deadline"], time').each((i, el) => {
        const text = $(el).text().trim();
        const lower = text.toLowerCase();
        const dateM = extractDateFromText(text);
        if (dateM) {
            if (!data.closeDate && (lower.includes('deadline') || lower.includes('close') || lower.includes('cierre') ||
                lower.includes('due') || lower.includes('fecha límite') || lower.includes('expir') || lower.includes('submission'))) {
                data.closeDate = dateM;
            } else if (!data.openDate && (lower.includes('open') || lower.includes('start') || lower.includes('apertura') ||
                lower.includes('posted') || lower.includes('begin') || lower.includes('available'))) {
                data.openDate = dateM;
            }
        }
    });

    for (let li = 0; li < lines.length && (!data.closeDate || !data.openDate); li++) {
        const contextBlock = lines.slice(Math.max(0, li - 2), Math.min(lines.length, li + 3)).join(' ').toLowerCase();
        const dateMatch = extractDateFromText(lines[li]);
        if (dateMatch) {
            if (!data.closeDate && (contextBlock.includes('deadline') || contextBlock.includes('close') || contextBlock.includes('cierre') ||
                contextBlock.includes('due date') || contextBlock.includes('fecha límite') || contextBlock.includes('submission') ||
                contextBlock.includes('apply by') || contextBlock.includes('vence') || contextBlock.includes('until'))) {
                data.closeDate = dateMatch;
            } else if (!data.openDate && (contextBlock.includes('open') || contextBlock.includes('start') || contextBlock.includes('apertura') ||
                contextBlock.includes('posted') || contextBlock.includes('begin') || contextBlock.includes('available'))) {
                data.openDate = dateMatch;
            }
        }
    }

    if (!data.closeDate) {
        for (const line of lines) {
            const dateM = extractDateFromText(line);
            if (dateM) { try { const p = new Date(dateM); if (p > new Date() && !isNaN(p.getTime())) { data.closeDate = dateM; break; } } catch { } }
        }
    }

    const amountPatterns = [
        /up\s+to\s+(?:USD|US\$|\$)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M))?/gi,
        /(?:USD|US\s*\$|\$)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M|billion|B))?/gi,
        /(?:EUR|€)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M))?/gi,
        /(?:GBP|£)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M))?/gi,
        /(?:COP|COL\$)\s*[\d,.]+(?:\s*(?:millones|mil))?/gi,
    ];
    for (const pat of amountPatterns) { const m = bodyText.match(pat); if (m && m[0].trim().length > 3) { data.amount = m[0].trim(); break; } }

    const reqKeys = ['eligib', 'requirement', 'requisit', 'who can apply', 'quién puede', 'criteria', 'qualif', 'must be', 'applicant'];
    $('p, li, dd, td').each((i, el) => {
        if (data.requirements) return false;
        const text = $(el).text().trim();
        if (text.length > 25 && text.length < 500 && reqKeys.some(kw => text.toLowerCase().includes(kw))) data.requirements = text;
    });

    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.length > 30) { data.summary = metaDesc; }
    else {
        const paragraphs = [];
        $('main p, article p, .content p, p').each((i, el) => {
            if (i >= 5) return false;
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 600) paragraphs.push(text);
        });
        if (paragraphs.length > 0) data.summary = paragraphs.slice(0, 2).join(' ').substring(0, 500);
    }

    data.tags = [];
    const tagKw = {
        'research': 'Investigación', 'grant': 'Grant', 'fellowship': 'Fellowship', 'training': 'Capacitación',
        'clinical': 'Clínico', 'innovation': 'Innovación', 'public health': 'Salud Pública', 'mental health': 'Salud Mental',
        'cancer': 'Cáncer', 'infectious': 'Enfermedades Infecciosas', 'biotechnology': 'Biotecnología', 'genomics': 'Genómica',
        'epidemiology': 'Epidemiología', 'nutrition': 'Nutrición', 'neuroscience': 'Neurociencia', 'artificial intelligence': 'IA'
    };
    const bodyLower = bodyText.toLowerCase();
    Object.entries(tagKw).forEach(([key, label]) => { if (bodyLower.includes(key)) data.tags.push(label); });
    if (data.tags.length > 5) data.tags = data.tags.slice(0, 5);

    const siteName = $('meta[property="og:site_name"]').attr('content');
    if (siteName) data.entity = siteName;

    return data;
}

async function deepAnalyzeAndNavigate(results, userQuery, progressCallback) {
    const analyzed = [];
    const uniqueUrls = new Set();
    const topResults = results.filter(r => {
        if (!r.link || uniqueUrls.has(r.link)) return false;
        uniqueUrls.add(r.link); return true;
    }).slice(0, 25);

    for (let i = 0; i < topResults.length; i++) {
        const result = topResults[i];
        if (progressCallback && i % 3 === 0) {
            progressCallback({
                stage: 'deep_analysis',
                message: `Analizando página ${i + 1}/${topResults.length}: deep crawling y extracción...`,
                progress: 42 + (i / topResults.length) * 18,
            });
        }
        try {
            if (result.link && result.link.toLowerCase().endsWith('.pdf')) {
                const pdfData = await fetchPdf(result.link);
                if (pdfData && pdfData.text.length > 100) {
                    console.log(`  📄 PDF procesado: ${result.link.substring(0, 60)}... (${pdfData.pages} págs)`);
                    const fakeHtml = `<html><body><p>${pdfData.text.replace(/\n/g, '</p><p>')}</p></body></html>`;
                    const $pdf = cheerio.load(fakeHtml);
                    analyzed.push({
                        ...result, link: pdfData.finalUrl,
                        pageData: extractGrantData($pdf, pdfData.finalUrl),
                        isSpecificPage: true, isPdf: true,
                    });
                    continue;
                }
            }

            const page = await fetchPage(result.link);
            if (!page) { analyzed.push(result); continue; }
            const $ = cheerio.load(page.html);
            if (isSpecificGrantPage($, result.link)) {
                analyzed.push({ ...result, link: page.finalUrl, pageData: extractGrantData($, page.finalUrl), isSpecificPage: true });
            } else {
                const subPages = await deepCrawlSite($, result.link, userQuery);
                if (subPages.length > 0) {
                    for (const sub of subPages) {
                        if (!uniqueUrls.has(sub.url)) {
                            uniqueUrls.add(sub.url);
                            analyzed.push({
                                ...result, title: sub.title || result.title, link: sub.url,
                                pageData: extractGrantData(sub.$, sub.url), isSpecificPage: sub.isSpecific, navigatedFrom: result.link,
                            });
                        }
                    }
                } else {
                    analyzed.push({ ...result, link: page.finalUrl, pageData: extractGrantData($, page.finalUrl), isSpecificPage: false });
                }
            }
        } catch { analyzed.push(result); }
    }
    return analyzed;
}

function isLikelyGrant(text, href) {
    const combined = `${text} ${href}`.toLowerCase();
    const keywords = ['grant', 'fund', 'call', 'convocatoria', 'opportunity', 'fellowship', 'award', 'beca', 'proposal',
        'rfp', 'rfa', 'foa', 'apply', 'deadline', 'open', 'abierta'];
    const excludes = ['login', 'signup', 'contact', 'about', 'faq', 'privacy', 'terms', 'cookie',
        'twitter', 'facebook', 'youtube', 'instagram', 'linkedin'];
    return keywords.some(kw => combined.includes(kw)) && !excludes.some(kw => combined.includes(kw));
}

function resolveUrl(href, baseUrl) {
    try {
        if (href.startsWith('http')) return href;
        if (href.startsWith('//')) return 'https:' + href;
        if (href.startsWith('/') || href.startsWith('.')) return new URL(href, baseUrl).href;
        return null;
    } catch { return null; }
}

function calculateRelevanceScore(result, userQuery) {
    let score = 0;
    const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const titleLower = (result.title || '').toLowerCase();
    const snippetLower = (result.snippet || '').toLowerCase();
    queryWords.forEach(w => { if (titleLower.includes(w)) score += 15; });
    queryWords.forEach(w => { if (snippetLower.includes(w)) score += 5; });
    if (result.isSpecificPage) score += 20;
    if (result.sourceMeta) score += 10;
    if (result.pageData) {
        if (result.pageData.closeDate) score += 8;
        if (result.pageData.amount) score += 8;
        if (result.pageData.requirements) score += 5;
        if (result.pageData.summary) score += 5;
    }
    if (result.source === 'NIH API') score += 15;
    return score;
}

async function deepSearch(filters = {}, progressCallback) {
    const { region = 'global', query = '' } = filters;
    const allResults = [];
    const timestamp = new Date().toISOString();

    if (progressCallback) progressCallback({ stage: 'init', message: `Iniciando investigación profunda: "${query || 'general'}"...`, progress: 3 });

    const queries = await generateSmartQueries(query);
    const sources = REGION_SOURCES[region] || REGION_SOURCES['global'];

    if (progressCallback) progressCallback({ stage: 'queries', message: `${queries.length} queries generadas ${geminiModel ? '(Gemini IA)' : '(español + inglés)'}`, progress: 6 });

    if (progressCallback) progressCallback({ stage: 'web', message: `Ejecutando ${queries.length} búsquedas en 3 motores (DDG + Bing + Brave)...`, progress: 10 });

    const multiQueries = queries.slice(0, 3);
    const ddgQueries = queries.slice(3);

    const [multiResults, ddgResults] = await Promise.allSettled([
        Promise.allSettled(multiQueries.map(q => multiSearch(q))),
        Promise.allSettled(ddgQueries.map(q => searchDuckDuckGo(q))),
    ]);

    if (multiResults.status === 'fulfilled') {
        multiResults.value.forEach(r => { if (r.status === 'fulfilled') allResults.push(...r.value); });
    }
    if (ddgResults.status === 'fulfilled') {
        ddgResults.value.forEach(r => { if (r.status === 'fulfilled') allResults.push(...r.value); });
    }

    if (progressCallback) progressCallback({ stage: 'web_done', message: `${allResults.length} resultados web obtenidos (multi-buscador)`, progress: 25 });

    if (progressCallback) progressCallback({ stage: 'portals', message: `Consultando ${sources.length} portales oficiales...`, progress: 28 });
    const scrapePromises = sources.map(s => scrapeSourceWithNavigation(s, query));
    const scrapeResults = await Promise.allSettled(scrapePromises);
    scrapeResults.forEach(r => { if (r.status === 'fulfilled') allResults.push(...r.value); });

    if (progressCallback) progressCallback({ stage: 'portals_done', message: `${allResults.length} resultados totales de portales`, progress: 35 });

    if (progressCallback) progressCallback({ stage: 'nih', message: 'Consultando API del NIH...', progress: 38 });
    const nihResults = await searchNIH(query);
    allResults.push(...nihResults);

    if (progressCallback) progressCallback({ stage: 'navigate', message: 'Deep crawling: explorando sub-páginas de cada sitio...', progress: 42 });
    const deepResults = await deepAnalyzeAndNavigate(allResults, query, progressCallback);

    deepResults.forEach(r => { r.relevanceScore = calculateRelevanceScore(r, query); });
    deepResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (progressCallback) progressCallback({ stage: 'complete', message: `Búsqueda completada: ${deepResults.length} resultados analizados`, progress: 60 });

    return { rawResults: deepResults, searchTimestamp: timestamp, userQuery: query, sourcesConsulted: sources.length };
}

module.exports = { deepSearch, SOURCES, REGION_SOURCES, setGeminiModel };
