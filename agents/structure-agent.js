/**
 * ═══════════════════════════════════════════════════════════════
 * AGENTE 3 — ESTRUCTURACIÓN PROFUNDA v3
 * ═══════════════════════════════════════════════════════════════
 * - Extrae info directamente de la página de convocatoria específica
 * - Si la info ya fue extraída por el search agent, la usa
 * - No inventa datos: si no encuentra, indica "consultar portal"
 * - Basado ÚNICAMENTE en la query del usuario (sin categorías predefinidas)
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');

const REGION_MAP = {
    'nih.gov': { region: 'EE.UU. / Global', flag: '🇺🇸' },
    'grants.gov': { region: 'EE.UU.', flag: '🇺🇸' },
    'who.int': { region: 'Global', flag: '🌐' },
    'paho.org': { region: 'Latinoamérica', flag: '🌎' },
    'europa.eu': { region: 'Europa', flag: '🇪🇺' },
    'wellcome.org': { region: 'Global / UK', flag: '🇬🇧' },
    'gatesfoundation.org': { region: 'Global', flag: '🌐' },
    'ukri.org': { region: 'Reino Unido', flag: '🇬🇧' },
    'minciencias.gov.co': { region: 'Colombia', flag: '🇨🇴' },
    'gov.co': { region: 'Colombia', flag: '🇨🇴' },
    'conicet.gov.ar': { region: 'Argentina', flag: '🇦🇷' },
    'gov.ar': { region: 'Argentina', flag: '🇦🇷' },
    'anid.cl': { region: 'Chile', flag: '🇨🇱' },
    'gob.cl': { region: 'Chile', flag: '🇨🇱' },
    'gob.mx': { region: 'México', flag: '🇲🇽' },
    'gov.br': { region: 'Brasil', flag: '🇧🇷' },
    'gov.uk': { region: 'Reino Unido', flag: '🇬🇧' },
};

function detectRegion(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        for (const [domain, info] of Object.entries(REGION_MAP)) {
            if (hostname.includes(domain)) return info;
        }
    } catch { }
    return { region: 'Global', flag: '🌐' };
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
        /\d{1,2}\.\d{1,2}\.\d{4}/,
    ];
    for (const pat of patterns) {
        const m = text.match(pat);
        if (m) return m[0].trim();
    }
    return null;
}

async function extractFullGrantInfo(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'text/html' },
            timeout: 10000,
        });
        if (!res.ok) return {};
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html')) return {};

        const html = await res.text();
        const $ = cheerio.load(html);
        const data = {};
        const bodyText = $('body').text();

        const metaDeadline = $('meta[name="deadline"]').attr('content') ||
            $('meta[property="article:expiration_time"]').attr('content') ||
            $('meta[name="dc.date.expires"]').attr('content') ||
            $('meta[name="end_date"]').attr('content');
        const metaStart = $('meta[name="start_date"]').attr('content') ||
            $('meta[property="article:published_time"]').attr('content') ||
            $('meta[name="dc.date.created"]').attr('content');
        if (metaDeadline) data.closeDate = metaDeadline;
        if (metaStart) data.openDate = metaStart;

        $('table tr, dl, .deadline, .date, [class*="date"], [class*="deadline"], [id*="deadline"], time').each((i, el) => {
            const text = $(el).text().trim();
            const lower = text.toLowerCase();
            const dateM = extractDateFromText(text);
            if (dateM) {
                if (!data.closeDate && (lower.includes('deadline') || lower.includes('close') || lower.includes('cierre') ||
                    lower.includes('due') || lower.includes('fecha l\u00edmite') || lower.includes('expir') || lower.includes('vence') ||
                    lower.includes('submission') || lower.includes('apply by') || lower.includes('last date'))) {
                    data.closeDate = dateM;
                } else if (!data.openDate && (lower.includes('open') || lower.includes('start') || lower.includes('apertura') ||
                    lower.includes('launch') || lower.includes('posted') || lower.includes('publicad') || lower.includes('begin') ||
                    lower.includes('available') || lower.includes('announced'))) {
                    data.openDate = dateM;
                }
            }
        });

        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        for (let li = 0; li < lines.length; li++) {
            if (data.closeDate && data.openDate) break;
            const contextBlock = lines.slice(Math.max(0, li - 2), Math.min(lines.length, li + 3)).join(' ').toLowerCase();
            const dateMatch = extractDateFromText(lines[li]);
            if (dateMatch) {
                if (!data.closeDate && (contextBlock.includes('deadline') || contextBlock.includes('close') ||
                    contextBlock.includes('cierre') || contextBlock.includes('due date') || contextBlock.includes('fecha l\u00edmite') ||
                    contextBlock.includes('expir') || contextBlock.includes('submission') || contextBlock.includes('apply by') ||
                    contextBlock.includes('last date') || contextBlock.includes('vence') || contextBlock.includes('until'))) {
                    data.closeDate = dateMatch;
                } else if (!data.openDate && (contextBlock.includes('open') || contextBlock.includes('start') ||
                    contextBlock.includes('apertura') || contextBlock.includes('launch') || contextBlock.includes('posted') ||
                    contextBlock.includes('begin') || contextBlock.includes('available') || contextBlock.includes('announced') ||
                    contextBlock.includes('publicad'))) {
                    data.openDate = dateMatch;
                }
            }
        }

        if (!data.closeDate) {
            for (const line of lines) {
                const dateM = extractDateFromText(line);
                if (dateM) {
                    try {
                        const parsed = new Date(dateM);
                        if (parsed > new Date() && !isNaN(parsed.getTime())) {
                            data.closeDate = dateM;
                            break;
                        }
                    } catch { }
                }
            }
        }

        const amountPatterns = [
            /up\s+to\s+(?:USD|US\$|\$)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M))?/gi,
            /(?:USD|US\s*\$|\$)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M|billion|B))?/gi,
            /(?:EUR|\u20ac)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M))?/gi,
            /(?:GBP|\u00a3)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|M))?/gi,
        ];
        for (const pat of amountPatterns) {
            const m = bodyText.match(pat);
            if (m && m[0].trim().length > 3) { data.amount = m[0].trim(); break; }
        }

        $('p, li, dd, td').each((i, el) => {
            if (data.requirements) return false;
            const text = $(el).text().trim();
            if (text.length > 25 && text.length < 500) {
                const lower = text.toLowerCase();
                if (['eligib', 'requirement', 'requisit', 'who can apply', 'criteria', 'qualif', 'must be']
                    .some(kw => lower.includes(kw))) {
                    data.requirements = text;
                }
            }
        });

        const metaDesc = $('meta[name="description"]').attr('content');
        if (metaDesc && metaDesc.length > 30) {
            data.summary = metaDesc;
        } else {
            const paras = [];
            $('main p, article p, .content p, p').each((i, el) => {
                if (i >= 4) return false;
                const text = $(el).text().trim();
                if (text.length > 50 && text.length < 600) paras.push(text);
            });
            if (paras.length > 0) data.summary = paras.slice(0, 2).join(' ').substring(0, 500);
        }

        const siteName = $('meta[property="og:site_name"]').attr('content');
        if (siteName) data.entity = siteName;

        return data;
    } catch { return {}; }
}

function formatGrant(result, index, extraDetails = {}) {
    const regionInfo = result.sourceMeta
        ? { region: result.sourceMeta.region, flag: result.sourceMeta.flag }
        : detectRegion(result.link);

    const pd = result.pageData || {};
    const summary = extraDetails.summary || pd.summary || result.snippet || result.title || '';
    const openDate = extraDetails.openDate || pd.openDate || result.openDate || 'Abierta actualmente';
    const closeDate = extraDetails.closeDate || pd.closeDate || result.closeDate || 'Consultar portal oficial';
    const amount = extraDetails.amount || pd.amount || 'Variable \u2014 consultar convocatoria';
    const requirements = extraDetails.requirements || pd.requirements || 'Ver detalles en el portal oficial';
    let entity = result.sourceMeta?.entity || extraDetails.entity || pd.entity || result.source || 'Fuente oficial';
    if (result.nihData?.primaryIC) entity = `NIH \u2014 ${result.nihData.primaryIC}`;

    return {
        id: `grant-${Date.now()}-${index}`,
        title: (result.title || 'Convocatoria').replace(/\s+/g, ' ').trim(),
        entity,
        status: 'abierta',
        region: regionInfo.region,
        flag: regionInfo.flag,
        summary: summary.length > 500 ? summary.substring(0, 497) + '...' : summary,
        openDate,
        closeDate,
        amount,
        requirements: requirements.length > 300 ? requirements.substring(0, 297) + '...' : requirements,
        link: result.link || '#',
        isOfficial: result.isOfficial || false,
        isSpecificPage: result.isSpecificPage || false,
        relevanceScore: result.relevanceScore || 0,
        source: result.source || 'web_search',
        verifiedAt: new Date().toISOString(),
    };
}

async function structureResults(verificationData, progressCallback) {
    const { verifiedResults, userQuery, stats } = verificationData;
    if (progressCallback) progressCallback({ stage: 'struct_init', message: 'Extrayendo información detallada de cada convocatoria...', progress: 87 });

    const topResults = verifiedResults.slice(0, 15);
    const allDetails = [];

    for (let i = 0; i < topResults.length; i += 4) {
        const batch = topResults.slice(i, i + 4);
        const promises = batch.map(r => extractFullGrantInfo(r.link).catch(() => ({})));
        const results = await Promise.allSettled(promises);
        allDetails.push(...results);
        if (progressCallback) {
            const pct = 87 + ((i + 4) / topResults.length) * 8;
            progressCallback({ stage: 'struct_extract', message: `Extraídos detalles ${Math.min(i + 4, topResults.length)}/${topResults.length}...`, progress: Math.min(95, pct) });
        }
    }

    if (progressCallback) progressCallback({ stage: 'struct_format', message: 'Formateando resultados...', progress: 96 });

    const formatted = verifiedResults.map((result, idx) => {
        const extra = idx < allDetails.length && allDetails[idx].status === 'fulfilled' ? allDetails[idx].value : {};
        return formatGrant(result, idx, extra);
    });

    let finalGrants = formatted;
    if (userQuery) {
        const words = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        finalGrants = formatted.filter(g => {
            const text = `${g.title} ${g.summary} ${g.entity}`.toLowerCase();
            return words.some(w => text.includes(w));
        });
    }

    finalGrants.sort((a, b) => {
        if (a.isSpecificPage !== b.isSpecificPage) return b.isSpecificPage ? 1 : -1;
        if (a.isOfficial !== b.isOfficial) return b.isOfficial ? 1 : -1;
        return b.relevanceScore - a.relevanceScore;
    });

    const regions = {};
    finalGrants.forEach(g => { regions[g.region] = (regions[g.region] || 0) + 1; });

    if (progressCallback) progressCallback({ stage: 'struct_done', message: `${finalGrants.length} convocatorias verificadas y estructuradas`, progress: 100 });

    return {
        grants: finalGrants,
        meta: {
            totalFound: finalGrants.length,
            userQuery: userQuery || null,
            queryTimestamp: new Date().toISOString(),
            processingStats: stats,
            regionBreakdown: regions,
        },
    };
}

module.exports = { structureResults };
