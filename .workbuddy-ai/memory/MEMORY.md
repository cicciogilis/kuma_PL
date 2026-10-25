# Kuma PL — note di progetto

## Convenzioni CSS
- **`src/index.css` NON è importato da nessun file** (residuo del template Vite): non usarlo,
  le regole condivise vanno in `src/App.css` (importato da `App.jsx`, sempre caricato).
- Tema scuro: card `#1a1a1a`, accento rosso `#ff4136`, blu `#38bdf8`, verde `#7bd88f`.
- Scrollbar: regole globali in fondo ad `App.css` (`html` + `*`, thumb `#3a3a3a`).
- Checkbox custom: classe `checkbox-dark` su `<input type="checkbox">`; il CSS usa
  `input.checkbox-dark[type="checkbox"]` per battere le regole generiche `.campo input`.

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

