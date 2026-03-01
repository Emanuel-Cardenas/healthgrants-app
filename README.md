# ⚡ YedaTech — HealthGrants App v6

> Sistema multiagente de investigación en tiempo real sobre convocatorias abiertas en salud.

## 🧠 5 Agentes IA

| Agente | Función |
|--------|--------|
| 🔍 Agente 1 | **Búsqueda Profunda** — Multi-buscador (DuckDuckGo + Bing + Brave), 25+ portales oficiales, Deep Crawling, Gemini queries inteligentes |
| ✅ Agente 2 | **Verificación Estricta** — Scoring multi-factor, verificación GET de enlaces, deduplicación |
| 📊 Agente 3 | **Estructuración** — Extracción profunda de fechas, montos, requisitos, tags automáticos |
| 🧠 Agente 4 | **Resumen IA (Gemini)** — Resúmenes ejecutivos en español, inferencia de fechas |
| 🔔 Agente 5 | **Alertas** — Monitoreo de convocatorias, detección de nuevas oportunidades |

## 🚀 Instalación

```bash
npm install
```

## ⚙️ Configuración

Crea un archivo `.env` en la raíz del proyecto:

```env
GEMINI_API_KEY=tu_api_key_de_gemini
PORT=3000
```

## 🏃 Ejecución

```bash
npm start
```

Abre http://localhost:3000 en tu navegador.

## ✨ Características

- 🔬 **Investigación profunda** — Scraping de 25+ fuentes oficiales (NIH, WHO, Wellcome Trust, Gates Foundation, MinCiencias, CONICET, ANID, etc.)
- 🧠 **Gemini IA** — Queries inteligentes y resúmenes ejecutivos automáticos
- 📄 **Parsing PDF** — Descarga y analiza documentos PDF de convocatorias
- 📊 **Dashboard Analítico** — Gráficos interactivos (Chart.js) por región, monto y timeline
- 📊 **Exportar Excel** — Descarga resultados en formato .xlsx
- 📄 **Exportar PDF** — Reportes profesionales en PDF
- ⭐ **Favoritas** — Guarda convocatorias de interés
- ⚖️ **Comparar** — Compara hasta 4 convocatorias lado a lado
- 📜 **Historial** — Registro de búsquedas recientes
- 🔔 **Alertas** — Monitorea temas específicos y detecta nuevas convocatorias
- 🎨 **UI Premium** — Dark mode SaaS con micro-animaciones, glassmorphism y diseño responsive

## 🌎 Regiones Soportadas

- 🌐 Global
- 🇺🇸 Norteamérica
- 🇪🇺 Europa
- 🌎 Latinoamérica
- 🇨🇴 Colombia
- 🇦🇷 Argentina
- 🇨🇱 Chile

## 🛠 Stack Tecnológico

- **Backend:** Node.js + Express
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla
- **IA:** Google Gemini 2.0 Flash
- **Scraping:** Cheerio + node-fetch
- **PDF:** pdf-parse
- **Charts:** Chart.js
- **Excel:** SheetJS (xlsx)
- **PDF Export:** html2pdf.js

## 📁 Estructura

```
healthgrants-app/
├── server.js              # Servidor principal — orquesta 5 agentes
├── package.json
├── .env                   # Variables de entorno (no incluido)
├── agents/
│   ├── search-agent.js    # Agente 1 — Búsqueda profunda
│   ├── verify-agent.js    # Agente 2 — Verificación
│   ├── structure-agent.js # Agente 3 — Estructuración
│   ├── summary-agent.js   # Agente 4 — Resumen IA
│   └── alerts-agent.js    # Agente 5 — Alertas
└── public/
    ├── index.html         # Frontend principal
    ├── styles.css         # Design System SaaS
    └── app.js             # Lógica del frontend
```

## 📝 Licencia

MIT
