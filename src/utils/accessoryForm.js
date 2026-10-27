import { parseAccessoryText } from './scheduleParser.js';

// Logica del form dei complementari: da testo ("3 + 4" / "3x4 + 4x2") a blocchi e
// ritorno. Sta qui e non nel componente così il round-trip è verificabile.

const splitAccessoryParts = (value) =>
  String(value || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

export const buildAccessoryBlocks = (seriesInput, repsInput) => {
  const seriesText = String(seriesInput || '').trim();
  const repsText = String(repsInput || '').trim();
  if (!seriesText) return [];

  if (/[x×]/i.test(seriesText)) {
    const parsed = parseAccessoryText(`Esercizio ${seriesText.replace(/×/g, 'x')}`);
    return parsed?.blocks || [];
  }

  const seriesParts = splitAccessoryParts(seriesText);
  const repsParts = splitAccessoryParts(repsText);
  if (!seriesParts.length || !repsParts.length) return [];

  const makeBlock = (setsPart, reps) => ({
    sets: Number.parseInt(setsPart, 10),
    reps: String(reps).trim(),
    rpe: null,
    percent: null,
    percentBase: null,
    note: '',
  });

  let blocks = [];
  if (seriesParts.length === 1) {
    blocks = repsParts.map((reps) => makeBlock(seriesParts[0], reps));
  } else if (repsParts.length === 1) {
    blocks = seriesParts.map((sets) => makeBlock(sets, repsParts[0]));
  } else if (seriesParts.length === repsParts.length) {
    blocks = seriesParts.map((sets, index) => makeBlock(sets, repsParts[index]));
  }

  return blocks.filter((block) =>
    Number.isFinite(block.sets) && block.sets > 0 && block.reps
  );
};

// Se le serie sono tutte uguali si scrive una sola volta, altrimenti si elencano
// in ordine così `buildAccessoryBlocks` ricostruisce la stessa sequenza.
export const formatAccessorySeries = (blocks) => {
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return '';

  const uniqueSets = [...new Set(list.map((block) => Number(block.sets)))];
  if (uniqueSets.length === 1) return String(uniqueSets[0]);

  return list.map((block) => block.sets).join(' + ');
};

export const formatAccessoryReps = (blocks) => {
  const list = Array.isArray(blocks) ? blocks : [];
  return list.map((block) => block.reps).join(' + ');
};

export const sameAccessoryBlocks = (left, right) => {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  return a.length === b.length
    && a.every((block, index) =>
      Number(block.sets) === Number(b[index].sets)
      && String(block.reps ?? '') === String(b[index].reps ?? ''));
};

export const formatAccessoryCount = (count) =>
  `${count} ${count === 1 ? 'Esercizio' : 'Esercizi'}`;
