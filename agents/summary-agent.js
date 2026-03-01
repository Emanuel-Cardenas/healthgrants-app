/**
 * ═══════════════════════════════════════════════════════════════
 * AGENTE 4 — RESUMEN EJECUTIVO IA (Gemini)
 * ═══════════════════════════════════════════════════════════════
 * Genera resúmenes ejecutivos en español de cada convocatoria
 * usando Google Gemini API.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

function initGemini(apiKey) {
    if (!apiKey) return false;
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('  🧠 Agente 4 (Resumen IA): Gemini inicializado');
        return true;
    } catch (err) {
        console.error('  ❌ Error al inicializar Gemini:', err.message);
        return false;
    }
}

async function generateSummary(grant) {
    if (!model) return { summary: fallbackSummary(grant) };

    const needsDates = (!grant.openDate || grant.openDate === 'Abierta actualmente') ||
        (!grant.closeDate || grant.closeDate === 'Consultar portal oficial');

    const prompt = `Eres un asesor experto en convocatorias de investigación en salud. 
Analiza la siguiente convocatoria y responde en JSON puro (sin markdown, sin \`\`\`).

Tu respuesta DEBE ser un JSON válido con esta estructura exacta:
{
  "summary": "Resumen ejecutivo en español (máx 4 líneas, profesional y útil)",
  "openDate": "Fecha de apertura si la puedes inferir del contexto, o null",
  "closeDate": "Fecha límite/cierre si la puedes inferir del contexto, o null"
}

DATOS DE LA CONVOCATORIA:
Título: ${grant.title || 'No especificado'}
Entidad: ${grant.entity || 'No especificada'}
Región: ${grant.region || 'Global'}
Monto: ${grant.amount || 'No especificado'}
Fecha Apertura actual: ${grant.openDate || 'No encontrada'}
Fecha Cierre actual: ${grant.closeDate || 'No encontrada'}
Requisitos: ${grant.requirements || 'No especificados'}
Resumen original: ${grant.summary || 'No disponible'}
Link: ${grant.link || 'No disponible'}

REGLAS:
- El resumen debe ser en español, conciso (4 líneas máx), mencionando financiamiento, quién puede aplicar, y fecha límite.
- Para las fechas: si ya existen y son específicas, pon null para no sobrescribirlas.
- NO inventes fechas. Si no puedes determinarla, pon null.
- Responde SOLO con el JSON, nada más.`;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        try {
            const parsed = JSON.parse(text);
            const response = { summary: (parsed.summary || '').substring(0, 600) };
            if (parsed.openDate && needsDates) response.openDate = parsed.openDate;
            if (parsed.closeDate && needsDates) response.closeDate = parsed.closeDate;
            return response;
        } catch {
            if (text.length > 20) return { summary: text.substring(0, 600) };
            return { summary: fallbackSummary(grant) };
        }
    } catch (err) {
        console.error(`  ⚠️ Gemini error para "${grant.title?.substring(0, 40)}": ${err.message}`);
        return { summary: fallbackSummary(grant) };
    }
}

function fallbackSummary(grant) {
    const parts = [];
    if (grant.entity) parts.push(`Convocatoria de ${grant.entity}.`);
    if (grant.amount && grant.amount !== 'Variable — consultar convocatoria') parts.push(`Financiamiento: ${grant.amount}.`);
    if (grant.closeDate && grant.closeDate !== 'Consultar portal oficial') parts.push(`Fecha límite: ${grant.closeDate}.`);
    if (grant.requirements && grant.requirements !== 'Ver detalles en el portal oficial') parts.push(`Requisitos: ${grant.requirements.substring(0, 150)}.`);
    if (parts.length === 0 && grant.summary) return grant.summary.substring(0, 300);
    return parts.join(' ') || grant.summary || 'Consultar el portal oficial para más detalles.';
}

async function generateBatchSummaries(grants, progressCallback) {
    if (progressCallback) progressCallback({ stage: 'summary_init', message: `Generando resúmenes IA para ${grants.length} convocatorias...`, progress: 0 });

    const results = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
        const batch = grants.slice(i, i + BATCH_SIZE);
        const responses = await Promise.all(batch.map(g => generateSummary(g)));

        batch.forEach((grant, idx) => {
            const resp = responses[idx];
            if (typeof resp === 'object') {
                grant.aiSummary = resp.summary;
                if (resp.openDate && (!grant.openDate || grant.openDate === 'Abierta actualmente')) {
                    grant.openDate = resp.openDate;
                }
                if (resp.closeDate && (!grant.closeDate || grant.closeDate === 'Consultar portal oficial')) {
                    grant.closeDate = resp.closeDate;
                }
            } else {
                grant.aiSummary = resp;
            }
        });

        results.push(...batch);

        if (progressCallback) {
            const pct = Math.min(100, Math.round(((i + BATCH_SIZE) / grants.length) * 100));
            progressCallback({ stage: 'summary_progress', message: `Resúmenes IA: ${Math.min(i + BATCH_SIZE, grants.length)}/${grants.length}`, progress: pct });
        }
    }

    if (progressCallback) progressCallback({ stage: 'summary_done', message: `${grants.length} resúmenes IA generados`, progress: 100 });

    return results;
}

module.exports = { initGemini, generateSummary, generateBatchSummaries };
