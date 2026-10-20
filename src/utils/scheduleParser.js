const DAYS = [
  { day: 1, label: 'Lunedì', short: 'Lun', pattern: /^lun/i },
  { day: 2, label: 'Martedì', short: 'Mar', pattern: /^mar/i },
  { day: 3, label: 'Mercoledì', short: 'Mer', pattern: /^mer/i },
  { day: 4, label: 'Giovedì', short: 'Gio', pattern: /^gio/i },
  { day: 5, label: 'Venerdì', short: 'Ven', pattern: /^ven/i },
  { day: 6, label: 'Sabato', short: 'Sab', pattern: /^sab/i },
  { day: 7, label: 'Domenica', short: 'Dom', pattern: /^dom/i },
];

const LIFTS = [
  { key: 'panca', label: 'Panca', pattern: /panca/i },
  { key: 'squat', label: 'Squat', pattern: /squat/i },
  { key: 'stacco', label: 'Stacco', pattern: /stacco/i },
];

const LIFT_ORDER = { squat: 0, panca: 1, stacco: 2 };

const DAY_PREFIX = /^(?:lun(?:ed[ìi])?|mar(?:ted[ìi])?|mer(?:coled[ìi])?|gio(?:ved[ìi])?|ven(?:erd[ìi])?|sab(?:ato)?|dom(?:enica)?)\s*[:-]?\s*/i;

const BLOCK_PATTERNS = [
  {
    // 5x5 @80%
    regex: /^(\d+)\s*[x×]\s*(\d+)\s*@\s*(\d+(?:[.,]\d+)?)\s*%\s*(.*)$/i,
    build: (match) => ({
      sets: Number.parseInt(match[1], 10),
      reps: Number.parseInt(match[2], 10),
      rpe: null,
      percent: toNumber(match[3]),
      note: match[4],
    }),
  },
  {
    // 5x5 80% | 3x3 @8 80% | 3x6 75% (fermo 1")
    regex: /^(\d+)\s*[x×]\s*(\d+)\s*(?:@\s*(\d+(?:[.,]\d+)?))?\s*(?:(\d+(?:[.,]\d+)?)\s*%)?\s*(.*)$/i,
    build: (match) => ({
      sets: Number.parseInt(match[1], 10),
      reps: Number.parseInt(match[2], 10),
      rpe: toNumber(match[3]),
      percent: toNumber(match[4]),
      note: match[5],
    }),
  },
  {
    // 85% 3x3
    regex: /^(\d+(?:[.,]\d+)?)\s*%\s*(\d+)\s*[x×]\s*(\d+)\s*(.*)$/i,
    build: (match) => ({
      sets: Number.parseInt(match[2], 10),
      reps: Number.parseInt(match[3], 10),
      rpe: null,
      percent: toNumber(match[1]),
      note: match[4],
    }),
  },
  {
    // 2 @8
    regex: /^(\d+)\s*@\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i,
    build: (match) => ({
      sets: 1,
      reps: Number.parseInt(match[1], 10),
      rpe: toNumber(match[2]),
      percent: null,
      note: match[3],
    }),
  },
  {
    // 4 rpe 9 | 4 rpe @9
    regex: /^(\d+)\s*rpe\s*@?\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i,
    build: (match) => ({
      sets: 1,
      reps: Number.parseInt(match[1], 10),
      rpe: toNumber(match[2]),
      percent: null,
      note: match[3],
    }),
  },
  {
    // 80%
    regex: /^(\d+(?:[.,]\d+)?)\s*%\s*(.*)$/i,
    build: (match) => ({
      sets: null,
      reps: null,
      rpe: null,
      percent: toNumber(match[1]),
      note: match[2],
    }),
  },
];

export class ScheduleParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScheduleParseError';
  }
}

const loadXlsx = () => import('xlsx');

const cellText = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());

const toNumber = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const extractNumbers = (value) => {
  const matches = String(value ?? '').match(/\d+(?:[.,]\d+)?/g);
  return matches ? matches.map(toNumber).filter((n) => n != null) : [];
};

const findLift = (text) => LIFTS.find((lift) => lift.pattern.test(text));
const findDay = (text) => DAYS.find((day) => day.pattern.test(text));

// La scheda di esempio ha anche una griglia con "Squat (programma)" in alto:
// la riga di intestazione vera è quella con "Programma Panca/Squat/Stacco".
const findHeaderLift = (text) =>
  /programma\s*(?:di\s*)?(?:panca|squat|stacco)/i.test(text) ? findLift(text) : null;

const cleanNote = (value) =>
  String(value ?? '')
    .replace(/^[\s\-–—:;,.()[\]{}]+/, '')
    .replace(/[\s\-–—:;,.()[\]{}]+$/, '')
    .trim();

const matchWeekNumber = (text) => {
  const normalized = cellText(text);
  let match = normalized.match(/^(\d+)\s*week$/i);
  if (match) return Number.parseInt(match[1], 10);
  match = normalized.match(/^week\s*(\d+)$/i);
  if (match) return Number.parseInt(match[1], 10);
  match = normalized.match(/^settimana\s*(\d+)$/i);
  if (match) return Number.parseInt(match[1], 10);
  return null;
};

const parseLiftCell = (text, columnVariant) => {
  const day = findDay(text);
  if (!day) return null;

  const content = text.replace(DAY_PREFIX, '').trim();
  if (!content) return null;

  // Le virgole decimali ("82,5%") non devono spezzare i blocchi
  const segments = content.split(/\s*(?:\+|;|,|\/(?=\s*\d))\s*/).filter(Boolean);
  const blocks = [];
  const notes = [];
  let lastRpeBlock = null;

  segments.forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;

    for (const pattern of BLOCK_PATTERNS) {
      const match = trimmed.match(pattern.regex);
      if (!match) continue;

      const block = pattern.build(match);
      const isRpeBlock = block.rpe != null && block.percent == null;
      const percentBase = block.percent != null && block.rpe == null && lastRpeBlock
        ? {
            sets: lastRpeBlock.sets,
            reps: lastRpeBlock.reps,
            rpe: lastRpeBlock.rpe,
          }
        : null;

      const parsedBlock = {
        sets: block.sets,
        reps: block.reps,
        rpe: block.rpe,
        percent: block.percent,
        percentBase,
      };
      blocks.push(parsedBlock);

      if (isRpeBlock) lastRpeBlock = parsedBlock;

      const note = cleanNote(block.note);
      if (note) notes.push(note);
      return;
    }

    const note = cleanNote(trimmed);
    if (note) notes.push(note);
  });

  let variant = columnVariant || '';
  if (/classic/i.test(content)) variant = 'classico';
  else if (/sumo/i.test(content)) variant = 'sumo';

  return {
    day,
    blocks,
    notes: [...new Set(notes)].join(' · '),
    raw: content,
    variant,
  };
};

const parseWorksheet = (sheet, sheetName, XLSX) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (!rows.length) throw new ScheduleParseError('Il foglio è vuoto.');

  const headerCandidates = [];
  rows.forEach((row, rowIndex) => {
    const liftCount = row.filter((cell) => findHeaderLift(cellText(cell))).length;
    if (liftCount > 0) headerCandidates.push({ rowIndex, liftCount });
  });

  // Preferisce l'intestazione seguita subito dai blocchi settimanali:
  // evita di scambiare un titolo/copertina per la tabella vera.
  const headerWithWeeks = headerCandidates.find(({ rowIndex }) =>
    rows
      .slice(rowIndex + 1, rowIndex + 6)
      .some((row) => row.some((cell) => matchWeekNumber(cell) != null))
  );
  const headerCandidate = headerWithWeeks
    || [...headerCandidates].sort((a, b) => b.liftCount - a.liftCount)[0];

  const headerRowIndex = headerCandidate?.rowIndex ?? -1;

  if (headerRowIndex < 0) {
    throw new ScheduleParseError(
      'Formato non riconosciuto: non trovo la riga con "Programma Panca", "Programma Squat" o "Programma Stacco".'
    );
  }

  const headerCells = rows[headerRowIndex];
  const columns = [];

  headerCells.forEach((cell, colIndex) => {
    const headerText = cellText(cell);
    const lift = findHeaderLift(headerText) || findLift(headerText);
    if (!lift) return;

    const hasSumo = /sumo/i.test(headerText);
    const hasClassic = /classic/i.test(headerText);
    const variant = hasSumo && !hasClassic ? 'sumo' : hasClassic && !hasSumo ? 'classico' : '';

    const numbers = extractNumbers(headerText);
    if (!numbers.length) {
      for (let nextCol = colIndex + 1; nextCol < headerCells.length; nextCol += 1) {
        const nextText = cellText(headerCells[nextCol]);
        if (!nextText) continue;
        if (findLift(nextText)) break;
        const nextNumbers = extractNumbers(nextText);
        if (nextNumbers.length) numbers.push(...nextNumbers);
        break;
      }
    }

    columns.push({ key: lift.key, label: lift.label, variant, colIndex, numbers });
  });

  if (!columns.length) {
    throw new ScheduleParseError('Non ho trovato colonne di alzate nella riga di intestazione.');
  }

  const maxes = { panca: null, squat: null, staccoSumo: null, staccoClassico: null };

  columns.forEach((column) => {
    if (!column.numbers.length) return;

    if (column.key === 'panca') {
      maxes.panca = column.numbers[0];
      return;
    }
    if (column.key === 'squat') {
      maxes.squat = column.numbers[0];
      return;
    }

    if (column.numbers.length >= 2) {
      maxes.staccoSumo = column.numbers[0];
      maxes.staccoClassico = column.numbers[1];
    } else if (column.variant === 'classico') {
      maxes.staccoClassico = column.numbers[0];
    } else if (column.variant === 'sumo') {
      maxes.staccoSumo = column.numbers[0];
    } else {
      maxes.staccoSumo = maxes.staccoSumo ?? column.numbers[0];
      maxes.staccoClassico = maxes.staccoClassico ?? column.numbers[0];
    }
  });

  const weekRows = new Map();
  rows.forEach((row, rowIndex) => {
    if (rowIndex <= headerRowIndex) return;
    for (const cell of row) {
      const week = matchWeekNumber(cell);
      if (week != null) {
        if (!weekRows.has(week)) weekRows.set(week, rowIndex);
        break;
      }
    }
  });

  const weekMarkers = [...weekRows.entries()]
    .map(([week, row]) => ({ week, row }))
    .sort((a, b) => a.row - b.row);

  if (!weekMarkers.length) {
    throw new ScheduleParseError(
      'Formato non riconosciuto: non trovo i blocchi settimanali ("1 week", "2 week", ...).'
    );
  }

  const sessions = new Map();

  weekMarkers.forEach((marker, markerIndex) => {
    const startRow = marker.row + 1;
    const endRow = markerIndex + 1 < weekMarkers.length ? weekMarkers[markerIndex + 1].row : rows.length;

    columns.forEach((column) => {
      for (let rowIndex = startRow; rowIndex < endRow; rowIndex += 1) {
        const text = cellText(rows[rowIndex]?.[column.colIndex]);
        if (!text) continue;

        const parsed = parseLiftCell(text, column.variant);
        if (!parsed || !parsed.blocks.length) continue;

        const sessionKey = `${marker.week}|${parsed.day.day}`;
        if (!sessions.has(sessionKey)) {
          sessions.set(sessionKey, {
            week: marker.week,
            day: parsed.day.day,
            weekday: parsed.day.label,
            lifts: [],
          });
        }

        sessions.get(sessionKey).lifts.push({
          key: column.key,
          label: column.label,
          variant: parsed.variant,
          blocks: parsed.blocks,
          notes: parsed.notes,
          raw: parsed.raw,
        });
      }
    });
  });

  if (!sessions.size) {
    throw new ScheduleParseError(
      'Formato non riconosciuto: non trovo righe con "Lun:", "Mar:", "Gio:", ... dentro le settimane.'
    );
  }

  const sortedSessions = [...sessions.values()]
    .map((session) => ({
      ...session,
      lifts: [...session.lifts].sort((a, b) => LIFT_ORDER[a.key] - LIFT_ORDER[b.key]),
    }))
    .sort((a, b) => (a.week - b.week) || (a.day - b.day));

  const weekNumbers = [...new Set(sortedSessions.map((session) => session.week))].sort((a, b) => a - b);

  return {
    sheetName,
    maxes,
    weeks: weekNumbers.map((week) => ({
      week,
      sessions: sortedSessions.filter((session) => session.week === week),
    })),
    stats: {
      weeks: weekNumbers.length,
      sessions: sortedSessions.length,
      lifts: new Set(sortedSessions.flatMap((session) => session.lifts.map((lift) => lift.key))).size,
    },
  };
};

export const parseScheduleFile = async (data) => {
  const XLSX = await loadXlsx();

  let workbook;
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    workbook = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new ScheduleParseError('Non riesco a leggere il file. Verifica che sia un Excel valido.');
  }

  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) {
    throw new ScheduleParseError('Il file non contiene fogli.');
  }

  let lastError = null;
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;

    try {
      return parseWorksheet(sheet, sheetName, XLSX);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new ScheduleParseError('Il file non contiene una programmazione leggibile.');
};

const TEMPLATE_ROWS = [
  ['Kuma Powerlifting - Template Programmazione'],
  [],
  ['Programma Panca', 100, '', 'Programma Squat', 150, '', 'Programma Stacco', '180 / 170'],
  [],
  ['1 week', '', '', '1 week', '', '', '1 week'],
  ['Lun: 4x4 70%', '', '', 'Lun: 5x5 75%', '', '', ''],
  ['Mar: 3x5 75%', '', '', '', '', '', 'Mar: 4x4 80%'],
  ['Gio: 5x5 80%', '', '', 'Gio: 3x3 85%', '', '', ''],
  ['Ven: 2 @8 + 85% 3x3', '', '', '', '', '', 'Ven: 4x4 70% classico'],
  [],
  ['2 week', '', '', '2 week', '', '', '2 week'],
  ['Lun: 4x4 75%', '', '', 'Lun: 5x5 80%', '', '', ''],
  ['Mar: 3x5 80%', '', '', '', '', '', 'Mar: 4x4 85%'],
  ['Gio: 5x3 85%', '', '', 'Gio: 3x3 90%', '', '', ''],
  ['Ven: 2 @9 + 90% 3x2', '', '', '', '', '', 'Ven: 3x3 75% sumo'],
  [],
  ['3 week', '', '', '3 week', '', '', '3 week'],
  ['Lun: 4x5 70%', '', '', 'Lun: 5x5 85%', '', '', ''],
  ['Mar: 3x4 80%', '', '', '', '', '', 'Mar: 4x4 90%'],
  ['Gio: 5x5 80%', '', '', 'Gio: 3x3 95%', '', '', ''],
  ['Ven: 2 @8 + 85% 3x3', '', '', '', '', '', 'Ven: 4x3 80% classico'],
  [],
  ['4 week', '', '', '4 week', '', '', '4 week'],
  ['Lun: 3x3 70%', '', '', 'Lun: 4x3 80%', '', '', ''],
  ['Mar: 2 @8 + 85% 2x2', '', '', '', '', '', 'Mar: 3x3 90%'],
  ['Gio: 4x4 75%', '', '', 'Gio: 3x2 90%', '', '', ''],
  ['Ven: 1 @8 + 80% 2x2', '', '', '', '', '', 'Ven: 3x3 85% sumo'],
];

const TEMPLATE_INSTRUCTIONS = [
  ['Come compilare il template'],
  [],
  ['1. Usa una colonna per alzata: Programma Panca, Programma Squat, Programma Stacco.'],
  ['2. Accanto al nome scrivi il massimale di riferimento in kg. Per lo Stacco puoi usare "280 / 270" (sumo / classico).'],
  ['3. Per ogni settimana inserisci una riga con "1 week", "2 week", "3 week", ...'],
  ['4. Sotto il marcatore inserisci una riga per ogni giorno: "Lun: 5x5 80%".'],
  ['5. Puoi mettere più blocchi nella stessa cella: "Lun: 2 @8 + 85% 3x3" oppure "Gio: 2x1 90%, 3x6 75%".'],
  ['6. Le varianti (larsen, highbar, safety bar, fermo 1", sumo, classico...) finiscono nelle note.'],
  ['7. I complementari, i recuperi (es. "rec", "Max 4 secondi") e i riposi vengono ignorati.'],
  ['8. Le percentuali sono calcolate sul massimale indicato qui oppure sui PR dell\'app, se il toggle è attivo.'],
  ['9. Se una percentuale segue un blocco RPE (es. "4 rpe 9 + 2x4 90%" oppure "4 @9 + 2x4 90%"), si applica al carico di quel blocco RPE e non al massimale.'],
  [],
  ['Esempi validi:'],
  ['Lun: 5x5 80%'],
  ['Mar: 3 @8 + 90% 2x3 (mignoli 81)'],
  ['Gio: 2x2 85%, 3x6 75%'],
  ['Ven: 4x4 70% classico'],
  ['Sab: 4 rpe 9 + 2x4 90%'],
];

export const downloadTemplate = async () => {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  const programSheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  programSheet['!cols'] = [
    { wch: 28 }, { wch: 10 }, { wch: 3 },
    { wch: 28 }, { wch: 10 }, { wch: 3 },
    { wch: 28 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, programSheet, 'Programmazione');

  const instructionsSheet = XLSX.utils.aoa_to_sheet(TEMPLATE_INSTRUCTIONS);
  instructionsSheet['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Istruzioni');

  XLSX.writeFile(workbook, 'Template_Programmazione_Kuma.xlsx');
};
