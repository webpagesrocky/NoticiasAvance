# 📊 Avance Institucional

Boletín web de monitoreo de noticias de **inversión, empresas y economía** de **Mexicali, Tijuana y Baja California**. Es un resumen ejecutivo interno (no un periódico público): se comparte como un **link** a la dirección para que vean de un vistazo lo más relevante.

Genera dos cosas cada semana:
- 🗓️ Un **boletín semanal** (cada **viernes**).
- 📅 Un **resumen mensual** que junta todas las semanas del mes (se actualiza solo).

Cada noticia se clasifica en uno de **7 ejes** y lleva un **indicador tipo semáforo**:

- 🟢 **Verde** — Oportunidad / positivo
- 🟡 **Amarillo** — Seguimiento / neutral
- 🔴 **Rojo** — Alerta / riesgo

---

## 🧩 ¿Qué hace?

1. **Busca** noticias de los 7 ejes con **NewsAPI** (principal) o **GNews** (respaldo), más **RSS** de medios locales.
2. **Clasifica** cada nota con **Claude (Anthropic)**: le asigna eje, color de semáforo y un resumen ejecutivo.
3. **Genera** la edición de la semana y **actualiza el consolidado del mes** (HTML + `.docx` de cada uno).
4. **Archiva** todo en `docs/ediciones/` y organiza el historial **por mes** en `docs/historial.html`.
5. Todo corre **solo cada viernes** con **GitHub Actions** y se publica con **GitHub Pages**.

---

## 🗂️ Estructura

```
avance-institucional/
├── src/
│   ├── fetchNews.js   # Busca noticias (NewsAPI/GNews + RSS) por los 7 ejes
│   ├── classify.js    # Anthropic: eje + semáforo + resumen
│   ├── renderHtml.js  # Arma la página HTML (tipografía moderna + semáforo)
│   ├── renderDocx.js  # Arma el .docx de la edición
│   ├── archive.js     # Manifiesto del historial + historial.html
│   ├── mensual.js     # Guarda notas por semana y arma el consolidado del mes
│   ├── util.js        # Semana, mes, ejes, colores, agrupado por mes
│   └── index.js       # Orquesta todo el flujo
├── docs/              # Salida pública que publica GitHub Pages
│   ├── index.html     # Edición semanal más reciente
│   ├── historial.html # Todas las ediciones, agrupadas por mes
│   └── ediciones/     # semana-AAAA-NN y mes-AAAA-MM (.html y .docx)
├── data/
│   ├── queries.json   # Términos de búsqueda por eje (editable)
│   ├── semaforo.json  # Criterios del semáforo (editable)
│   ├── ediciones.json # Manifiesto del historial (se llena solo)
│   └── notas/         # Notas guardadas por semana (para armar el mensual)
├── .github/workflows/semanal.yml
├── .env.example
├── package.json
└── README.md
```

---

## 🔑 Cómo conseguir las API keys

### 1) NewsAPI (principal)
1. Entra a **https://newsapi.org** → *Get API Key*.
2. Regístrate gratis y copia tu clave.

> Si el plan gratuito te limita, usa GNews como proveedor (`NEWS_PROVIDER=gnews`).

### 2) GNews (respaldo)
1. Entra a **https://gnews.io** → *Sign Up*.
2. Copia tu *API Key* del dashboard.

### 3) Anthropic (la IA que clasifica)
1. Entra a **https://console.anthropic.com** → *API Keys* → *Create Key*.
2. Copia la llave (empieza con `sk-ant-...`).

> ⚠️ **Nunca** pegues estas llaves en el código, ni en chats, ni en capturas. Solo van en tu archivo `.env` local y en los **Secrets** de GitHub.

---

## 💻 Probar en local

```bash
npm install            # instalar dependencias
cp .env.example .env    # crear tu archivo de llaves
#   abre .env y pega tus llaves reales
npm start               # generar el boletín
```

Al terminar, abre **`docs/index.html`** en tu navegador.

> 💡 El modelo de IA está en `src/classify.js` (constante `MODELO`). Por defecto usa `claude-sonnet-4-6`. Para gastar menos, cámbialo a `claude-haiku-4-5-20251001`.

---

## 🌐 Activar GitHub Pages (una sola vez)

En tu repo de GitHub:

1. **Settings** → **Pages**.
2. **Source**: *Deploy from a branch*.
3. **Branch**: `main` y carpeta **`/docs`** → *Save*.
4. En ~1 minuto tendrás la URL pública (`https://TU-USUARIO.github.io/noticiasavance/`). **Ese es el link que mandas a la dirección.**

---

## 🔒 Configurar los Secrets (una sola vez)

En tu repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Crea estos:

| Nombre | Valor |
|---|---|
| `NEWS_API_KEY` | Tu llave de NewsAPI |
| `GNEWS_API_KEY` | Tu llave de GNews |
| `ANTHROPIC_API_KEY` | Tu llave de Anthropic |

(Opcional) En la pestaña **Variables**, puedes crear `NEWS_PROVIDER` con valor `newsapi` o `gnews`.

---

## 🤖 Automatización

- **Automático**: cada **viernes 15:00 UTC** (8:00 AM hora Mexicali) — `.github/workflows/semanal.yml`.
- **Manual**: pestaña **Actions** → *Avance Institucional - boletín semanal* → **Run workflow**.

Cada corrida genera la edición de la semana **y** actualiza el resumen del mes en curso. El workflow hace *commit* de `docs/` y `data/`, y GitHub Pages publica el resultado automáticamente.

---

## 🛠️ Personalización rápida

- **Términos de búsqueda**: `data/queries.json`.
- **Criterios del semáforo**: `data/semaforo.json`.
- **Feeds RSS locales**: constante `FEEDS_RSS` en `src/fetchNews.js`.
- **Modelo de IA**: constante `MODELO` en `src/classify.js`.
- **Día/hora del envío**: línea `cron` en `.github/workflows/semanal.yml`.
