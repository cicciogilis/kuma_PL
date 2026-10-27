# Kuma PL — note di progetto

## Convenzioni CSS
- **`src/index.css` NON è importato da nessun file** (residuo del template Vite): non usarlo,
  le regole condivise vanno in `src/App.css` (importato da `App.jsx`, sempre caricato).
- Tema scuro: card `#1a1a1a`, accento rosso `#ff4136`, blu `#38bdf8`, verde `#7bd88f`.
- Scrollbar: regole globali in fondo ad `App.css` (`html` + `*`, thumb `#3a3a3a`).
- Checkbox custom: classe `checkbox-dark` su `<input type="checkbox">`; il CSS usa
  `input.checkbox-dark[type="checkbox"]` per battere le regole generiche `.campo input`.

## Banner scadenza scheda (`.program-expiry-action`)
- Stati pending (giallo) e sent (verde) devono condividere la STESSA geometria:
  stesso padding, stesso border-radius, stesso font-size. Solo colore/bordo/background
  cambiano via override minimale (DRY).
- **NO `position: absolute`** per il banner: usa normal flow con `width: 100%` su mobile.
- **NO `white-space: nowrap`**: il testo deve poter andare a capo su viewport stretti.
- **NO `:has()` padding hack**: se il banner è in normal flow non serve compensare
  l'altezza del parent con `:has(.program-expiry-action.sent) { padding-top: ... }`.
- `box-sizing: border-box` + `max-width: 100%` obbligatori su qualsiasi elemento a
  larghezza variabile dentro card.
- border-radius: `12px` (non pill `999px`) per coerenza desktop/mobile.
- Per farlo estendere **sopra le icone** (pencil/cestino/freccia) serve la grid su
  `.program-card-header` a ≤480px con `display: contents` su `.program-card-main`
  e `grid-auto-flow: row dense`. Vedi nota nel log del 2026-10-26.
- Test di regola: `.workbuddy-ai/tests/expiryBanner.css.test.js` + layout Playwright.

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

## Sincronizzare kuma_PL → SBD-ladder: attenzione ai line ending
- Stesso contenuto, ma **worktree diverso**: kuma_PL ha `w/lf`, SBD-ladder ha
  `w/crlf` (`git ls-files --eol` per verificare). Copiare i file così come sono
  fa comparire in SBD-ladder un diff che riscrive l'intero file.
- Copiare convertendo in CRLF (Python: `text.replace('\r\n','\n').replace('\n','\r\n')`).
  Poi `git diff --stat` deve mostrare solo le righe realmente cambiate.

## TRAPPOLA: specificità CSS sulle classi "di comodo"
- `.toggle-row .toggle-text { max-width: 220px }` (0,2,0) batteva
  `.leaderboard-toggle-text { max-width: none }` (0,1,0): override inefficace,
  colonna di testo bloccata a 220px a ogni larghezza → wrap indesiderati su
  desktop e spazio vuoto a destra.
- Regola: quando si crea una classe "variante" che deve sovrascrivere una regola
  composta (`.a .b`), la variante deve avere **almeno la stessa specificità**
  (es. `.leaderboard-toggle-row .leaderboard-toggle-text`), non una in meno.
- Verificare sempre con una misura reale (bounding box), non a occhio: lo switch
  era già a offset 0, il problema era la larghezza della colonna di testo.

## Dati anagrafici obbligatori (pagina "Informazioni personali")
- Elenco unico in `src/utils/personalInfo.js` (`REQUIRED_PERSONAL_FIELDS`):
  Nome, Cognome, Data di nascita, Genere, Città di nascita, Provincia.
- Dopo il login, se manca anche uno solo, si passa da `currentPage === 'PersonalInfo'`
  prima di entrare. `firstLogin` **non** va azzerato in quel momento: si azzera
  solo al "Continua", così il popup benvenuto/massimali arriva dopo.
- Il salvataggio usa `update()` con i soli 6 campi: **non** `handleSave`, che
  riscrive tutto lo stato locale (massimali, programmazioni, ecc.).
- I 6 campi stanno in `renderPersonalInfoFields()` che restituisce **solo gli
  item** (niente wrapper `.personal-info-grid`): la registrazione deve restare
  su un'unica griglia o cambiano le spaziature delle credenziali.

## Timer di recupero (Strumenti allenamento)
- Suono da **elemento `<audio loop>`** (`src/utils/timerAlarm.js`), non da Web
  Audio: solo un media element prende il focus audio e quindi mette in pausa /
  riprende la musica del telefono. Va "sbloccato" sul tap di "Avvia".
- `public/sw.js` serve solo a `showNotification` (notifica persistente, tap →
  stop). Registrato all'apertura del pannello.
- **A pagina/browser chiusi il timer non può suonare**: è un limite del web.
  Per quello serve `@capacitor/local-notifications` nella build nativa.
- `stopAlarm` riporta sempre `timerRemaining` a `preset * 60`.
- Sul timer c'è anche un `setTimeout` secco su `timerEndsAt`: in background i
  `setInterval` vengono rallentati, il timeout no.

## TRAPPOLA: flex non scende sotto il min-content
- `flex: 1 1 0` + `min-width: 0` su due riquadri affiancati **non** garantisce
  larghezze uguali: il flex può fermarsi al min-content dell'elemento più
  "largo" (misurato 115/137 invece di 126/126).
- Per una divisione deterministica usare `display: grid` con
  `grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr)`.
- Vale anche per le larghezze "riempi lo spazio": verificare sempre con
  `getBoundingClientRect`, non a occhio.



## TRAPPOLA: `display:flex` su `<th>`/`<td>` rompe il layout di tabella
`th { display:flex }` toglie la cella dal layout di tabella: `colSpan` non viene
onorato e la cella si riduce al contenuto (l'header "Week N" finiva compresso
nella colonna Giorno). Il flex va su un `<div>` **dentro** la cella.

## Filtri scadenze dashboard allenatore (`src/utils/teamFilters.js`)
Fasce disgiunte: `w1` 0..7, `w2` 8..14, `w3` 15..21, `expired` <0 (tutte),
`expired1` -7..-1, `expired2` -14..-8, `all` tutto tranne `null`.
`expired` sovrappone di proposito `expired1`/`expired2`; queste due no tra loro.
Test: `src/utils/teamFilters.test.js` + e2e `coachDashboard.e2e.mjs`.

## TRAPPOLA: `<button>` è `border-box`, `<div>` no
Il progetto non ha `* { box-sizing: border-box }`: i `<button>` sono border-box
per default UA, i `<div>` no. Se un blocco con `width: 100%` + padding + border
passa da `<button>` a `<div>` (es. per mettere icone dentro), aggiungere
`box-sizing: border-box` o sborda della somma di padding e bordo.

## Complementari: le note sono indicizzate
`accessoryNoteKeyFor(day, exerciseIndex)` → `accessory-{day}-{index}`. Eliminare
un giorno o un esercizio sposta gli indici: `noteDraft` va **rimappato** sulla
nuova numerazione, altrimenti al salvataggio le note restano sul vecchio indice.
`applyProgramEdit` rinumera i giorni da 1.
Logica del form in `src/utils/accessoryForm.js` (+ test): build/format dei blocchi.
