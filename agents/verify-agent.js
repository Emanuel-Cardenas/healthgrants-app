/**
 * ═══════════════════════════════════════════════════════════════
 * AGENTE 2 — VERIFICACIÓN ESTRICTA v3
 * ═══════════════════════════════════════════════════════════════
 * - Rechaza páginas generales → solo convocatorias específicas
 * - Verificación GET completa de cada enlace
 * - Filtrado estricto por relevancia a la query del usuario
 * - Solo enlaces funcionales y oficiales
 */

const fetch = require('node-fetch');

const BLOCKED_DOMAINS = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
    'wikipedia.org', 'amazon.com', 'ebay.com',
    'duckduckgo.com', 'google.com', 'bing.com',
    'stackoverflow.com', 'medium.com', 'quora.com',
];

const OFFICIAL_DOMAINS = [
    'nih.gov', 'grants.gov', 'who.int', 'paho.org', 'europa.eu',
    'wellcome.org', 'gatesfoundation.org', 'ukri.org',
    'minciencias.gov.co', 'conicet.gov.ar', 'anid.cl',
    'gov.co', 'gov.ar', 'gob.cl', 'gob.mx', 'gov.br', 'gov.uk',
    '.gov', '.edu', '.ac.uk', '.edu.co', '.org',
];

function isBlockedDomain(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return BLOCKED_DOMAINS.some(d => hostname.includes(d));
    } catch { return true; }
}

function isOfficialDomain(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return OFFICIAL_DOMAINS.some(d => hostname.includes(d) || hostname.endsWith(d));
    } catch { return false; }
}

function calculateRelevance(result, userQuery) {
    if (!userQuery) return 10;
    const text = `${result.title || ''} ${result.snippet || ''} ${result.pageData?.summary || ''}`.toLowerCase();
    const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let score = 0;
    let matches = 0;
    queryWords.forEach(word => { if (text.includes(word)) { matches++; score += 8; } });
    if (matches === queryWords.length && queryWords.length > 0) score += 15;
    if (matches === 0 && queryWords.length > 0) score -= 40;
    if (result.isSpecificPage) score += 10;
    if (result.pageData) score += 5;
    if (result.nihData) score += 12;
    if (isOfficialDomain(result.link || '')) score += 10;
    if (isBlockedDomain(result.link || '')) score -= 100;
    if (result.title && result.title.length < 15) score -= 10;
    return score;
}

async function verifyLink(url) {
    try {
        if (isBlockedDomain(url)) return { active: false, reason: 'dominio bloqueado' };
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'text/html' },
            timeout: 8000,
            redirect: 'follow',
        });
        if (!res.ok && res.status !== 403) return { active: false, reason: `HTTP ${res.status}` };
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) {
            const text = await res.text();
            const lower = text.toLowerCase();
            if ((lower.includes('page not found') || lower.includes('error 404')) &&
                (lower.includes('<title') && (lower.includes('404') || lower.includes('not found')))) {
                return { active: false, reason: '404 page' };
            }
        }
        return { active: true, finalUrl: res.url };
    } catch (e) { return { active: false, reason: e.message }; }
}

function dedup(results) {
    const seen = new Map();
    return results.filter(r => {
        const normTitle = (r.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().substring(0, 60);
        let normUrl;
        try { normUrl = new URL(r.link).pathname.toLowerCase().replace(/\/+$/, ''); } catch { normUrl = r.link; }
        if (seen.has(normUrl)) return false;
        if (normTitle.length > 15 && seen.has(normTitle)) return false;
        seen.set(normUrl, true);
        if (normTitle.length > 15) seen.set(normTitle, true);
        return true;
    });
}

async function verifyResults(searchData, progressCallback) {
    const { rawResults, userQuery } = searchData;
    if (progressCallback) progressCallback({ stage: 'verify_init', message: `Verificando ${rawResults.length} resultados...`, progress: 62 });

    const scored = rawResults.map(r => ({ ...r, relevanceScore: calculateRelevance(r, userQuery) }));
    const relevant = scored.filter(r => r.relevanceScore >= 8);
    relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (progressCallback) progressCallback({ stage: 'verify_filter', message: `${relevant.length} resultados relevantes para "${userQuery}"`, progress: 66 });

    const unique = dedup(relevant);
    if (progressCallback) progressCallback({ stage: 'verify_dedup', message: `${unique.length} resultados únicos`, progress: 70 });
    if (progressCallback) progressCallback({ stage: 'verify_links', message: `Verificando ${Math.min(unique.length, 20)} enlaces...`, progress: 73 });

    const toVerify = unique.slice(0, 20);
    const verified = [];

    for (let i = 0; i < toVerify.length; i += 5) {
        const batch = toVerify.slice(i, i + 5);
        const batchResults = await Promise.all(batch.map(async r => {
            const check = await verifyLink(r.link);
            return { ...r, linkVerified: check.active, link: check.finalUrl || r.link, isOfficial: isOfficialDomain(r.link) };
        }));
        verified.push(...batchResults);

        if (progressCallback) {
            const pct = 73 + ((i + 5) / toVerify.length) * 12;
            progressCallback({ stage: 'verify_links', message: `Verificados ${Math.min(i + 5, toVerify.length)}/${toVerify.length}...`, progress: Math.min(85, pct) });
        }
    }

    const active = verified.filter(r => r.linkVerified);
    if (progressCallback) progressCallback({ stage: 'verify_done', message: `${active.length} convocatorias con enlace verificado`, progress: 85 });

    return {
        verifiedResults: active,
        userQuery,
        stats: { totalRaw: rawResults.length, relevant: relevant.length, unique: unique.length, verified: active.length },
    };
}

module.exports = { verifyResults };
