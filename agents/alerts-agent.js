/**
 * ═══════════════════════════════════════════════════════════════
 * AGENTE 5 — SISTEMA DE ALERTAS
 * ═══════════════════════════════════════════════════════════════
 * Monitorea convocatorias y detecta nuevas oportunidades.
 * - Almacena alertas configuradas por el usuario (temas, regiones)
 * - Ejecuta búsquedas periódicas en el backend
 * - Compara con grants vistos anteriormente
 * - Retorna solo los nuevos
 */

const { deepSearch } = require('./search-agent');
const { verifyResults } = require('./verify-agent');
const { structureResults } = require('./structure-agent');

const alertsStore = {
    alerts: [],
    seenGrants: {},
    lastCheck: {},
};

function createAlert(topic, region = 'global') {
    const alert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        topic: topic.trim(),
        region,
        createdAt: new Date().toISOString(),
        active: true,
    };
    alertsStore.alerts.push(alert);
    alertsStore.seenGrants[alert.id] = new Set();
    alertsStore.lastCheck[alert.id] = null;
    console.log(`  🔔 Alerta creada: "${topic}" (${region})`);
    return alert;
}

function getAlerts() {
    return alertsStore.alerts.filter(a => a.active);
}

function deleteAlert(alertId) {
    const idx = alertsStore.alerts.findIndex(a => a.id === alertId);
    if (idx >= 0) {
        alertsStore.alerts[idx].active = false;
        console.log(`  🔕 Alerta eliminada: ${alertId}`);
        return true;
    }
    return false;
}

async function checkAlert(alertId, progressCallback) {
    const alert = alertsStore.alerts.find(a => a.id === alertId && a.active);
    if (!alert) return { alert: null, newGrants: [], total: 0 };

    const seenSet = alertsStore.seenGrants[alertId] || new Set();

    try {
        if (progressCallback) progressCallback({ stage: 'alert_search', message: `Buscando: "${alert.topic}"...`, progress: 20 });
        const searchData = await deepSearch({ region: alert.region, query: alert.topic });

        if (progressCallback) progressCallback({ stage: 'alert_verify', message: 'Verificando resultados...', progress: 50 });
        const verifiedData = await verifyResults(searchData);
        const structuredData = await structureResults(verifiedData);

        if (progressCallback) progressCallback({ stage: 'alert_compare', message: 'Comparando con anteriores...', progress: 80 });

        const newGrants = structuredData.grants.filter(g => {
            const key = `${g.title}|${g.link}`;
            if (seenSet.has(key)) return false;
            seenSet.add(key);
            return true;
        });

        newGrants.forEach(g => { g.isNew = true; });

        alertsStore.seenGrants[alertId] = seenSet;
        alertsStore.lastCheck[alertId] = new Date().toISOString();

        if (progressCallback) progressCallback({ stage: 'alert_done', message: `${newGrants.length} nuevas de ${structuredData.grants.length} total`, progress: 100 });

        return {
            alert,
            newGrants,
            total: structuredData.grants.length,
            lastCheck: alertsStore.lastCheck[alertId],
        };
    } catch (err) {
        console.error(`  ❌ Error en alerta "${alert.topic}":`, err.message);
        return { alert, newGrants: [], total: 0, error: err.message };
    }
}

async function checkAllAlerts(progressCallback) {
    const activeAlerts = getAlerts();
    if (activeAlerts.length === 0) return [];
    const results = [];
    for (let i = 0; i < activeAlerts.length; i++) {
        const result = await checkAlert(activeAlerts[i].id, progressCallback);
        results.push(result);
    }
    return results;
}

module.exports = { createAlert, getAlerts, deleteAlert, checkAlert, checkAllAlerts };
