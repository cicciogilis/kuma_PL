const NUMBER_FORMATTER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const RAW_WEIGHT_FORMATTER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 4 });
const SUGGESTED_WEIGHT_FORMATTER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

export const formatNumber = (value) => NUMBER_FORMATTER.format(value);
export const formatRawWeight = (value) => RAW_WEIGHT_FORMATTER.format(value);
export const formatSuggestedWeight = (value) => SUGGESTED_WEIGHT_FORMATTER.format(value);

export const noteKeyFor = (week, session, liftIndex) =>
  `${week.week}-${session.day}-${liftIndex}`;

export const accessoryNoteKeyFor = (day, exerciseIndex) =>
  `accessory-${day}-${exerciseIndex}`;

export const getPrForLift = (lift, prMaxes) => {
  const key = lift.key === 'panca' ? 'bench' : lift.key === 'squat' ? 'squat' : 'deadlift';
  const value = Number(prMaxes?.[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const getStaccoVariant = (program, lift) => {
  if (lift?.variant === 'sumo' || lift?.variant === 'classico') return lift.variant;

  const maxes = program?.maxes || {};
  const hasClassico = Number(maxes.staccoClassico) > 0;
  const hasSumo = Number(maxes.staccoSumo) > 0;

  if (hasClassico && !hasSumo) return 'classico';
  if (hasSumo && !hasClassico) return 'sumo';
  return 'classico';
};

export const getMaxForLift = (program, lift, prMaxes) => {
  if (program.usePrMax) return getPrForLift(lift, prMaxes);

  const maxes = program.maxes || {};
  if (lift.key === 'panca') return maxes.panca > 0 ? maxes.panca : null;
  if (lift.key === 'squat') return maxes.squat > 0 ? maxes.squat : null;

  if (getStaccoVariant(program, lift) === 'classico') {
    return maxes.staccoClassico > 0 ? maxes.staccoClassico : maxes.staccoSumo || null;
  }
  return maxes.staccoSumo > 0 ? maxes.staccoSumo : maxes.staccoClassico || null;
};

const LIFT_DISPLAY_ORDER = { squat: 0, panca: 1, stacco: 2 };
const PROPOSAL_STEP = 1.25;

export const compareLifts = (a, b) =>
  (LIFT_DISPLAY_ORDER[a.key] ?? 99) - (LIFT_DISPLAY_ORDER[b.key] ?? 99);

export const getSuggestedWeight = (rawWeight) => {
  if (rawWeight == null) return null;

  return Math.ceil((rawWeight - 1e-6) / PROPOSAL_STEP) * PROPOSAL_STEP;
};

// Articolo per "calcolato su …": davanti a un numero che in italiano comincia
// per vocale (1 "uno", 11 "undici", 8/80-89/800… "otto/ottanta/ottocento")
// serve "sull'", altrimenti "sul ".
export const formatSuArticolo = (reference) => {
  const match = /^\d+/.exec(String(reference ?? '').trim());
  if (!match) return 'sul ';

  const value = Number(match[0]);
  const startsWithVowel = value === 1
    || value === 11
    || String(value).startsWith('8');

  return startsWithVowel ? "sull'" : 'sul ';
};

export const formatRpeReference = (base) => {
  if (!base) return '';

  const reps = base.sets && base.sets > 1
    ? `${base.sets}×${base.reps}`
    : base.reps != null ? `${base.reps}` : '';
  const rpe = base.rpe != null ? `@${formatNumber(base.rpe)}` : '';

  return [reps, rpe].filter(Boolean).join(' ');
};

const buildBlockParts = (block, accessory = false) => {
  const parts = [];
  const sets = Number(block.sets);
  const reps = block.reps == null ? '' : String(block.reps);

  if (sets && reps) {
    if (sets === 1 && block.rpe != null) {
      parts.push(`${reps} rep`);
    } else if (accessory && reps === 'max') {
      parts.push(`${sets}× max`);
    } else {
      parts.push(`${sets}×${reps}`);
    }
  } else if (reps) {
    parts.push(`${reps} rep`);
  } else if (accessory && sets) {
    parts.push(`${sets} serie`);
  }

  if (block.percent != null) parts.push(`@${formatNumber(block.percent)}%`);
  if (block.rpe != null) parts.push(`@${formatNumber(block.rpe)}`);

  return parts;
};

export const formatBlock = (block) => buildBlockParts(block).join(' ');

export const formatAccessoryBlock = (block) => {
  const details = buildBlockParts(block, true).join(' ');
  return block.note
    ? [details, `(${block.note})`].filter(Boolean).join(' ')
    : details;
};
