# Kuma PL — note di progetto

## Convenzioni CSS
- **`src/index.css` NON è importato da nessun file** (residuo del template Vite): non usarlo,
  le regole condivise vanno in `src/App.css` (importato da `App.jsx`, sempre caricato).
- Tema scuro: card `#1a1a1a`, accento rosso `#ff4136`, blu `#38bdf8`, verde `#7bd88f`.
- Scrollbar: regole globali in fondo ad `App.css` (`html` + `*`, thumb `#3a3a3a`).
- Checkbox custom: classe `checkbox-dark` su `<input type="checkbox">`; il CSS usa
  `input.checkbox-dark[type="checkbox"]` per battere le regole generiche `.campo input`.

## TRAPPOLA: lo sfondo `.app-background` (z-index:-1) NON va coperto da `html`
- Lo sfondo app (`.app-background`, `App.css`) è un layer `position:fixed; inset:0; z-index:-1`
  con `background-image: url('/logo512.png')`, `opacity:.12`, `filter:grayscale(100%)`.
  È **leggerissimo**: la zampa rossa su fondo nero, in grigio al 12% ≈ quasi invisibile al naso.
- Per vederlo il **canvas** deve essere nero e il `body` NON deve dipingere un proprio sfondo
  opaco: con `html` senza `background-color`, il nero di `body` propaga al canvas (dietro
  tutto) e il layer `z-index:-1` resta visibile.
- **Se si mette `background-color` su `html`**, la propagazione si interrompe, `body` dipinge
  il proprio nero come sfondo normale e — per l'ordine di pittura CSS — quel nero viene
  dipinto **DOPO** i layer a z-index negativo: **copre lo sfondo e l'app resta tutta nera**.
  (Stesso effetto con `body { background-color }` non trasparente + qualunque altro overlay
  opaco a z-index 0.)
- Regola pratica: **mai `background-color` su `html`**; il nero lo mette `body`.
  Se serve uno sfondo scuro lato, usare `html { background: transparent }` o portare il
  nero su un pseudo-elemento `z-index: -1`, non su `html`/`body` con z-index normale.
- Verificato con Playwright il 2026-10-25: senza `background-color` su `html` lo screenshot
  mostra la filigrana; con, sparisce del tutto.


## Repository
- `kuma_PL` (remote `github.com/cicciogilis/kuma_PL`): copia di sviluppo, include Capacitor
  (`android/`, `ios/`) e `dist/` tracciato.
- `../SBD-ladder` (remote `github.com/Frankesko/SBD-ladder`): versione web-only, branch di
  lavoro `feature/upgrade_cicciogilis`, è quella destinata al deploy su Vercel.

## PWA / installabilità (stato al 2026-10-25)
- `public/manifest.json` soddisfa i criteri di installabilità di Chrome: name/short_name,
  icone 192x192 e 512x512 PNG (dimensioni reali corrette), `start_url: "/"`, `scope: "/"`,
  `display: standalone`, `prefer_related_applications: false`.
- `index.html` ha `apple-mobile-web-app-capable`, `apple-touch-icon` 180x180 e `theme-color`:
  su iOS "Aggiungi a Home" funziona e apre in standalone.
- **Non esiste alcun service worker** (nessun `sw.js`, nessuna registrazione): l'app si installa
  ma non ha cache offline; tutto dipende dalla rete (Firebase Realtime DB).
- Icone senza `"purpose": "maskable"`: su Android l'icona viene mascherata dal sistema.

## Deploy Vercel (SBD-ladder)
- `origin/main` è **antenato** di `feature/upgrade_cicciogilis`: il branch contiene già tutto main
  (merge = fast-forward), non ci sono divergenze.
- `main` non ha `vercel.json`: il progetto Vercel è configurato dalla dashboard (default Vite).
  Il `vercel.json` aggiunto replica i default (build `npm run build`, output `dist`) e aggiunge
  rewrite SPA + cache header: se la dashboard ha valori diversi, ora vince il file.
- Config Firebase hardcoded in `src/utils/firebase.js` (progetto `sbd-ladder`), identica a main:
  nessuna variabile d'ambiente necessaria. L'unica è `VITE_DEV_ADMIN_KEY` in `App.jsx`,
  con fallback `'KumaDev2026'` finito nel bundle: non è un segreto.
- `dist/` non è tracciato né su main né sul branch (corretto per Vercel).
- Nessun `engines`/`.nvmrc` da nessuna delle due parti: Vercel usa il Node di default del progetto.


