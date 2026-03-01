/**
 * ═══════════════════════════════════════════════════════════════
 * YEDATECH v6 — FRONTEND CONTROLLER
 * ═══════════════════════════════════════════════════════════════
 * Gestiona la interfaz: búsquedas, favoritos, historial,
 * comparación, alertas, dashboard y exportaciones.
 */

// ═══ ESTADO GLOBAL ═══
let currentGrants = [];
let favorites = [];
let history = [];
let compareList = [];
let alerts = [];
let currentPage = 1;
let searchCount = 0;
const GRANTS_PER_PAGE = 12;
let isListView = false;
let activeFilter = 'all';
let dashCharts = {};

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    updateNavTime();
    setInterval(updateNavTime, 1000);
    loadAlerts();
    window.addEventListener('scroll', handleScroll);
});

function updateNavTime() {
    const now = new Date();
    document.getElementById('navTime').textContent = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function handleScroll() {
    const btn = document.getElementById('scrollTop');
    if (window.scrollY > 400) btn.classList.add('visible');
    else btn.classList.remove('visible');
}

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        const sel = document.getElementById('regionSelect');
        data.regions.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.value;
            opt.textContent = r.label;
            if (r.default) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch { console.log('Config load fallback'); }
}

// ═══ TABS ═══
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelector(`.nav-tab[data-tab="${tabName}"]`).classList.add('active');
    if (tabName === 'favorites') renderFavorites();
    if (tabName === 'history') renderHistory();
    if (tabName === 'compare') renderCompare();
    if (tabName === 'alerts') renderAlerts();
    if (tabName === 'dashboard') renderDashboard();
}

// ═══ BÚSQUEDA ═══
function quickSearch(query) {
    document.getElementById('searchQuery').value = query;
    executeSearch();
}

async function executeSearch() {
    const query = document.getElementById('searchQuery').value.trim();
    const region = document.getElementById('regionSelect').value;
    if (!query) { showToast('🔎 Escribe un tema para buscar'); return; }

    const btn = document.getElementById('searchBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    const agentProgress = document.getElementById('agentProgress');
    agentProgress.classList.add('visible');
    resetAgentDisplay();

    const timerEl = document.getElementById('progressTimer');
    const startTime = Date.now();
    const timer = setInterval(() => { timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's'; }, 100);

    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ region, query }),
        });

        const data = await res.json();
        clearInterval(timer);

        if (data.success && data.data) {
            currentGrants = data.data.grants || [];
            searchCount++;
            document.getElementById('totalSearches').textContent = searchCount;

            // Actualizar agentes a completado
            completeAllAgents();

            // Stats
            const regions = new Set(currentGrants.map(g => g.region));
            document.getElementById('statTotal').textContent = currentGrants.length;
            document.getElementById('statOpen').textContent = currentGrants.filter(g => g.status === 'abierta').length;
            document.getElementById('statRegions').textContent = regions.size;
            document.getElementById('statTime').textContent = data.timing?.totalSeconds ? data.timing.totalSeconds + 's' : '—';

            // Query info
            document.getElementById('queryInfoText').innerHTML =
                `🔬 <strong>"${esc(query)}"</strong> — ${currentGrants.length} convocatorias en ${regions.size} regiones — ${data.timing?.totalSeconds || 0}s`;
            document.getElementById('queryInfo').classList.add('visible');

            // Show UI
            document.getElementById('statsBar').classList.add('visible');
            document.getElementById('resultsToolbar').classList.add('visible');
            document.getElementById('grantsSection').classList.add('visible');
            document.getElementById('emptyState').classList.remove('visible');

            // Historial
            history.unshift({ query, region, count: currentGrants.length, time: new Date().toLocaleString('es-CO'), timing: data.timing?.totalSeconds });
            if (history.length > 20) history.pop();

            // Filtros por región
            buildFilterPills();
            currentPage = 1;
            renderGrants();
            renderDashboard();
        } else {
            showToast('⚠️ Error: ' + (data.message || 'Error desconocido'));
        }

    } catch (err) {
        clearInterval(timer);
        showToast('❌ Error de conexión: ' + err.message);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
        setTimeout(() => { agentProgress.classList.remove('visible'); }, 2000);
    }
}

function resetAgentDisplay() {
    ['agent1', 'agent2', 'agent3', 'agent4'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('active', 'done');
    });
    ['agent1Status', 'agent2Status', 'agent3Status', 'agent4Status'].forEach(id => {
        document.getElementById(id).textContent = 'En espera...';
    });
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPct').textContent = '0%';
    document.getElementById('progressLog').innerHTML = '';

    // Simular progreso de agentes
    setTimeout(() => { activateAgent(1, 'Ejecutando búsqueda profunda...'); updateProgress(15); }, 300);
    setTimeout(() => { activateAgent(1, 'Multi-buscador: DDG + Bing + Brave...'); updateProgress(30); }, 2000);
    setTimeout(() => { doneAgent(1, 'Búsqueda completada'); activateAgent(2, 'Verificando resultados...'); updateProgress(50); }, 5000);
    setTimeout(() => { doneAgent(2, 'Verificación completada'); activateAgent(3, 'Estructurando datos...'); updateProgress(70); }, 8000);
    setTimeout(() => { doneAgent(3, 'Estructuración completada'); activateAgent(4, 'Generando resúmenes IA...'); updateProgress(85); }, 11000);
}

function activateAgent(n, status) {
    const el = document.getElementById(`agent${n}`);
    el.classList.add('active');
    el.classList.remove('done');
    document.getElementById(`agent${n}Status`).textContent = status;
    addLog(`🔄 Agente ${n}: ${status}`);
}

function doneAgent(n, status) {
    const el = document.getElementById(`agent${n}`);
    el.classList.remove('active');
    el.classList.add('done');
    document.getElementById(`agent${n}Status`).textContent = status;
    addLog(`✅ Agente ${n}: ${status}`);
}

function completeAllAgents() {
    [1, 2, 3, 4].forEach(n => doneAgent(n, 'Completado'));
    updateProgress(100);
}

function updateProgress(pct) {
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressPct').textContent = pct + '%';
}

function addLog(msg) {
    const log = document.getElementById('progressLog');
    const entry = document.createElement('div');
    entry.className = 'log-entry new';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    setTimeout(() => entry.classList.remove('new'), 2000);
}

// ═══ RENDER GRANTS ═══
function renderGrants() {
    const grid = document.getElementById('grantsGrid');
    let filtered = activeFilter === 'all' ? currentGrants : currentGrants.filter(g => g.region === activeFilter);

    const totalPages = Math.ceil(filtered.length / GRANTS_PER_PAGE);
    const start = (currentPage - 1) * GRANTS_PER_PAGE;
    const pageGrants = filtered.slice(start, start + GRANTS_PER_PAGE);

    document.getElementById('grantsTitle').textContent = `${filtered.length} convocatorias encontradas`;

    grid.innerHTML = pageGrants.map((g, i) => createGrantCard(g, start + i)).join('');
    renderPagination(totalPages);
    initScrollReveal();
}

function createGrantCard(g, idx) {
    const isFav = favorites.some(f => f.id === g.id);
    const inCompare = compareList.some(c => c.id === g.id);
    const tags = (g.tags || []).slice(0, 4);

    return `
        <div class="grant-card" style="animation-delay: ${(idx % 12) * 0.08}s">
            <div class="card-header">
                <div class="card-badges">
                    ${g.flag ? `<span class="badge badge-area-general">${g.flag} ${esc(g.region || '')}</span>` : ''}
                    ${g.status === 'abierta' ? '<span class="badge badge-status-abierta">✅ Activa</span>' : ''}
                    ${g.isOfficial ? '<span class="badge badge-verified">🏛️ Oficial</span>' : ''}
                    ${g.isSpecificPage ? '<span class="badge badge-direct">🎯 Directa</span>' : ''}
                    ${g.isNew ? '<span class="badge badge-new">🆕 Nueva</span>' : ''}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${g.id}')" title="Favorita">⭐</button>
                    <button class="card-action-btn ${inCompare ? 'active' : ''}" onclick="toggleCompare('${g.id}')" title="Comparar">⚖️</button>
                </div>
            </div>

            <div class="grant-entity">${esc(g.entity || 'Fuente oficial')}</div>
            <div class="grant-title">${esc(g.title || 'Convocatoria')}</div>

            ${g.aiSummary ? `
                <div class="ai-summary">
                    <div class="ai-summary-header">🧠 Resumen IA (Gemini)</div>
                    <div class="ai-summary-text">${esc(g.aiSummary)}</div>
                </div>
            ` : ''}

            <div class="grant-summary" id="summary-${idx}">${esc(g.summary || '')}</div>
            ${(g.summary || '').length > 150 ? `<button class="toggle-summary" onclick="toggleSummary(${idx})">Ver más ▾</button>` : ''}

            ${tags.length > 0 ? `<div class="tags-row">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}

            <div class="grant-details">
                <div class="detail-item"><span class="detail-label">📅 Apertura</span><span class="detail-value">${esc(g.openDate || 'Abierta actualmente')}</span></div>
                <div class="detail-item"><span class="detail-label">⏰ Cierre</span><span class="detail-value">${esc(g.closeDate || 'Consultar portal oficial')}</span></div>
                <div class="detail-item"><span class="detail-label">💰 Monto</span><span class="detail-value amount">${esc(g.amount || 'Variable')}</span></div>
                <div class="detail-item"><span class="detail-label">🌎 Región</span><span class="detail-value">${g.flag || '🌐'} ${esc(g.region || 'Global')}</span></div>
                ${g.requirements && g.requirements !== 'Ver detalles en el portal oficial' ? `<div class="detail-item full-width"><span class="detail-label">📋 Requisitos</span><span class="detail-value">${esc(g.requirements).substring(0, 200)}</span></div>` : ''}
            </div>

            ${g.link && g.link !== '#' ? `<a href="${esc(g.link)}" target="_blank" rel="noopener" class="grant-link">🔗 Ver convocatoria oficial →</a>` : '<div class="grant-link disabled">🔗 Enlace no disponible</div>'}
        </div>`;
}

function toggleSummary(idx) {
    const el = document.getElementById(`summary-${idx}`);
    el.classList.toggle('expanded');
    const btn = el.nextElementSibling;
    if (btn) btn.textContent = el.classList.contains('expanded') ? 'Ver menos ▴' : 'Ver más ▾';
}

// ═══ FILTERS ═══
function buildFilterPills() {
    const regions = {};
    currentGrants.forEach(g => { regions[g.region] = (regions[g.region] || 0) + 1; });
    const container = document.getElementById('filterPills');
    container.innerHTML = `<button class="filter-pill active" onclick="setFilter('all')">Todas (${currentGrants.length})</button>`;
    Object.entries(regions).sort((a, b) => b[1] - a[1]).forEach(([region, count]) => {
        container.innerHTML += `<button class="filter-pill" onclick="setFilter('${esc(region)}')">${esc(region)} (${count})</button>`;
    });
}

function setFilter(region) {
    activeFilter = region;
    currentPage = 1;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    renderGrants();
}

// ═══ SORT ═══
function sortResults() {
    const sort = document.getElementById('sortSelect').value;
    switch (sort) {
        case 'dateAsc': currentGrants.sort((a, b) => (a.closeDate || 'z').localeCompare(b.closeDate || 'z')); break;
        case 'dateDesc': currentGrants.sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || '')); break;
        case 'amountDesc': currentGrants.sort((a, b) => extractNum(b.amount) - extractNum(a.amount)); break;
        default: currentGrants.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    currentPage = 1;
    renderGrants();
}

function extractNum(str) {
    if (!str) return 0;
    const m = str.replace(/,/g, '').match(/[\d.]+/);
    if (!m) return 0;
    let n = parseFloat(m[0]);
    if (/million/i.test(str) || /M\b/.test(str)) n *= 1000000;
    if (/billion/i.test(str) || /B\b/.test(str)) n *= 1000000000;
    return n;
}

// ═══ VIEW TOGGLE ═══
function toggleView() {
    isListView = !isListView;
    const grid = document.getElementById('grantsGrid');
    grid.classList.toggle('list-view', isListView);
    document.getElementById('viewToggle').textContent = isListView ? '📐 Grid' : '📐 Lista';
}

// ═══ PAGINATION ═══
function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (totalPages <= 1) { container.classList.remove('visible'); return; }
    container.classList.add('visible');
    let html = '';
    if (currentPage > 1) html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">← Anterior</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i <= 3 || i >= totalPages - 1 || Math.abs(i - currentPage) <= 1) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === 4 || i === totalPages - 2) { html += '<span class="page-dots">…</span>'; }
    }
    if (currentPage < totalPages) html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">Siguiente →</button>`;
    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderGrants();
    window.scrollTo({ top: document.getElementById('grantsSection').offsetTop - 80, behavior: 'smooth' });
}

// ═══ FAVORITAS ═══
function toggleFavorite(id) {
    const grant = currentGrants.find(g => g.id === id);
    if (!grant) return;
    const idx = favorites.findIndex(f => f.id === id);
    if (idx >= 0) { favorites.splice(idx, 1); showToast('❌ Eliminada de favoritas'); }
    else { favorites.push(grant); showToast('⭐ Guardada en favoritas'); }
    document.getElementById('favCount').textContent = favorites.length;
    renderGrants();
}

function renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    if (favorites.length === 0) {
        grid.innerHTML = '<div class="empty-state visible"><div class="empty-icon">⭐</div><h3>Sin favoritas aún</h3><p>Marca convocatorias como favoritas desde los resultados de búsqueda.</p></div>';
        return;
    }
    grid.innerHTML = favorites.map((g, i) => createGrantCard(g, 1000 + i)).join('');
}

function clearFavorites() {
    favorites = [];
    document.getElementById('favCount').textContent = 0;
    renderFavorites();
    showToast('🗑 Favoritas eliminadas');
}

// ═══ HISTORIAL ═══
function renderHistory() {
    const list = document.getElementById('historyList');
    if (history.length === 0) {
        list.innerHTML = '<div class="empty-state visible"><div class="empty-icon">📜</div><h3>Sin historial</h3><p>Tus búsquedas aparecerán aquí.</p></div>';
        return;
    }
    list.innerHTML = history.map(h => `
        <div class="history-item">
            <div class="history-info">
                <strong>🔎 "${esc(h.query)}"</strong>
                <span class="history-meta">${h.count} resultados — ${h.region} — ${h.time}${h.timing ? ` — ${h.timing}s` : ''}</span>
            </div>
            <button class="toolbar-btn" onclick="quickSearch('${esc(h.query)}');switchTab('search')">🔄 Repetir</button>
        </div>
    `).join('');
}

function clearHistory() {
    history = [];
    renderHistory();
    showToast('🗑 Historial eliminado');
}

// ═══ COMPARAR ═══
function toggleCompare(id) {
    const grant = currentGrants.find(g => g.id === id);
    if (!grant) return;
    const idx = compareList.findIndex(c => c.id === id);
    if (idx >= 0) { compareList.splice(idx, 1); showToast('❌ Eliminada de comparación'); }
    else {
        if (compareList.length >= 4) { showToast('⚠️ Máximo 4 convocatorias para comparar'); return; }
        compareList.push(grant);
        showToast('⚖️ Añadida a comparación');
    }
    document.getElementById('compareCount').textContent = compareList.length;
    renderGrants();
}

function renderCompare() {
    const wrap = document.getElementById('compareTableWrap');
    if (compareList.length === 0) {
        wrap.innerHTML = '<div class="empty-state visible"><div class="empty-icon">⚖️</div><h3>Sin convocatorias para comparar</h3><p>Usa el botón "Comparar" en las tarjetas de resultados.</p></div>';
        return;
    }
    const fields = ['Título', 'Entidad', 'Región', 'Apertura', 'Cierre', 'Monto', 'Requisitos', 'Link'];
    const getField = (g, f) => {
        switch (f) {
            case 'Título': return g.title || '-';
            case 'Entidad': return g.entity || '-';
            case 'Región': return `${g.flag || ''} ${g.region || '-'}`;
            case 'Apertura': return g.openDate || '-';
            case 'Cierre': return g.closeDate || '-';
            case 'Monto': return g.amount || '-';
            case 'Requisitos': return (g.requirements || '-').substring(0, 100);
            case 'Link': return g.link && g.link !== '#' ? `<a href="${esc(g.link)}" target="_blank" class="compare-link">Ver →</a>` : '-';
            default: return '-';
        }
    };
    wrap.innerHTML = `<table class="compare-table">
        <thead><tr><th></th>${compareList.map(g => `<th>${esc((g.title || '').substring(0, 40))}</th>`).join('')}</tr></thead>
        <tbody>${fields.map(f => `<tr><td class="compare-field">${f}</td>${compareList.map(g => `<td>${f === 'Link' ? getField(g, f) : esc(getField(g, f))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

function clearCompare() {
    compareList = [];
    document.getElementById('compareCount').textContent = 0;
    renderCompare();
    showToast('🗑 Comparación eliminada');
}

// ═══ ALERTAS ═══
async function loadAlerts() {
    try {
        const res = await fetch('/api/alerts');
        const data = await res.json();
        alerts = data.alerts || [];
        document.getElementById('alertCount').textContent = alerts.length;
    } catch { }
}

async function createNewAlert() {
    const topic = document.getElementById('alertTopic').value.trim();
    const region = document.getElementById('alertRegion').value;
    if (!topic) { showToast('Escribe un tema para la alerta'); return; }

    try {
        const res = await fetch('/api/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, region }),
        });
        const data = await res.json();
        if (data.success) {
            alerts.push(data.alert);
            document.getElementById('alertCount').textContent = alerts.length;
            document.getElementById('alertTopic').value = '';
            renderAlerts();
            showToast(`🔔 Alerta creada: "${topic}"`);
        }
    } catch (err) { showToast('Error creando alerta: ' + err.message); }
}

async function deleteAlertItem(id) {
    try {
        await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
        alerts = alerts.filter(a => a.id !== id);
        document.getElementById('alertCount').textContent = alerts.length;
        renderAlerts();
        showToast('🔕 Alerta eliminada');
    } catch { }
}

async function checkAlertItem(id) {
    showToast('🔍 Buscando nuevas convocatorias...');
    try {
        const res = await fetch(`/api/alerts/${id}/check`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ ${data.newGrants?.length || 0} nuevas de ${data.total} total`);
            if (data.newGrants && data.newGrants.length > 0) {
                currentGrants = [...data.newGrants, ...currentGrants];
                switchTab('search');
                renderGrants();
            }
        }
    } catch (err) { showToast('Error: ' + err.message); }
}

function renderAlerts() {
    const list = document.getElementById('alertsList');
    if (alerts.length === 0) {
        list.innerHTML = '<div class="empty-state visible"><div class="empty-icon">🔔</div><h3>Sin alertas configuradas</h3><p>Crea una alerta para monitorear un tema específico.</p></div>';
        return;
    }
    list.innerHTML = alerts.map(a => `
        <div class="alert-card">
            <div class="alert-card-header">
                <div class="alert-card-info">
                    <strong>🔔 ${esc(a.topic)}</strong>
                    <span class="alert-meta">Región: ${a.region} — Creada: ${new Date(a.createdAt).toLocaleDateString('es-CO')}</span>
                </div>
                <div class="alert-card-actions">
                    <button class="toolbar-btn" onclick="checkAlertItem('${a.id}')">🔍 Buscar</button>
                    <button class="toolbar-btn danger" onclick="deleteAlertItem('${a.id}')">🗑</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ═══ EXPORTAR EXCEL ═══
async function exportExcel() {
    if (!currentGrants || currentGrants.length === 0) { showToast('Busca primero para exportar'); return; }
    showToast('📊 Generando Excel...');
    try {
        const res = await fetch('/api/export-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grants: currentGrants, favorites }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `YedaTech-Resultados-${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ Excel descargado');
    } catch (err) { showToast('Error: ' + err.message); }
}

async function exportFavoritesExcel() {
    if (favorites.length === 0) { showToast('Sin favoritas para exportar'); return; }
    try {
        const res = await fetch('/api/export-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grants: favorites, favorites }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `YedaTech-Favoritas-${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ Favoritas exportadas');
    } catch { }
}

// ═══ UTILIDADES ═══
function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

// ═══ DASHBOARD ═══
function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!currentGrants || currentGrants.length === 0) {
        container.innerHTML = '<div class="dashboard-empty"><div class="empty-icon">📊</div><h3>Realiza una búsqueda primero</h3><p>Los gráficos se generarán automáticamente con tus resultados.</p></div>';
        return;
    }

    // Destruir charts existentes
    Object.values(dashCharts).forEach(c => { if (c && c.destroy) c.destroy(); });
    dashCharts = {};

    container.innerHTML = `
        <div class="charts-grid">
            <div class="chart-card"><h3>🌍 Convocatorias por Región</h3><canvas id="chartRegion"></canvas></div>
            <div class="chart-card"><h3>💰 Distribución por Monto</h3><canvas id="chartAmount"></canvas></div>
            <div class="chart-card full-width"><h3>📅 Timeline de Fechas Límite</h3><canvas id="chartTimeline"></canvas></div>
        </div>
        <div style="text-align:center;margin-top:1rem;">
            <button class="search-btn" style="max-width:300px;" onclick="exportPDF()">📄 Exportar Reporte PDF</button>
        </div>`;

    setTimeout(() => {
        buildRegionChart();
        buildAmountChart();
        buildTimelineChart();
    }, 100);
}

function buildRegionChart() {
    const regionCount = {};
    currentGrants.forEach(g => {
        const r = g.region || 'No especificada';
        regionCount[r] = (regionCount[r] || 0) + 1;
    });
    const labels = Object.keys(regionCount);
    const data = Object.values(regionCount);
    const colors = ['#FF6900', '#FFB800', '#00C9A7', '#845EC2', '#D65DB1', '#0081CF', '#C34A36', '#2C73D2'];

    const ctx = document.getElementById('chartRegion');
    if (!ctx) return;
    dashCharts.region = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#aaa', font: { size: 11 } } } }
        }
    });
}

function buildAmountChart() {
    const buckets = { 'Sin monto': 0, '< $50K': 0, '$50K-$500K': 0, '$500K-$1M': 0, '> $1M': 0 };
    currentGrants.forEach(g => {
        const a = g.amount || '';
        const num = parseFloat(a.replace(/[^0-9.]/g, ''));
        if (!num || isNaN(num)) { buckets['Sin monto']++; }
        else if (a.toLowerCase().includes('million') || num > 1000000) { buckets['> $1M']++; }
        else if (num > 500000) { buckets['$500K-$1M']++; }
        else if (num > 50000) { buckets['$50K-$500K']++; }
        else { buckets['< $50K']++; }
    });

    const ctx = document.getElementById('chartAmount');
    if (!ctx) return;
    dashCharts.amount = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(buckets),
            datasets: [{ data: Object.values(buckets), backgroundColor: ['#555', '#00C9A7', '#FFB800', '#FF6900', '#D65DB1'], borderRadius: 6, borderSkipped: false }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#aaa', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function buildTimelineChart() {
    const months = {};
    currentGrants.forEach(g => {
        const d = g.closeDate || g.openDate;
        if (!d || d === 'Consultar portal oficial' || d === 'Abierta actualmente') return;
        try {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime())) return;
            const key = parsed.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
            months[key] = (months[key] || 0) + 1;
        } catch { }
    });

    const sorted = Object.entries(months).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    const ctx = document.getElementById('chartTimeline');
    if (!ctx) return;

    if (sorted.length === 0) {
        ctx.parentElement.innerHTML = '<h3>📅 Timeline de Fechas Límite</h3><p style="color:var(--text-muted);font-size:0.85rem;">No se encontraron fechas límite válidas en los resultados.</p>';
        return;
    }

    dashCharts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1]),
                borderColor: '#FF6900', backgroundColor: 'rgba(255,105,0,0.1)',
                fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#FF6900'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#aaa', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

// ═══ EXPORTAR PDF ═══
function exportPDF() {
    if (!currentGrants || currentGrants.length === 0) { showToast('Busca primero para exportar PDF'); return; }
    showToast('📄 Generando PDF...');

    const div = document.createElement('div');
    div.style.cssText = 'padding:30px;color:#222;font-family:Inter,sans-serif;background:#fff;max-width:800px;';
    div.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <h1 style="color:#FF6900;margin:0;">YedaTech</h1>
            <p style="color:#666;font-size:13px;">Reporte de Convocatorias — ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
                <tr style="background:#FF6900;color:#fff;">
                    <th style="padding:8px;text-align:left;">Convocatoria</th>
                    <th style="padding:8px;text-align:left;">Entidad</th>
                    <th style="padding:8px;">Cierre</th>
                    <th style="padding:8px;">Monto</th>
                    <th style="padding:8px;">Región</th>
                </tr>
            </thead>
            <tbody>
                ${currentGrants.map((g, i) => `
                    <tr style="background:${i % 2 ? '#f9f9f9' : '#fff'};">
                        <td style="padding:6px 8px;font-weight:600;">${esc(g.title || '').substring(0, 60)}</td>
                        <td style="padding:6px 8px;">${esc(g.entity || '').substring(0, 40)}</td>
                        <td style="padding:6px 8px;text-align:center;">${esc(g.closeDate || '-')}</td>
                        <td style="padding:6px 8px;text-align:center;color:#FF6900;">${esc(g.amount || '-')}</td>
                        <td style="padding:6px 8px;text-align:center;">${esc(g.region || '-')}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
        <p style="margin-top:20px;font-size:10px;color:#999;text-align:center;">Generado por YedaTech — ${currentGrants.length} convocatorias — ${new Date().toLocaleString('es-CO')}</p>`;

    const opt = {
        margin: 0.5,
        filename: `YedaTech-Reporte-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(div).save().then(() => showToast('✅ PDF descargado'));
}

// ═══ SCROLL REVEAL ═══
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

function initScrollReveal() {
    document.querySelectorAll('.stat-card, .chart-card, .grant-card').forEach(el => {
        el.classList.add('reveal');
        revealObserver.observe(el);
    });
}
