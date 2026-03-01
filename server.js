/**
 * ═══════════════════════════════════════════════════════════════
 * YEDATECH — SERVIDOR PRINCIPAL v6
 * ═══════════════════════════════════════════════════════════════
 * Orquesta 5 agentes + exportación Excel + alertas
 * Agente 1: Búsqueda Profunda
 * Agente 2: Verificación
 * Agente 3: Estructuración
 * Agente 4: Resumen IA (Gemini)
 * Agente 5: Alertas
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');

const { deepSearch, setGeminiModel } = require('./agents/search-agent');
const { verifyResults } = require('./agents/verify-agent');
const { structureResults } = require('./agents/structure-agent');
const { initGemini, generateBatchSummaries } = require('./agents/summary-agent');
const { createAlert, getAlerts, deleteAlert, checkAlert } = require('./agents/alerts-agent');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Gemini con la API key
const geminiReady = initGemini(process.env.GEMINI_API_KEY);

// Inyectar Gemini también al search-agent para queries inteligentes
if (geminiReady && process.env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    setGeminiModel(genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }));
    console.log('  🧠 Agente 1: Gemini inyectado para queries inteligentes');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const activeSearches = new Map();

/**
 * GET /api/config
 */
app.get('/api/config', (req, res) => {
    res.json({
        regions: [
            { value: 'global', label: '🌐 Global (Todas las regiones)', default: true },
            { value: 'norteamerica', label: '🇺🇸 Norteamérica' },
            { value: 'europa', label: '🇪🇺 Europa' },
            { value: 'latinoamerica', label: '🌎 Latinoamérica' },
            { value: 'colombia', label: '🇨🇴 Colombia' },
            { value: 'argentina', label: '🇦🇷 Argentina' },
            { value: 'chile', label: '🇨🇱 Chile' },
        ],
        agents: 5,
        geminiReady,
    });
});

/**
 * POST /api/search — Búsqueda con 5 agentes
 */
app.post('/api/search', async (req, res) => {
    const { region = 'global', query = '' } = req.body;
    const searchId = `search-${Date.now()}`;

    console.log(`\n${'\u2550'.repeat(60)}`);
    console.log(`[YedaTech] Nueva búsqueda:`);
    console.log(`  Query: "${query}"`);
    console.log(`  Región: ${region}`);
    console.log(`  ID: ${searchId}`);
    console.log(`${'\u2550'.repeat(60)}\n`);

    activeSearches.set(searchId, { query, region, startTime: Date.now(), progress: [] });

    const progressCallback = (update) => {
        const search = activeSearches.get(searchId);
        if (search) {
            search.progress.push(update);
            console.log(`  [${update.stage}] ${update.message} (${update.progress}%)`);
        }
    };

    try {
        const startTime = Date.now();

        console.log('\n🔍 Agente 1: Búsqueda Profunda Exhaustiva...');
        const searchData = await deepSearch({ region, query }, progressCallback);

        console.log('\n✅ Agente 2: Verificación Estricta...');
        const verifiedData = await verifyResults(searchData, progressCallback);

        console.log('\n📊 Agente 3: Estructuración Completa...');
        const structuredData = await structureResults(verifiedData, progressCallback);

        // Agente 4: Resúmenes IA con Gemini
        if (geminiReady && structuredData.grants.length > 0) {
            console.log('\n🧠 Agente 4: Generando Resúmenes IA...');
            await generateBatchSummaries(structuredData.grants, progressCallback);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✨ Búsqueda completada en ${elapsed}s — ${structuredData.grants.length} convocatorias\n`);

        activeSearches.delete(searchId);

        res.json({
            success: true,
            searchId,
            data: structuredData,
            timing: {
                totalSeconds: parseFloat(elapsed),
                timestamp: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error(`[YedaTech] Error: ${error.message}`);
        activeSearches.delete(searchId);
        res.status(500).json({
            success: false,
            error: 'Error durante la investigación',
            message: error.message,
        });
    }
});

/**
 * POST /api/export-excel — Exportar resultados a Excel (.xlsx)
 */
app.post('/api/export-excel', (req, res) => {
    try {
        const { grants = [], favorites = [] } = req.body;
        const favSet = new Set(favorites.map(f => f.id || f.link));

        const rows = grants.map(g => ({
            'Convocatoria': g.title || '',
            'Entidad': g.entity || '',
            'País / Región': g.region || '',
            'Fecha Apertura': g.openDate || '',
            'Fecha Cierre': g.closeDate || '',
            'Monto': g.amount || '',
            'Área / Tags': (g.tags || []).join(', '),
            'Estado': g.status === 'abierta' ? 'Activa' : 'Cerrada/Indefinida',
            'Favorita': favSet.has(g.id) || favSet.has(g.link) ? '⭐ Sí' : 'No',
            'Verificado': g.isOfficial ? '✅ Sí' : 'No',
            'Resumen IA': g.aiSummary || '',
            'Requisitos': g.requirements || '',
            'Link': g.link || '',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        ws['!cols'] = [
            { wch: 45 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
            { wch: 60 }, { wch: 40 }, { wch: 60 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Convocatorias YedaTech');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=YedaTech-Resultados-${Date.now()}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('[YedaTech] Error exportando Excel:', error.message);
        res.status(500).json({ error: 'Error al generar Excel' });
    }
});

// ═══ ENDPOINTS DE ALERTAS ═══

/**
 * GET /api/alerts — Obtener todas las alertas activas
 */
app.get('/api/alerts', (req, res) => {
    res.json({ alerts: getAlerts() });
});

/**
 * POST /api/alerts — Crear nueva alerta
 */
app.post('/api/alerts', (req, res) => {
    const { topic, region = 'global' } = req.body;
    if (!topic || !topic.trim()) {
        return res.status(400).json({ error: 'Se requiere un tema para la alerta' });
    }
    const alert = createAlert(topic, region);
    res.json({ success: true, alert });
});

/**
 * DELETE /api/alerts/:id — Eliminar una alerta
 */
app.delete('/api/alerts/:id', (req, res) => {
    const ok = deleteAlert(req.params.id);
    res.json({ success: ok });
});

/**
 * POST /api/alerts/:id/check — Chequear una alerta (ejecutar búsqueda)
 */
app.post('/api/alerts/:id/check', async (req, res) => {
    try {
        console.log(`\n🔔 Chequeando alerta: ${req.params.id}`);
        const result = await checkAlert(req.params.id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[YedaTech] Error en alerta:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/progress/:searchId
 */
app.get('/api/progress/:searchId', (req, res) => {
    const search = activeSearches.get(req.params.searchId);
    if (search) {
        res.json({ active: true, progress: search.progress });
    } else {
        res.json({ active: false, progress: [] });
    }
});

app.listen(PORT, () => {
    console.log(`\n${'\u2550'.repeat(60)}`);
    console.log(`  ⚡ YedaTech Server v6 — 5 Agentes`);
    console.log(`  🌐 http://localhost:${PORT}`);
    console.log(`  📡 Búsqueda: /api/search`);
    console.log(`  📊 Excel: /api/export-excel`);
    console.log(`  🔔 Alertas: /api/alerts`);
    console.log(`  🧠 Gemini: ${geminiReady ? '✅ Activo' : '❌ Sin API key'}`);
    console.log(`  ⏰ ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    console.log(`${'\u2550'.repeat(60)}\n`);
});
